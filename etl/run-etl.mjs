import path from 'path';
import fs from 'fs/promises';
// Correct import for the newer API
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { parseOpenApiFiles } from './parse-openapi.mjs';
import { parseMarkdownFiles } from './parse-markdown.mjs';
import { writeDataToParquet } from './write-parquet.mjs';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runETL() {
    console.log('Starting ETL process...');

    // Determine paths
    // Assumes 'elevenlabs-docs' submodule is at the project root alongside 'etl'
    const submodulePath = process.env.DOCS_SUBMODULE_PATH || path.resolve(__dirname, '../elevenlabs-docs');
    const outputDir = process.env.PARQUET_OUTPUT_DIR || path.resolve(__dirname, '../data'); // Output dir relative to project root

    console.log(`Using submodule path: ${submodulePath}`);
    console.log(`Using output directory: ${outputDir}`);

    // Ensure output directory exists
    try {
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`Output directory ${outputDir} ensured.`);
    } catch (error) {
        console.error(`Failed to create output directory ${outputDir}:`, error);
        process.exit(1);
    }

    // Initialize DuckDB using the correct classes
    let instance; // DuckDBInstance
    let connection; // DuckDBConnection

    try {
        instance = await DuckDBInstance.create(':memory:');
        connection = await instance.connect();
        console.log('DuckDB in-memory connection established.');

        // --- Define Schemas ---

        // API Spec Schema
        const apiTableName = 'api_spec';
        const apiCreateTableSql = `
            CREATE OR REPLACE TABLE ${apiTableName} (
                filePath VARCHAR,
                fileName VARCHAR,
                type VARCHAR,
                apiPath VARCHAR,
                method VARCHAR,
                summary VARCHAR,
                description VARCHAR,
                content VARCHAR,
                lineNumber INTEGER,
                schemaDefinition VARCHAR
            );`;
        const apiColumns = ['filePath', 'fileName', 'type', 'apiPath', 'method', 'summary', 'description', 'content', 'lineNumber', 'schemaDefinition'];
        const apiParquetPath = path.join(outputDir, 'api_spec.parquet');

        // --- DEBUG: Simplified Markdown Content Schema (Commented out) ---
        /*
        const mdTableName_debug = 'docs_content_debug';
        const mdCreateTableSql_debug = `
            CREATE OR REPLACE TABLE ${mdTableName_debug} (
                filePath VARCHAR,
                content VARCHAR
            );`;
        const mdColumns_debug = ['filePath', 'content'];
        const mdParquetPath_debug = path.join(outputDir, 'docs_content_debug.parquet');
        */

        // --- Original Markdown Content Schema (Re-enabled) ---
        const mdTableName = 'docs_content';
        const mdCreateTableSql = `
            CREATE OR REPLACE TABLE ${mdTableName} (
                filePath VARCHAR,
                fileName VARCHAR,
                heading1 VARCHAR,
                heading2 VARCHAR,
                heading3 VARCHAR,
                contentType VARCHAR,
                language VARCHAR,
                content VARCHAR,
                lineNumber INTEGER,
                "order" INTEGER,
                fullContent VARCHAR
            );`; // Use quotes for "order" as it's a reserved keyword
        const mdColumns = ['filePath', 'fileName', 'heading1', 'heading2', 'heading3', 'contentType', 'language', 'content', 'lineNumber', 'order', 'fullContent'];
        const mdParquetPath = path.join(outputDir, 'docs_content.parquet');
        // Removed stray closing comment -> */

        // --- Run Parsing and Writing ---

        // Process OpenAPI/API Specs
        const apiData = await parseOpenApiFiles(submodulePath); // Removed debug flag
        await writeDataToParquet(apiData, apiTableName, apiCreateTableSql, apiColumns, apiParquetPath, connection);

        // Process Markdown/MDX (Using original schema)
        const markdownData = await parseMarkdownFiles(submodulePath);
        await writeDataToParquet(markdownData, mdTableName, mdCreateTableSql, mdColumns, mdParquetPath, connection); // Use original variables

        console.log('ETL process completed successfully.'); // Removed debug message

    } catch (error) {
        console.error('ETL process failed:', error);
        process.exit(1); // Ensure build fails on error
    } finally {
        // Ensure connection and db are closed even if errors occurred
        if (connection) {
            try {
                // Use disconnectSync() instead of close()
                connection.disconnectSync();
                console.log('DuckDB connection disconnected in ETL.');
            } catch (closeError) {
                console.error('Error closing DuckDB connection:', closeError);
            }
        }
        // Instance cleanup (rely on GC as per service logic)
        if (instance) {
            try {
                instance = null; // Release reference
                console.log('DuckDB instance reference released in ETL.');
            } catch (closeError) {
                console.error('Error releasing DuckDB instance reference in ETL:', closeError);
            }
        }
    }
}

// Execute the ETL process
runETL();
