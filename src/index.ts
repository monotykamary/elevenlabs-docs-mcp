#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';

// Type definitions for tool arguments
interface SearchDocsArgs {
  query: string;
  limit?: number;
}

interface GetDocArgs {
  path: string;
}

interface ListCategoriesArgs {
  limit?: number;
}

interface ListApiEndpointsArgs {
  category?: string;
  limit?: number;
}

interface GetApiReferenceArgs {
  endpoint: string;
}

// Tool definitions
const searchDocsTool: Tool = {
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

const getDocTool: Tool = {
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

const listCategoriesTool: Tool = {
  name: "elevenlabs_list_categories",
  description: "List ElevenLabs documentation categories",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of categories to return (default 20)",
        default: 20,
      },
    },
  },
};

const listApiEndpointsTool: Tool = {
  name: "elevenlabs_list_api_endpoints",
  description: "List available ElevenLabs API endpoints",
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

const getApiReferenceTool: Tool = {
  name: "elevenlabs_get_api_reference",
  description: "Get API reference for a specific ElevenLabs API endpoint",
  inputSchema: {
    type: "object",
    properties: {
      endpoint: {
        type: "string",
        description: "API endpoint path (e.g., '/v1/text-to-speech')",
      },
    },
    required: ["endpoint"],
  },
};

class ElevenLabsClient {
  private githubHeaders: { Authorization?: string; "Content-Type": string };
  private readonly owner = "elevenlabs";
  private readonly repo = "elevenlabs-docs";
  private readonly baseUrl = "https://api.github.com";

  constructor(githubToken?: string) {
    this.githubHeaders = {
      "Content-Type": "application/json",
    };

    if (githubToken) {
      this.githubHeaders.Authorization = `token ${githubToken}`;
    }
  }

  async getFileContent(path: string): Promise<any> {
    const apiUrl = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${path}`;
    const response = await fetch(apiUrl, { headers: this.githubHeaders });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file content: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.content) {
      throw new Error(`No content found for file: ${path}`);
    }

    // GitHub API returns content as base64 encoded
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return content;
  }

  async searchCode(query: string, limit: number = 10): Promise<any> {
    const encodedQuery = encodeURIComponent(`${query} repo:${this.owner}/${this.repo} path:fern`);
    const apiUrl = `${this.baseUrl}/search/code?q=${encodedQuery}&per_page=${limit}`;
    
    const response = await fetch(apiUrl, { headers: this.githubHeaders });
    
    if (!response.ok) {
      throw new Error(`Failed to search code: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async listContents(path: string = "fern"): Promise<any> {
    const apiUrl = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${path}`;
    const response = await fetch(apiUrl, { headers: this.githubHeaders });
    
    if (!response.ok) {
      throw new Error(`Failed to list contents: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Process YAML content to extract meaningful information
  async processYaml(content: string): Promise<any> {
    try {
      const parsedYaml = yaml.load(content);
      
      // For AsyncAPI files, extract relevant information
      if (parsedYaml && typeof parsedYaml === 'object') {
        try {
          // Use JSON.parse/stringify to get a plain object we can work with
          const plainObject = JSON.parse(JSON.stringify(parsedYaml));
          
          return {
            info: plainObject.info || {},
            paths: plainObject.paths || {},
            definitions: plainObject.definitions || {},
            parsed: true
          };
        } catch (err) {
          console.error("Error processing API spec:", err);
          return { parsed: false, raw: parsedYaml };
        }
      }
      
      return { parsed: false, raw: parsedYaml };
    } catch (error) {
      console.error("Error processing YAML:", error);
      return { parsed: false, raw: content };
    }
  }
}

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;

  console.error("Starting ElevenLabs MCP Server...");
  const server = new Server(
    {
      name: "ElevenLabs MCP Server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  const elevenLabsClient = new ElevenLabsClient(githubToken);

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      console.error("Received CallToolRequest:", request);
      try {
        if (!request.params.arguments) {
          throw new Error("No arguments provided");
        }

        switch (request.params.name) {
          case "elevenlabs_search_docs": {
            const args = request.params.arguments as unknown as SearchDocsArgs;
            if (!args.query) {
              throw new Error("Missing required argument: query");
            }
            const response = await elevenLabsClient.searchCode(
              args.query,
              args.limit,
            );
            
            // Process search results to make them more useful
            const results = response.items.map((item: any) => ({
              name: item.name,
              path: item.path,
              repository: item.repository.full_name,
              url: item.html_url,
            }));
            
            return {
              content: [{ type: "text", text: JSON.stringify({ results }) }],
            };
          }

          case "elevenlabs_get_doc": {
            const args = request.params.arguments as unknown as GetDocArgs;
            if (!args.path) {
              throw new Error("Missing required argument: path");
            }
            
            // If path doesn't include fern directory, add it
            const fullPath = args.path.startsWith("fern/") 
              ? args.path 
              : `fern/${args.path}`;
              
            const content = await elevenLabsClient.getFileContent(fullPath);
            
            // Process content based on file type
            let processedContent;
            if (fullPath.endsWith('.yaml') || fullPath.endsWith('.yml')) {
              processedContent = await elevenLabsClient.processYaml(content);
            } else {
              processedContent = { raw: content };
            }
            
            return {
              content: [{ type: "text", text: JSON.stringify(processedContent) }],
            };
          }

          case "elevenlabs_list_categories": {
            const args = request.params.arguments as unknown as ListCategoriesArgs;
            const limit = args.limit || 20;
            
            const contents = await elevenLabsClient.listContents("fern");
            
            // Filter to only include directories which represent categories
            const categories = contents
              .filter((item: any) => item.type === "dir")
              .slice(0, limit)
              .map((item: any) => ({
                name: item.name,
                path: item.path,
                url: item.html_url
              }));
            
            return {
              content: [{ type: "text", text: JSON.stringify({ categories }) }],
            };
          }

          case "elevenlabs_list_api_endpoints": {
            const args = request.params.arguments as unknown as ListApiEndpointsArgs;
            const limit = args.limit || 20;
            
            let path = "fern/apis";
            if (args.category) {
              path = `fern/apis/${args.category}`;
            }
            
            try {
              const contents = await elevenLabsClient.listContents(path);
              
              // Filter to include YAML files
              const endpoints = contents
                .filter((item: any) => item.type === "file" && 
                  (item.name.endsWith('.yaml') || item.name.endsWith('.yml')))
                .slice(0, limit)
                .map((item: any) => ({
                  name: item.name,
                  path: item.path,
                  url: item.html_url
                }));
              
              return {
                content: [{ type: "text", text: JSON.stringify({ endpoints }) }],
              };
            } catch (error) {
              // Fall back to searching for all API files if path not found
              console.error(`Error listing contents for ${path}, falling back to search`);
              const searchResponse = await elevenLabsClient.searchCode("path:fern/apis", limit);
              
              const endpoints = searchResponse.items
                .filter((item: any) => 
                  item.name.endsWith('.yaml') || item.name.endsWith('.yml'))
                .slice(0, limit)
                .map((item: any) => ({
                  name: item.name,
                  path: item.path,
                  url: item.html_url
                }));
                
              return {
                content: [{ type: "text", text: JSON.stringify({ endpoints }) }],
              };
            }
          }

          case "elevenlabs_get_api_reference": {
            const args = request.params.arguments as unknown as GetApiReferenceArgs;
            if (!args.endpoint) {
              throw new Error("Missing required argument: endpoint");
            }
            
            // Search for API reference docs that match the endpoint
            const query = `${args.endpoint} path:fern/apis`;
            const searchResults = await elevenLabsClient.searchCode(query, 5);
            
            if (searchResults.items.length === 0) {
              return {
                content: [{ 
                  type: "text", 
                  text: JSON.stringify({ 
                    error: `No API reference found for endpoint: ${args.endpoint}`
                  }) 
                }],
              };
            }
            
            // Get the most relevant result
            const mostRelevantPath = searchResults.items[0].path;
            const content = await elevenLabsClient.getFileContent(mostRelevantPath);
            
            // Process YAML content
            const processedContent = await elevenLabsClient.processYaml(content);
            
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  endpoint: args.endpoint,
                  reference: processedContent
                }) 
              }],
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        console.error("Error executing tool:", error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("Received ListToolsRequest");
    return {
      tools: [
        searchDocsTool,
        getDocTool,
        listCategoriesTool,
        listApiEndpointsTool,
        getApiReferenceTool,
      ],
    };
  });

  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  await server.connect(transport);

  console.error("ElevenLabs MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
