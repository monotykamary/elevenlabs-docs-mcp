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

// Type definitions for tool arguments
interface SearchDocsArgs {
  query: string;
  limit?: number;
}

interface GetDocArgs {
  path: string;
}

interface ListApiEndpointsArgs {
  category?: string;
  limit?: number;
}

interface GetApiReferenceArgs {
  endpoint: string;
}

interface GetDocsStructureArgs {
  includeApiDetails?: boolean;
}

interface ListRepositoryPathArgs {
  path: string;
  depth?: number;
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

const getDocsStructureTool: Tool = {
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

const listRepositoryPathTool: Tool = {
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

const listApiEndpointsTool: Tool = {
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

const getApiReferenceTool: Tool = {
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

// Class definition should be marked as exported
export class ElevenLabsClient {
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

  async listContents(path: string = "fern", recursive: boolean = false, depth: number = 1): Promise<any> {
    const apiUrl = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${path}`;
    const response = await fetch(apiUrl, { headers: this.githubHeaders });
    
    if (!response.ok) {
      throw new Error(`Failed to list contents: ${response.status} ${response.statusText}`);
    }

    const items = await response.json();
    
    // If we're not recursing or at max depth, just return the items
    if (!recursive || depth <= 0) {
      return items;
    }
    
    // Otherwise, we need to get the contents of each directory
    const result = [];
    for (const item of items) {
      result.push(item);
      if (item.type === "dir") {
        try {
          const subItems = await this.listContents(item.path, recursive, depth - 1);
          result.push(...subItems);
        } catch (error) {
          console.error(`Error listing contents of ${item.path}:`, error);
        }
      }
    }
    
    return result;
  }
  
  // Process docs.yml to extract the documentation structure
  async getDocsStructure(includeApiDetails: boolean = false): Promise<any> {
    const docsYmlPath = "fern/docs.yml";
    try {
      const content = await this.getFileContent(docsYmlPath);
      const parsedYaml = yaml.load(content) as any;
      
      if (!parsedYaml) {
        throw new Error(`Failed to parse ${docsYmlPath}`);
      }
      
      // Extract the documentation structure from the YAML
      const structure: {
        title: string;
        tabs: Record<string, any>;
        navigation: any[];
        apiEndpoints?: any[];
        error?: string;
      } = {
        title: parsedYaml.title || "ElevenLabs Documentation",
        tabs: {} as Record<string, any>,
        navigation: [] as any[],
      };
      
      // Process tabs if they exist
      if (parsedYaml.tabs) {
        Object.keys(parsedYaml.tabs).forEach(tabKey => {
          const tab = parsedYaml.tabs[tabKey];
          structure.tabs[tabKey] = {
            displayName: tab['display-name'] || tabKey,
            skipSlug: tab['skip-slug'] || false
          };
        });
      }
      
      // Process navigation which contains the actual structure
      if (parsedYaml.navigation) {
        for (const navItem of parsedYaml.navigation) {
          if (navItem.tab) {
            const tabStructure: any = {
              tab: navItem.tab,
              layout: [] as any[]
            };
            
            // Process the layout which can contain sections
            if (navItem.layout) {
              for (const layoutItem of navItem.layout) {
                // Handle sections
                if (layoutItem.section) {
                  const section = {
                    title: layoutItem.section,
                    skipSlug: layoutItem['skip-slug'] || false,
                    contents: [] as any[]
                  };
                  
                  // Process contents of each section (pages, links, nested sections)
                  if (layoutItem.contents) {
                    for (const contentItem of layoutItem.contents) {
                      // Page definition
                      if (contentItem.page) {
                        section.contents.push({
                          type: 'page',
                          title: contentItem.page,
                          path: contentItem.path,
                          icon: contentItem.icon
                        });
                      }
                      // Link definition
                      else if (contentItem.link) {
                        section.contents.push({
                          type: 'link',
                          title: contentItem.link,
                          href: contentItem.href,
                          icon: contentItem.icon
                        });
                      }
                      // Nested section
                      else if (contentItem.section) {
                        const nestedSection = {
                          type: 'section',
                          title: contentItem.section,
                          skipSlug: contentItem['skip-slug'] || false,
                          contents: [] as any[]
                        };
                        
                        // Process nested section contents
                        if (contentItem.contents) {
                          for (const nestedItem of contentItem.contents) {
                            if (nestedItem.page) {
                              nestedSection.contents.push({
                                type: 'page',
                                title: nestedItem.page,
                                path: nestedItem.path,
                                icon: nestedItem.icon
                              });
                            } else if (nestedItem.link) {
                              nestedSection.contents.push({
                                type: 'link',
                                title: nestedItem.link,
                                href: nestedItem.href,
                                icon: nestedItem.icon
                              });
                            }
                          }
                        }
                        
                        section.contents.push(nestedSection);
                      }
                    }
                  }
                  
                  tabStructure.layout.push(section);
                }
                // Handle direct references to pages
                else if (layoutItem.page) {
                  tabStructure.layout.push({
                    type: 'page',
                    title: layoutItem.page,
                    path: layoutItem.path,
                    icon: layoutItem.icon
                  });
                }
                // Handle changelog
                else if (layoutItem.changelog) {
                  tabStructure.layout.push({
                    type: 'changelog',
                    path: layoutItem.changelog,
                    title: layoutItem.title,
                    icon: layoutItem.icon
                  });
                }
              }
            }
            
            structure.navigation.push(tabStructure);
          }
        }
      }
      
      // If detailed API information is requested, enhance the structure
      if (includeApiDetails) {
        // Add API endpoint information if available
        try {
          const openApiPaths = await this.listContents("fern/apis", false);
          
          if (openApiPaths) {
            const apiEndpoints = [];
            
            for (const apiPath of openApiPaths) {
              if (apiPath.type === "dir") {
                try {
                  const apiFiles = await this.listContents(apiPath.path, false);
                  const openapiFile = apiFiles.find((file: any) => 
                    file.name === "openapi.json" || 
                    file.name === "openapi-overrides.yml"
                  );
                  
                  if (openapiFile) {
                    const apiContent = await this.getFileContent(openapiFile.path);
                    let apiSpec;
                    
                    if (openapiFile.name.endsWith('.yml') || openapiFile.name.endsWith('.yaml')) {
                      apiSpec = await this.processYaml(apiContent);
                    } else {
                      apiSpec = JSON.parse(apiContent);
                    }
                    
                    if (apiSpec && apiSpec.paths) {
                      const endpoints = Object.keys(apiSpec.paths).map(path => ({
                        path,
                        methods: Object.keys(apiSpec.paths[path]),
                        category: apiPath.name
                      }));
                      
                      apiEndpoints.push(...endpoints);
                    }
                  }
                } catch (error) {
                  console.error(`Error processing API directory ${apiPath.path}:`, error);
                }
              }
            }
            
            if (apiEndpoints.length > 0) {
              structure.apiEndpoints = apiEndpoints;
            }
          }
        } catch (error) {
          console.error("Error fetching API details:", error);
        }
      }
      
      return structure;
    } catch (error) {
      console.error("Error getting docs structure:", error);
      // Return a minimal structure if we encounter an error
      return {
        title: "ElevenLabs Documentation",
        error: String(error)
      };
    }
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
          
          case "elevenlabs_get_docs_structure": {
            const args = request.params.arguments as unknown as GetDocsStructureArgs;
            const includeApiDetails = args.includeApiDetails || false;
            
            const structure = await elevenLabsClient.getDocsStructure(includeApiDetails);
            
            return {
              content: [{ type: "text", text: JSON.stringify({ structure }) }],
            };
          }
          
          case "elevenlabs_list_repository_path": {
            const args = request.params.arguments as unknown as ListRepositoryPathArgs;
            if (!args.path) {
              throw new Error("Missing required argument: path");
            }
            
            const depth = args.depth || 1;
            const recursive = depth > 1;
            
            // If path doesn't start with fern, we'll assume it's a repository-relative path
            const path = args.path === "" ? "fern" : args.path;
            
            const contents = await elevenLabsClient.listContents(path, recursive, depth);
            
            // Process contents into a more useful format
            const processedContents = Array.isArray(contents) 
              ? contents.map((item: any) => ({
                name: item.name,
                type: item.type,
                path: item.path,
                url: item.html_url,
              }))
              : [{ 
                name: contents.name,
                type: contents.type,
                path: contents.path,
                url: contents.html_url,
              }];
            
            return {
              content: [{ type: "text", text: JSON.stringify({ contents: processedContents }) }],
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
            
            // First try to get structure from docs.yml to find the right API reference
            try {
              const structure = await elevenLabsClient.getDocsStructure(true);
              
              // Look for a matching API in the structure
              let apiPath = null;
              let apiDetails = null;
              
              for (const section of structure.sections) {
                for (const page of section.pages) {
                  if (page.type === 'api' && page.apiDetails &&
                      page.apiDetails.paths && page.apiDetails.paths[args.endpoint]) {
                    apiPath = `fern/apis/${page.api}`;
                    apiDetails = page.apiDetails.paths[args.endpoint];
                    break;
                  }
                }
                if (apiPath) break;
              }
              
              if (apiPath && apiDetails) {
                return {
                  content: [{ 
                    type: "text", 
                    text: JSON.stringify({
                      endpoint: args.endpoint,
                      apiPath,
                      reference: apiDetails
                    }) 
                  }],
                };
              }
            } catch (error) {
              console.error("Error finding API reference in docs structure:", error);
              // Fall back to search method if structure parsing fails
            }
            
            // Fall back to search-based method
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
        getDocsStructureTool,
        listRepositoryPathTool,
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
