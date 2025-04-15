import { DuckDBService } from "../services/DuckDBService.js"; // Changed import
import { handleSearchDocs } from "./searchDocsHandler.js";
import { handleSearchApiFiles } from "./searchApiFilesHandler.js";

export {
  handleSearchDocs,
};

export async function handleToolRequest(
  toolName: string,
  args: any,
  // Changed client type to DuckDBService
  service: DuckDBService
): Promise<any> {
  switch (toolName) {
    // Pass service instead of client, and args first for consistency if desired (or keep client/service first)
    case "elevenlabs_search_docs":
      return handleSearchDocs(args, service); // Pass service
    case "elevenlabs_search_api_files":
      return handleSearchApiFiles(args, service); // Pass service
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
