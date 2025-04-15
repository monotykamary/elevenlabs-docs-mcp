import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { SearchDocsArgs } from "../types/interfaces.js";

function extractSnippet(content: string, query: string, linesContext: number = 1): { snippet: string, section?: string } {
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

  return { snippet, section };
}

export async function handleSearchDocs(
  client: ElevenLabsClient,
  args: SearchDocsArgs
): Promise<any> {
  if (!args.query) {
    throw new Error("Missing required argument: query");
  }

  const response = await client.searchCode(args.query, args.limit);

  // For each result, fetch file content and extract snippet/context
  const results = await Promise.all(
    response.items.map(async (item: any) => {
      let snippet = "";
      let section: string | undefined = undefined;
      try {
        const content = await client.getFileContent(item.path);
        const { snippet: snip, section: sec } = extractSnippet(content, args.query, 1);
        snippet = snip;
        section = sec;
      } catch (e) {
        snippet = "(Could not fetch file content for snippet)";
      }
      return {
        name: item.name,
        path: item.path,
        repository: item.repository.full_name,
        url: item.html_url,
        snippet,
        section,
      };
    })
  );

  return { results };
}
