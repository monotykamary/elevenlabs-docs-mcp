import fs from 'fs/promises';
import path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import yaml from 'js-yaml';
import { findFiles } from './utils.mjs';

/**
 * Extracts searchable text content from various parts of an OpenAPI operation.
 * @param {object} operation - The OpenAPI operation object.
 * @returns {string} - Combined text content.
 */
function extractOperationText(operation) {
    let text = [];
    if (operation.summary) text.push(operation.summary);
    if (operation.description) text.push(operation.description);
    if (operation.tags) text.push(...operation.tags);
    if (operation.parameters) {
        operation.parameters.forEach(p => {
            if (p.name) text.push(p.name);
            if (p.description) text.push(p.description);
            // Could potentially drill into p.schema here for more text
        });
    }
    // Could add response descriptions, request body descriptions etc.
    return text.join(' ');
}

/**
 * Parses OpenAPI/AsyncAPI JSON/YAML files found within a directory.
 * @param {string} basePath - Path to the documentation submodule root.
 * @param {boolean} [debug=false] - Enable verbose logging in findFiles. // Added debug flag back to JSDoc
 * @returns {Promise<object[]>} - Array of structured data extracted from API specs.
 */
export async function parseOpenApiFiles(basePath, debug = false) { // Added debug flag parameter back
    console.log('Parsing API specification files...');
    const apiData = [];
    // --- DEBUG: Simplest possible regex - only match openapi.json ---
    const apiPattern = /openapi\.json/i;

    // --- Removed Directory Listing Debug ---
    /*
    const apiDirsToCheck = [ ... ];
    console.log('--- Checking API directories ---');
    ...
    console.log('--- Finished checking API directories ---');
    */
    // ------------------------------------

    // Look for openapi.json, asyncapi.yml, etc. Adjust pattern as needed.
    // Call findFiles passing the received debug flag
    console.log(`Searching for API files in ${basePath} with pattern ${apiPattern}`);
    const files = await findFiles(basePath, apiPattern, 0, debug); // Pass received debug flag

    // Log the results returned by findFiles
    console.log(`findFiles returned ${files.length} file(s):`, files);

    if (files.length === 0) {
        console.warn('No API specification files found matching the pattern.');
    }

    for (const file of files) {
        const relativePath = path.relative(basePath, file);
        const fileName = path.basename(file);
        console.log(`Attempting to parse: ${relativePath}`);
        try {
            // Dereference resolves $refs and provides a single spec object
            // It handles both JSON and YAML automatically
            const spec = await SwaggerParser.dereference(file);
            console.log(`Successfully dereferenced: ${relativePath}`);

            // --- Extract Path/Operation Data ---
            if (spec.paths) {
                for (const apiPath in spec.paths) {
                    for (const method in spec.paths[apiPath]) {
                        const operation = spec.paths[apiPath][method];
                        const content = extractOperationText(operation);
                        apiData.push({
                            filePath: relativePath,
                            fileName: fileName,
                            type: 'api', // Indicate source type
                            apiPath: apiPath,
                            method: method.toUpperCase(),
                            summary: operation.summary || null,
                            description: operation.description || null,
                            // Add more specific fields if needed later
                            content: content, // Combined searchable text
                            lineNumber: null, // Line numbers are hard to get accurately from parsed structure
                        });
                    }
                }
            }

            // --- Extract Component Schema Data (Example) ---
            // You might want separate entries or enrich the path entries
            if (spec.components && spec.components.schemas) {
                 for (const schemaName in spec.components.schemas) {
                     const schema = spec.components.schemas[schemaName];
                     // Example: Add schema descriptions to searchable content
                     // This could be a separate entry or merged somehow
                     // Avoid duplicate content like "ModelName ModelName"
                     let content = '';
                     if (schema.title && schema.title !== schemaName) {
                         content = `${schema.title} ${schema.description || ''}`;
                     } else {
                         content = schema.description || '';
                     }
                     apiData.push({
                         filePath: relativePath,
                         fileName: fileName,
                         type: 'schema',
                         apiPath: null, // Or link to paths using this schema
                         method: null,
                         summary: schema.title || schemaName,
                         description: schema.description || null,
                         content: content.trim(),
                         lineNumber: null,
                         schemaDefinition: JSON.stringify(schema, null, 2), // Add full schema definition
                     });
                 }
            }

            // Add extraction for AsyncAPI channels if needed

        } catch (error) {
            console.error(`Failed to parse or process ${relativePath}:`, error.message);
            // Optionally log the full error: console.error(error);
        }
    }
    console.log(`Finished parsing API files. Found ${apiData.length} items (operations, schemas, etc.).`);
    return apiData;
}
