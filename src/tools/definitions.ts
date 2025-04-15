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
    "Search ElevenLabs docs and API spec (from DuckDB Parquet files) by keyword. Use this tool to discover request/response models, schema definitions, and documentation files. Model/schema names and doc file names in results can be used for direct follow-up queries. Direct file name queries return the full document content. Results include file name, path, snippet, and section.",
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




// Export all tools
export const allTools = [searchDocsTool];
