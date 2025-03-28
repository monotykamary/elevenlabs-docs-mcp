import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { GetApiReferenceArgs } from "../types/interfaces.js";

export async function handleGetApiReference(
  client: ElevenLabsClient,
  args: GetApiReferenceArgs
): Promise<any> {
  if (!args.endpoint) {
    throw new Error("Missing required argument: endpoint");
  }
  
  // First try to get structure from docs.yml to find the right API reference
  try {
    const structure = await client.getDocsStructure(true);
    
    // Look for a matching API in the structure
    let apiPath = null;
    let apiDetails = null;
    
    if (structure.sections) {
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
    }
    
    if (apiPath && apiDetails) {
      return {
        endpoint: args.endpoint,
        apiPath,
        reference: apiDetails
      };
    }
  } catch (error) {
    console.error("Error finding API reference in docs structure:", error);
    // Fall back to search method if structure parsing fails
  }
  
  // Fall back to search-based method
  const query = `${args.endpoint} path:fern/apis`;
  const searchResults = await client.searchCode(query, 5);
  
  if (searchResults.items.length === 0) {
    return { 
      error: `No API reference found for endpoint: ${args.endpoint}`
    };
  }
  
  // Get the most relevant result
  const mostRelevantPath = searchResults.items[0].path;
  const content = await client.getFileContent(mostRelevantPath);
  
  // Process YAML content
  const processedContent = await client.processYaml(content);
  
  return {
    endpoint: args.endpoint,
    reference: processedContent
  };
} 