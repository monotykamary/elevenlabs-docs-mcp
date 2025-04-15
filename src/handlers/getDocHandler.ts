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

  // Construct the absolute path within the container
  // Assumes the submodule is copied to /app/elevenlabs-docs
  const absolutePath = path.resolve('/app/elevenlabs-docs', fullPath);

  console.log(`Attempting to read file: ${absolutePath}`);

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    // Return the raw content, wrapped in an object as before
    return { raw: content };
  } catch (error: any) {
    console.error(`Error reading document ${absolutePath}:`, error);
    if (error.code === 'ENOENT') {
      throw new Error(`Document not found: ${fullPath}`);
    }
    // Re-throw other errors
    throw new Error(`Could not retrieve document: ${fullPath}`);
  }
}
