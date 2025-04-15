import { DuckDBService } from "../services/DuckDBService.js"; // Changed import
// Import common result type and args type if defined, otherwise define locally or import later
import { SearchDocsResultItem } from "../types/interfaces.js";

// Define args locally if not in interfaces.ts, ensuring it matches tool definition
interface SearchApiFilesArgs {
  query: string;
  linesContext?: number;
  fullFile?: boolean;
}

function extractSnippets(
  content: string,
  query: string,
  linesContext: number = 2
): Array<{ snippet: string; section?: string; lineNumber?: number }> {
  const lines = content.split(/\r?\n/);
  const matches: Array<{ snippet: string; section?: string; lineNumber?: number }> = [];

  // Try to interpret the query as a regex if it looks like one, otherwise fallback to substring
  let isRegex = false;
  let regex: RegExp | null = null;
  try {
    if (/[\^\$\.\*\+\?\(\)\[\]\{\}\\]/.test(query)) {
      regex = new RegExp(query, "i");
      isRegex = true;
    }
  } catch (e) {
    regex = null;
    isRegex = false;
  }

  // Find all lines matching the query (regex or substring, case-insensitive, also try trimmed line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;
    if (isRegex && regex) {
      if (regex.test(line) || regex.test(line.trim())) {
        matched = true;
      }
    } else {
      if (
        line.toLowerCase().includes(query.toLowerCase()) ||
        line.trim().toLowerCase().includes(query.toLowerCase())
      ) {
        matched = true;
      }
    }
    if (matched) {
      // Extract context lines around the match
      const start = Math.max(0, i - linesContext);
      const end = Math.min(lines.length, i + linesContext + 1);
      const snippet = lines.slice(start, end).join('\n');

      // Try to find the nearest preceding heading (Markdown or YAML)
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

      matches.push({ snippet, section, lineNumber: i + 1 });
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
  const { query, linesContext = 16, fullFile = false } = args;
  const searchQuery = `%${query}%`; // Prepare for ILIKE

  // Construct the SQL query to search only the api_spec Parquet file
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
    FROM read_parquet(?) -- api_spec.parquet path
    WHERE
      content ILIKE ? OR summary ILIKE ? OR description ILIKE ? OR apiPath ILIKE ? OR method ILIKE ?
    -- No LIMIT here, assuming the tool definition doesn't specify one for this specific tool
    -- If a limit is needed, add LIMIT ? and pass args.limit ?? some_default
  `;

  const params = [
    service.getApiSpecPath(), // Path to api_spec.parquet
    searchQuery, // content
    searchQuery, // summary
    searchQuery, // description
    searchQuery, // apiPath
    searchQuery, // method
  ];

  const dbResults = await service.executeQuery(sql, params);

  // TODO: Implement snippet generation based on linesContext and fullFile.
  // Similar complexity as in searchDocsHandler.
  // For now, return raw matched content as snippet and format section.

  const formattedResults: SearchDocsResultItem[] = dbResults.map((row: any) => {
    // Determine section based on available API info
    const section = row.apiPath ? `${row.apiPath} (${row.method})` : row.summary;

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

  // Return results in the expected format
  return { results: formattedResults };
}
