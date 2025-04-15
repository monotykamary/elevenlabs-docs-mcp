import { DuckDBService } from "../services/DuckDBService.js"; // Changed import
import { SearchDocsArgs, SearchDocsResultItem } from "../types/interfaces.js"; // Corrected import to SearchDocsResultItem

function extractSnippet(
  content: string,
  query: string
): { snippet: string; section?: string; lineNumber?: number } {
  const lines = content.split(/\r?\n/);
  const lowerQuery = query.toLowerCase();
  let matchLine = -1;

  // Find the first line containing the query (case-insensitive)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lowerQuery)) {
      matchLine = i;
      break;
    }
  }

  // If not found, just return the first few lines
  if (matchLine === -1) {
    return { snippet: lines.slice(0, 3).join('\n') };
  }

  // Only return the matching line as the snippet
  const snippet = lines[matchLine];

  // Try to find the nearest preceding heading (Markdown or YAML)
  let section: string | undefined = undefined;
  for (let i = matchLine; i >= 0; i--) {
    // Markdown heading
    const mdMatch = lines[i].match(/^#+\s+(.*)/);
    if (mdMatch) {
      section = mdMatch[1].trim();
      break;
    }
    // YAML top-level key (for .yml/.yaml)
    const yamlMatch = lines[i].match(/^([a-zA-Z0-9_-]+):\s*$/);
    if (yamlMatch) {
      section = yamlMatch[1].trim();
      break;
    }
  }

  return { snippet, section, lineNumber: matchLine + 1 };
}

// Changed client to service: DuckDBService and adjusted args order
export async function handleSearchDocs(
  args: SearchDocsArgs,
  service: DuckDBService
): Promise<any> { // Keep Promise<any> for now, refine later if needed
  if (!args.query) {
    throw new Error("Missing required argument: query");
  }

  const { query, limit = 10 } = args; // Use args from tool definition
  const searchQuery = `%${query}%`; // Prepare for ILIKE

  // Construct the SQL query to search both Parquet files
  const sql = `
    WITH combined_results AS (
      SELECT
        filePath,
        fileName,
        content,
        lineNumber,
        'api' as sourceType,
        summary,
        description,
        apiPath,
        method,
        NULL as heading1, -- Placeholder columns for UNION ALL
        NULL as heading2,
        NULL as heading3,
        NULL as contentType,
        NULL as language
      FROM read_parquet(?) -- api_spec.parquet path
      WHERE
        content ILIKE ? OR summary ILIKE ? OR description ILIKE ? OR apiPath ILIKE ? OR method ILIKE ?

      UNION ALL

      SELECT
        filePath,
        fileName,
        content,
        lineNumber,
        'markdown' as sourceType,
        NULL as summary, -- Placeholder columns
        NULL as description,
        NULL as apiPath,
        NULL as method,
        heading1,
        heading2,
        heading3,
        contentType,
        language
      FROM read_parquet(?) -- docs_content.parquet path
      WHERE content ILIKE ?
    )
    SELECT * FROM combined_results
    ORDER BY filePath
    LIMIT ?;
  `;

  const params = [
    service.getApiSpecPath(), // Path to api_spec.parquet
    searchQuery, // api: content
    searchQuery, // api: summary
    searchQuery, // api: description
    searchQuery, // api: apiPath
    searchQuery, // api: method
    service.getDocsContentPath(), // Path to docs_content.parquet
    searchQuery, // md: content
    limit // LIMIT clause
  ];

  const dbResults = await service.executeQuery(sql, params);

  // TODO: Implement snippet generation based on linesContext and fullFile.
  // This is more complex now as we don't have the full file content readily available.
  // Option 1: Fetch surrounding rows from Parquet based on filePath and order/lineNumber.
  // Option 2: If fullFile is true, read the original file from /app/elevenlabs-docs using fs.
  // Option 3: Add full file content to Parquet during ETL (increases size).

  // For each result, return either the full file or a snippet with context
  const formattedResults: SearchDocsResultItem[] = dbResults.map((row: any) => {
    let section: string | undefined = undefined;
    if (row.sourceType === 'api') {
      section = row.apiPath ? `${row.apiPath} (${row.method})` : row.summary;
    } else if (row.sourceType === 'markdown') {
      section = [row.heading1, row.heading2, row.heading3].filter(Boolean).join(' > ');
    }

    // Always extract a snippet with context lines
    const snippetObj = extractSnippet(row.content, query);
    let snippet = snippetObj.snippet;
    let lineNumber: number | undefined = row.lineNumber;
    if (snippetObj.lineNumber) lineNumber = snippetObj.lineNumber;
    if (snippetObj.section) section = snippetObj.section;

    return {
      name: row.fileName,
      path: row.filePath,
      repository: "elevenlabs/elevenlabs-docs",
      url: `https://github.com/elevenlabs/elevenlabs-docs/blob/main/${row.filePath}`,
      snippet,
      section: section || undefined,
      lineNumber,
    };
  });

  return { results: formattedResults };
}
