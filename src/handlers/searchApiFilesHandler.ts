import { ElevenLabsClient } from "../services/ElevenLabsClient.js";

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

export async function handleSearchApiFiles(
  client: ElevenLabsClient,
  args: SearchApiFilesArgs
): Promise<any> {
  if (!args.query) {
    throw new Error("Missing required argument: query");
  }
  const linesContext = args.linesContext ?? 16;
  const fullFile = args.fullFile ?? false;

  const apiSpecFiles = [
    "fern/apis/api/asyncapi.yml",
    "fern/apis/api/generators.yml",
    "fern/apis/api/openapi-overrides.yml",
    "fern/apis/api/openapi.json",
    "fern/apis/convai/asyncapi.yml",
    "fern/apis/convai/generators.yml",
    "fern/apis/convai/openapi.json",
  ];

  const results = await Promise.all(
    apiSpecFiles.map(async (path) => {
      try {
        const content = await client.getFileContent(path);
        if (fullFile) {
          if (content.toLowerCase().includes(args.query.toLowerCase())) {
            return [{
              name: path.split("/").pop(),
              path,
              snippet: content,
              lineNumber: null,
              section: undefined,
            }];
          }
        } else {
          const snippets = extractSnippets(content, args.query, linesContext);
          return snippets.map(({ snippet, section, lineNumber }) => ({
            name: path.split("/").pop(),
            path,
            snippet,
            lineNumber,
            section,
          }));
        }
      } catch (e) {
        // Ignore missing files
      }
      return [];
    })
  );

  // Flatten results and filter out empty arrays
  return { results: results.flat().filter(Boolean) };
}
