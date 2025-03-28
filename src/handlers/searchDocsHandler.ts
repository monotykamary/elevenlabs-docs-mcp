import { ElevenLabsClient } from "../services/ElevenLabsClient.js";
import { SearchDocsArgs } from "../types/interfaces.js";

export async function handleSearchDocs(
  client: ElevenLabsClient,
  args: SearchDocsArgs
): Promise<any> {
  if (!args.query) {
    throw new Error("Missing required argument: query");
  }
  
  const response = await client.searchCode(args.query, args.limit);
  
  // Process search results to make them more useful
  const results = response.items.map((item: any) => ({
    name: item.name,
    path: item.path,
    repository: item.repository.full_name,
    url: item.html_url,
  }));
  
  return { results };
} 