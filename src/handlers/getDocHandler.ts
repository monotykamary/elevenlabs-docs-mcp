import { DuckDBService } from "../services/DuckDBService.js"; // Changed import
import { GetDocArgs } from "../types/interfaces.js";
import fs from 'fs/promises'; // Import fs for file reading
import path from 'path'; // Import path for resolving

// Changed client to service: DuckDBService and adjusted args order
export async function handleGetDoc(
  args: GetDocArgs,
  service: DuckDBService // Service isn't strictly needed here, but kept for consistency
): Promise<any> {
  if (!args.path) {
    throw new Error("Missing required argument: path");
  }
  
  // If path doesn't include fern directory, add it
  const fullPath = args.path.startsWith("fern/") 
    ? args.path
    : `fern/${args.path}`; // Keep the logic to prepend 'fern/' if needed

  // First, try to get the content from docs_content.parquet using DuckDB
  const sql = `
    SELECT content
    FROM read_parquet(?)
    WHERE filePath = ?
    LIMIT 1;
  `;
  const docsContentPath = service.getDocsContentPath();
  const dbResults = await service.executeQuery(sql, [docsContentPath, fullPath]);

  if (dbResults && dbResults.length > 0 && dbResults[0].content) {
    return { raw: dbResults[0].content };
  }

  // Fallback: Try to read the file from the file system if not found in DuckDB
  const absolutePath = path.resolve('/app/elevenlabs-docs', fullPath);

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return { raw: content };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Document not found: ${fullPath}`);
    }
    throw new Error(`Could not retrieve document: ${fullPath}`);
  }
}
