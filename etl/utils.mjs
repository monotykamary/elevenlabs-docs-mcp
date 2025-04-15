import fs from 'fs/promises';
import path from 'path';

/**
 * Finds files matching a regex pattern recursively.
 * @param {string} dir - Directory to search.
 * @param {RegExp} pattern - Regex pattern to match file names.
 * @param {number} [depth=0] - Current recursion depth (for logging).
 * @param {number} [depth=0] - Current recursion depth (for logging).
 * @param {boolean} [debug=false] - Enable verbose logging.
 * @returns {Promise<string[]>} - Array of matching file paths.
 */
export async function findFiles(dir, pattern, depth = 0, debug = false) { // Add debug flag back
    const indent = '  '.repeat(depth);
    if (debug && depth === 0) console.log(`Starting findFiles in ${dir} for pattern ${pattern}`);
    let results = [];
    try {
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of list) {
            // Use path.join instead of path.resolve for constructing paths
            const fullPath = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
                // Avoid recursing into node_modules or .git directories
                if (dirent.name !== 'node_modules' && dirent.name !== '.git') {
                    if (debug) console.log(`${indent}  Recursing into: ${dirent.name}`); // Log recursion if debug
                    results = results.concat(await findFiles(fullPath, pattern, depth + 1, debug)); // Pass debug flag down
                } else {
                    if (debug) console.log(`${indent}  Skipping directory: ${dirent.name}`);
                }
            } else {
                 if (debug) console.log(`${indent}  Checking file: ${dirent.name} against ${pattern}`); // Log check if debug
                 if (pattern.test(dirent.name)) {
                    if (debug) console.log(`${indent}  +++ Pattern MATCHED: ${dirent.name}`); // Log match if debug
                    results.push(fullPath);
                 }
            }
        }
    } catch (error) {
        // Ignore errors like permission denied for specific directories
        if (error.code !== 'EACCES' && error.code !== 'ENOENT') {
            console.error(`Error reading directory ${dir}:`, error);
        }
    }
    return results;
}
