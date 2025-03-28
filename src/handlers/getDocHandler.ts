import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { GetDocArgs } from "../types/interfaces.js";

export async function handleGetDoc(
  client: ElevenLabsClient,
  args: GetDocArgs
): Promise<any> {
  if (!args.path) {
    throw new Error("Missing required argument: path");
  }
  
  // If path doesn't include fern directory, add it
  const fullPath = args.path.startsWith("fern/") 
    ? args.path 
    : `fern/${args.path}`;
    
  const content = await client.getFileContent(fullPath);
  
  // Process content based on file type
  let processedContent;
  if (fullPath.endsWith('.yaml') || fullPath.endsWith('.yml')) {
    processedContent = await client.processYaml(content);
  } else {
    processedContent = { raw: content };
  }
  
  return processedContent;
} 