import { ElevenLabsClient } from "../services/ElevenLabsClient.js";

interface GetApiFileArgs {
  filename: string;
  filter?: string;
  context?: number;
}

export async function handleGetApiFile(
  client: ElevenLabsClient,
  args: GetApiFileArgs
): Promise<any> {
  if (!args.filename) {
    throw new Error("Missing required argument: filename");
  }

  // Only allow access to known API spec files for safety
  const allowedFiles = [
    "fern/apis/api/asyncapi.yml",
    "fern/apis/api/generators.yml",
    "fern/apis/api/openapi-overrides.yml",
    "fern/apis/api/openapi.json",
    "fern/apis/convai/asyncapi.yml",
    "fern/apis/convai/generators.yml",
    "fern/apis/convai/openapi.json",
  ];

  const match = allowedFiles.find((f) => f.endsWith(args.filename));
  if (!match) {
    throw new Error("Requested file is not an allowed API spec file.");
  }

  try {
    const content = await client.getFileContent(match);

    // Special handling for large files like openapi.json
    if (args.filename === "openapi.json") {
      if (!args.filter) {
        throw new Error(
          "For openapi.json, you must provide a 'filter' argument to avoid loading the entire file."
        );
      }
      const context =
        typeof args.context === "number" && args.context > 0
          ? args.context
          : 12;
      // Simple substring search for the filter, return a snippet with context
      const lines = content.split(/\r?\n/);
      const lowerFilter = args.filter.toLowerCase();
      let matchLine = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lowerFilter)) {
          matchLine = i;
          break;
        }
      }
      if (matchLine === -1) {
        return {
          name: match.split("/").pop(),
          path: match,
          snippet: "No match found for filter.",
        };
      }
      const start = Math.max(0, matchLine - context);
      const end = Math.min(lines.length, matchLine + context + 1);
      const snippet = lines.slice(start, end).join("\n");
      return {
        name: match.split("/").pop(),
        path: match,
        snippet,
        lineNumber: matchLine + 1,
        context,
      };
    }

    // For other files, return the full content
    return {
      name: match.split("/").pop(),
      path: match,
      content,
    };
  } catch (e) {
    throw new Error("Failed to retrieve file content.");
  }
}
