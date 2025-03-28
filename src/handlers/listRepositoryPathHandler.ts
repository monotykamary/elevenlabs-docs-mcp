import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { ListRepositoryPathArgs } from "../types/interfaces.js";

export async function handleListRepositoryPath(
  client: ElevenLabsClient,
  args: ListRepositoryPathArgs
): Promise<any> {
  if (!args.path) {
    throw new Error("Missing required argument: path");
  }
  
  const depth = args.depth || 1;
  const recursive = depth > 1;
  
  // If path doesn't start with fern, we'll assume it's a repository-relative path
  const path = args.path === "" ? "fern" : args.path;
  
  const contents = await client.listContents(path, recursive, depth);
  
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
  
  return { contents: processedContents };
} 