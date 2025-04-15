import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Tool definitions
export const searchDocsTool: Tool = {
  name: "elevenlabs_search_docs",
  description:
    "Search ElevenLabs documentation and API spec files (e.g., asyncapi.yml, openapi.json) based on keywords. Returns file name, path, a snippet of matching content, repository, url, line number, and (if available) section/heading for each result. Supports customizing lines of context and returning the entire file if requested.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query or keywords",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default 10)",
        default: 10,
      },
      linesContext: {
        type: "number",
        description:
          "Number of context lines to include before and after the match (default 16)",
        default: 16,
      },
      fullFile: {
        type: "boolean",
        description:
          "If true, returns the entire file content for each match (default false)",
        default: false,
      },
    },
    required: ["query"],
  },
};

export const getDocTool: Tool = {
  name: "elevenlabs_get_doc",
  description: "Get specific ElevenLabs document content by path",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Document path relative to the fern directory",
      },
    },
    required: ["path"],
  },
};

export const searchApiFilesTool: Tool = {
  name: "elevenlabs_search_api_files",
  description:
    "Fuzzy search inside ElevenLabs API spec files (e.g., asyncapi.yml, openapi.json) for keywords. Returns file name, path, a snippet of matching content, line number, and section/heading for each result. Supports customizing lines of context and returning the entire file if requested.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query or keywords",
      },
      linesContext: {
        type: "number",
        description:
          "Number of context lines to include before and after the match (default 16)",
        default: 16,
      },
      fullFile: {
        type: "boolean",
        description:
          "If true, returns the entire file content for each match (default false)",
        default: false,
      },
    },
    required: ["query"],
  },
};

// Export all tools
export const allTools = [searchDocsTool, getDocTool, searchApiFilesTool];
