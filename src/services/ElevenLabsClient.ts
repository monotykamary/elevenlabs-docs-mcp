import * as yaml from 'js-yaml';

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