import { DuckDBService } from "../services/DuckDBService.js"; // Changed import
// Import common result type and args type if defined, otherwise define locally or import later
import { SearchDocsResultItem } from "../types/interfaces.js";

// Define args locally if not in interfaces.ts, ensuring it matches tool definition
interface SearchApiFilesArgs {
  query: string;
  fullFile?: boolean;
}

function extractSnippets(
  content: string,
  query: string
): Array<{ snippet: string; section?: string; lineNumber?: number }> {
  const lines = content.split(/\r?\n/);
  const matches: Array<{ snippet: string; section?: string; lineNumber?: number }> = [];

  // Find all lines matching the query (case-insensitive, also try trimmed line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.toLowerCase().includes(query.toLowerCase()) ||
      line.trim().toLowerCase().includes(query.toLowerCase())
    ) {
      // Only return the matching line as the snippet
      let section: string | undefined = undefined;
      for (let j = i; j >= 0; j--) {
        const mdMatch = lines[j].match(/^#+\s+(.*)/);
        if (mdMatch) {
          section = mdMatch[1].trim();
          break;
        }
        const yamlMatch = lines[j].match(/^([a-zA-Z0-9_-]+):\s*$/);
        if (yamlMatch) {
          section = yamlMatch[1].trim();
          break;
        }
      }
      matches.push({ snippet: line, section, lineNumber: i + 1 });
    }
  }

  // If no matches, just return the first few lines
  if (matches.length === 0) {
    return [{ snippet: lines.slice(0, 3).join('\n') }];
  }

  return matches;
}

// Changed client to service: DuckDBService and adjusted args order
export async function handleSearchApiFiles(
  args: SearchApiFilesArgs,
  service: DuckDBService
): Promise<any> { // Keep Promise<any> for now
  if (!args.query) {
    throw new Error("Missing required argument: query");
  }
  const { query } = args;
  const searchQuery = `%${query}%`; // Prepare for ILIKE

  // Construct the SQL query to search only the api_spec Parquet file, with limit
  const sql = `
    SELECT
      filePath,
      fileName,
      content,
      lineNumber,
      summary,
      description,
      apiPath,
      method
    FROM read_parquet(?)
    WHERE
      content ILIKE ? OR summary ILIKE ? OR description ILIKE ? OR apiPath ILIKE ? OR method ILIKE ?
    LIMIT ?;
  `;

  const limit = typeof (args as any).limit === "number" ? (args as any).limit : 10;

  const params = [
    service.getApiSpecPath(),
    searchQuery,
    searchQuery,
    searchQuery,
    searchQuery,
    searchQuery,
    limit
  ];

  const dbResults = await service.executeQuery(sql, params);

  // For each result, always return a snippet with context
  const formattedResults: SearchDocsResultItem[] = dbResults.map((row: any) => {
    const section = row.apiPath ? `${row.apiPath} (${row.method})` : row.summary;
    // Extract a snippet (just the matching line)
    const snippets = extractSnippets(row.content, query);
    let snippet: string;
    let lineNumber: number | undefined = row.lineNumber;
    if (snippets.length > 0) {
      snippet = snippets[0].snippet;
      if (snippets[0].lineNumber) lineNumber = snippets[0].lineNumber;
    } else {
      snippet = row.content;
    }

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
