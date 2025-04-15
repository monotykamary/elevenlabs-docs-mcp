import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Tool definitions
/**
 * Queries DuckDB Parquet files for ElevenLabs documentation and API spec search.
 * - docs_content.parquet schema: filePath, fileName, content, lineNumber, heading1, heading2, heading3, contentType, language, order
 * - api_spec.parquet schema: filePath, fileName, content, lineNumber, summary, description, apiPath, method, order
 * Returns: Array of results with { name, path, snippet, repository, url, lineNumber, section }
 */
export const searchDocsTool: Tool = {
  name: "elevenlabs_search_docs",
  description:
    "Searches indexed ElevenLabs documentation and API spec content (from DuckDB Parquet files: docs_content.parquet and api_spec.parquet) based on keywords. This tool does NOT open or read large files directly—results are limited to what is present in the indexed data. Returns file name, path, a snippet of matching content, repository, url, line number, and (if available) section/heading for each result.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query or keywords (applies to content, summary, description, apiPath, method fields)",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default 10)",
        default: 10,
      },
    },
    required: ["query"],
  },
  // Output schema for clarity
  outputSchema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            path: { type: "string" },
            snippet: { type: "string" },
            repository: { type: "string" },
            url: { type: "string" },
            lineNumber: { type: "number" },
            section: { type: "string" }
          },
          required: ["name", "path", "snippet", "repository", "url"]
        }
      }
    },
    required: ["results"]
  }
};

/**
 * Retrieves the raw content of a specific ElevenLabs document from the docs_content.parquet file.
 * - docs_content.parquet schema: filePath, fileName, content, lineNumber, heading1, heading2, heading3, contentType, language, order
 * Returns: { raw: string }
 */
export const getDocTool: Tool = {
  name: "elevenlabs_get_doc",
  description: "Get specific ElevenLabs document content by path (queried from docs_content.parquet in DuckDB).",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Document path relative to the fern directory (e.g., docs/pages/overview.mdx)",
      },
    },
    required: ["path"],
  },
  outputSchema: {
    type: "object",
    properties: {
      raw: { type: "string" }
    },
    required: ["raw"]
  }
};

// Queries only the api_spec.parquet file for API spec search.
export const searchApiFilesTool: Tool = {
  name: "elevenlabs_search_api_files",
  description:
    "Fuzzy searches indexed ElevenLabs API spec content (from api_spec.parquet in DuckDB) for keywords. This tool does NOT open or read large files directly—results are limited to what is present in the indexed data. Returns file name, path, a snippet of matching content, line number, and section/heading for each result.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query or keywords (applies to content, summary, description, apiPath, method fields)",
      },
    },
    required: ["query"],
  },
  outputSchema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            path: { type: "string" },
            snippet: { type: "string" },
            lineNumber: { type: "number" },
            section: { type: "string" }
          },
          required: ["name", "path", "snippet"]
        }
      }
    },
    required: ["results"]
  }
};

// Export all tools
export const allTools = [searchDocsTool, getDocTool, searchApiFilesTool];
