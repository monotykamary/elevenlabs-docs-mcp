import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Tool definitions
export const searchDocsTool: Tool = {
  name: "elevenlabs_search_docs",
  description: "Search ElevenLabs documentation based on keywords. Returns file name, path, a snippet of matching content, repository, url, and (if available) section/heading for each result.",
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

// Export only the two tools
export const allTools = [
  searchDocsTool,
  getDocTool,
];
