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
      includeFullContent: {
        type: "boolean",
        description: "If true, include the fullContent column (full document text) in results (docs search only).",
        default: false
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default 10)",
        default: 10,
      },
      includeSchemaDefinition: {
        type: "boolean",
        description: "If true, include the schemaDefinition column (full JSON schema) in results (API spec search only).",
        default: false
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
            section: { type: "string" },
            fullContent: { type: "string" }
          },
          required: ["name", "path", "snippet", "repository", "url"]
        }
      }
    },
    required: ["results"]
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
            section: { type: "string" },
            schemaDefinition: { type: "string" }
          },
          required: ["name", "path", "snippet"]
        }
      }
    },
    required: ["results"]
  }
};

// Export all tools
export const allTools = [searchDocsTool, searchApiFilesTool];
