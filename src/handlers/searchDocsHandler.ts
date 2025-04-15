import { DuckDBService } from "../services/DuckDBService.js"; // Changed import
import { SearchDocsArgs, SearchDocsResultItem } from "../types/interfaces.js"; // Corrected import to SearchDocsResultItem

function extractSnippet(
  content: string,
  query: string,
  linesContext: number = 2
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

  // Extract context lines around the match
  const start = Math.max(0, matchLine - linesContext);
  const end = Math.min(lines.length, matchLine + linesContext + 1);
  const snippet = lines.slice(start, end).join('\n');

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

  const { query, limit = 10, linesContext = 16, fullFile = false } = args; // Use args from tool definition
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
        NULL as language,
        "order" -- Keep order if needed for context fetching
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
        language,
        "order"
      FROM read_parquet(?) -- docs_content.parquet path
      WHERE content ILIKE ?
    )
    SELECT * FROM combined_results
    ORDER BY filePath, "order" -- Order results for potential context fetching later
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

  // For now, return raw matched content as snippet and format section
  const formattedResults: SearchDocsResultItem[] = dbResults.map((row: any) => {
    let section: string | undefined = undefined;
    if (row.sourceType === 'api') {
      section = row.apiPath ? `${row.apiPath} (${row.method})` : row.summary;
    } else if (row.sourceType === 'markdown') {
      section = [row.heading1, row.heading2, row.heading3].filter(Boolean).join(' > ');
    }

    return {
      name: row.fileName,
      path: row.filePath,
      repository: "elevenlabs/elevenlabs-docs", // Assuming constant repo
      url: `https://github.com/elevenlabs/elevenlabs-docs/blob/main/${row.filePath}`, // Construct URL
      snippet: row.content, // Placeholder: Use matched content directly for now
      section: section || undefined,
      lineNumber: row.lineNumber,
    };
  });

  // Return results in the expected format for the MCP SDK
  return { results: formattedResults };
}
