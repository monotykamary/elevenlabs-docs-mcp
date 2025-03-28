import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { ListApiEndpointsArgs } from "../types/interfaces.js";

export async function handleListApiEndpoints(
  client: ElevenLabsClient,
  args: ListApiEndpointsArgs
): Promise<any> {
  const limit = args.limit || 20;
  
  let path = "fern/apis";
  if (args.category) {
    path = `fern/apis/${args.category}`;
  }
  
  try {
    const contents = await client.listContents(path);
    
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
    
    return { endpoints };
  } catch (error) {
    // Fall back to searching for all API files if path not found
    console.error(`Error listing contents for ${path}, falling back to search`);
    const searchResponse = await client.searchCode("path:fern/apis", limit);
    
    const endpoints = searchResponse.items
      .filter((item: any) => 
        item.name.endsWith('.yaml') || item.name.endsWith('.yml'))
      .slice(0, limit)
      .map((item: any) => ({
        name: item.name,
        path: item.path,
        url: item.html_url
      }));
      
    return { endpoints };
  }
} 