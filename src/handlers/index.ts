import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { handleSearchDocs } from "./searchDocsHandler.js";
import { handleGetDoc } from "./getDocHandler.js";
import { handleGetDocsStructure } from "./getDocsStructureHandler.js";
import { handleListRepositoryPath } from "./listRepositoryPathHandler.js";
import { handleListApiEndpoints } from "./listApiEndpointsHandler.js";
import { handleGetApiReference } from "./getApiReferenceHandler.js";

export {
  handleSearchDocs,
  handleGetDoc,
  handleGetDocsStructure,
  handleListRepositoryPath,
  handleListApiEndpoints,
  handleGetApiReference,
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
    case "elevenlabs_get_docs_structure":
      return handleGetDocsStructure(client, args);
    case "elevenlabs_list_repository_path":
      return handleListRepositoryPath(client, args);
    case "elevenlabs_list_api_endpoints":
      return handleListApiEndpoints(client, args);
    case "elevenlabs_get_api_reference":
      return handleGetApiReference(client, args);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
} 