import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Tool definitions
export const searchDocsTool: Tool = {
  name: "elevenlabs_search_docs",
  description: "Search ElevenLabs documentation based on keywords",
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

export const getDocsStructureTool: Tool = {
  name: "elevenlabs_get_docs_structure",
  description: "Retrieve and parse the docs.yml file to understand the documentation structure",
  inputSchema: {
    type: "object",
    properties: {
      includeApiDetails: {
        type: "boolean",
        description: "Whether to include detailed API information or just the structure",
        default: false,
      },
    },
  },
};

export const listRepositoryPathTool: Tool = {
  name: "elevenlabs_list_repository_path",
  description: "List files and directories at a specific path in the repository",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to list (relative to repository root)",
      },
      depth: {
        type: "number",
        description: "How many levels deep to traverse (default: 1)",
        default: 1,
      },
    },
    required: ["path"],
  },
};

export const listApiEndpointsTool: Tool = {
  name: "elevenlabs_list_api_endpoints",
  description: "List available ElevenLabs API endpoints (base URL: https://api.elevenlabs.io)",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "API category to filter endpoints (optional)",
      },
      limit: {
        type: "number",
        description: "Maximum number of endpoints to return (default 20)",
        default: 20,
      },
    },
  },
};

export const getApiReferenceTool: Tool = {
  name: "elevenlabs_get_api_reference",
  description: "Get API reference for a specific ElevenLabs API endpoint (base URL: https://api.elevenlabs.io)",
  inputSchema: {
    type: "object",
    properties: {
      endpoint: {
        type: "string",
        description: "API endpoint path (e.g., '/v1/text-to-speech') to be used with base URL https://api.elevenlabs.io",
      },
    },
    required: ["endpoint"],
  },
};

// Export all tools as an array for easier access
export const allTools = [
  searchDocsTool,
  getDocTool,
  getDocsStructureTool,
  listRepositoryPathTool,
  listApiEndpointsTool,
  getApiReferenceTool,
]; 