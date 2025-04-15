import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { handleSearchDocs } from "./searchDocsHandler.js";
import { handleGetDoc } from "./getDocHandler.js";

export {
  handleSearchDocs,
  handleGetDoc,
};

export async function handleToolRequest(
  toolName: string,
  args: any,
  client: ElevenLabsClient
): Promise<any> {
  switch (toolName) {
    case "elevenlabs_search_docs":
      return handleSearchDocs(client, args);
    case "elevenlabs_get_doc":
      return handleGetDoc(client, args);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
