import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { GetDocsStructureArgs } from "../types/interfaces.js";

export async function handleGetDocsStructure(
  client: ElevenLabsClient,
  args: GetDocsStructureArgs
): Promise<any> {
  const includeApiDetails = args.includeApiDetails || false;
  
  const structure = await client.getDocsStructure(includeApiDetails);
  
  return { structure };
} 