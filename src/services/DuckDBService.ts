import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises'; // Import fs for checking file existence
import { execSync } from 'child_process'; // Import for running ETL script

// Define the structure of query results if needed, e.g., for search results
// interface SearchResult { ... }

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DuckDBService {
    private instance: DuckDBInstance | null = null;
    private connection: DuckDBConnection | null = null;
    private dbInitialized: Promise<void>; // Promise to track initialization

    // Determine base path for data files
    // Use DATA_DIR env var if set (for Docker), otherwise assume relative to project root for local dev
    private dataBasePath = process.env.DATA_DIR
        ? path.resolve(process.env.DATA_DIR)
        // Assuming dist/src/services when running locally, so go up 3 levels for project root
        : path.resolve(__dirname, '../../../data');

    // Paths to the Parquet files, resolved relative to the base path
    private apiSpecPath: string;
    private docsContentPath: string;


    constructor() {
        this.apiSpecPath = path.join(this.dataBasePath, 'api_spec.parquet');
        this.docsContentPath = path.join(this.dataBasePath, 'docs_content.parquet');
        console.log(`Resolved Parquet paths: API=${this.apiSpecPath}, Docs=${this.docsContentPath}`);
        // Initialize the database asynchronously
        this.dbInitialized = this.initializeDatabase();
    }

    private async initializeDatabase(): Promise<void> {
        try {
            console.log('Initializing DuckDB instance (:memory:)...');
            // Use DuckDBInstance.create() for in-memory DB
            this.instance = await DuckDBInstance.create(':memory:');
            this.connection = await this.instance.connect();
            console.log('DuckDB instance and connection initialized successfully.');

            // Check if running locally and Parquet files are missing, run ETL if needed
            await this.ensureDataFilesExist(); // Re-enabled automatic ETL run

            // Verify Parquet files exist on startup
            await this.verifyParquetFile(this.apiSpecPath, 'api_spec');
            await this.verifyParquetFile(this.docsContentPath, 'docs_content');

        } catch (error) {
            console.error('FATAL: Failed to initialize DuckDB instance:', error);
            // Depending on the application, you might want to exit or prevent requests
            throw new Error('DuckDB initialization failed');
        }
    }

    private async verifyParquetFile(filePath: string, tableName: string): Promise<void> {
        if (!this.connection) {
            throw new Error('DuckDB connection not available for verification.');
        }
        // Removed isClosed check as it doesn't seem to exist
        // if (this.connection.isClosed) { ... }

        try {
            // Simple query to check if the file is readable by DuckDB
            // Use runAndReadAll which returns a reader, then ignore the result
            // Pass parameters as an array
            const reader = await this.connection.runAndReadAll(`SELECT COUNT(*) FROM read_parquet(?) LIMIT 1;`, [filePath]);
            // We don't need the actual count, just that it didn't throw.
            console.log(`Parquet file verified: ${filePath} (for table ${tableName})`);
        } catch (error) {
            console.error(`Error verifying Parquet file ${filePath}:`, error);
            // Decide if this should be fatal
            throw new Error(`Failed to verify or read Parquet file: ${filePath}`);
        }
    }

    // New method to check for data files and run ETL if necessary
    private async ensureDataFilesExist(): Promise<void> {
        // Only run this check/ETL trigger in non-Docker environments (approximated by checking DATA_DIR)
        if (!process.env.DATA_DIR) {
            console.log('Local environment detected. Checking for Parquet files...');
            try {
                await fs.access(this.apiSpecPath, fs.constants.F_OK);
                console.log('Parquet files found.');
            } catch (error) {
                // ENOENT means file doesn't exist
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    console.warn(`Parquet file not found at ${this.apiSpecPath}. Running ETL script...`);
                    try {
                        const projectRoot = path.resolve(__dirname, '../../../');
                        const etlScriptPath = path.join(projectRoot, 'etl/run-etl.mjs');
                        console.log(`Executing: node ${etlScriptPath} in ${projectRoot}`);
                        // Execute synchronously as startup depends on this
                        execSync(`node ${etlScriptPath}`, { cwd: projectRoot, stdio: 'inherit' });
                        console.log('ETL script finished.');
                    } catch (etlError) {
                        console.error('FATAL: Failed to execute ETL script:', etlError);
                        throw new Error('Failed to generate necessary data files via ETL.');
                    }
                } else {
                    // Other fs.access error
                    console.error(`Error checking for Parquet file ${this.apiSpecPath}:`, error);
                    throw new Error(`Failed to check for data file existence.`);
                }
            }
        } else {
             console.log('Docker environment detected (DATA_DIR is set). Assuming Parquet files exist.');
        }
    }

    // Ensure the DB is ready before executing queries
    private async ensureInitialized(): Promise<void> {
        await this.dbInitialized;
        if (!this.connection) {
            throw new Error('DuckDB connection is not available after initialization.');
        }
    }

    /**
     * Executes a SQL query and returns all results.
     * @param sql The SQL query string.
     * @param params Optional parameters for the query.
     * @returns Promise resolving to an array of result objects (Record<string, any>).
     */
    // Changed return type and removed generic <T>
    public async executeQuery(sql: string, params: any[] = []): Promise<Record<string, any>[]> {
        await this.ensureInitialized();
        console.log(`Executing SQL (all rows): ${sql} with params: ${JSON.stringify(params)}`);
        try {
            // Use runAndReadAll to get a reader, then get rows from the reader
            // Pass params as an array
            const reader = await (this.connection!).runAndReadAll(sql, params);
            // Use getRowObjects for a more convenient format [{col: val, ...}]
            // Removed generic <T> from getRowObjects
            const results = reader.getRowObjects();
            console.log(`Query returned ${results.length} rows.`);
            // Cast to 'any' temporarily if strict typing causes issues, or define a proper interface
            return results as any[];
        } catch (error) {
            console.error(`Error executing DuckDB query: ${sql}`, error);
            throw error; // Re-throw the error for upstream handling
        }
    }

    /**
     * Executes a SQL query and returns the first result or null.
     * @param sql The SQL query string.
     * @param params Optional parameters for the query.
     * @returns Promise resolving to the first result object (Record<string, any>) or null.
     */
    // Changed return type and removed generic <T>
    public async executeQueryFirstRow(sql: string, params: any[] = []): Promise<Record<string, any> | null> {
        await this.ensureInitialized();
         console.log(`Executing SQL (first row): ${sql} with params: ${JSON.stringify(params)}`);
        try {
             // Use runAndReadUntil to potentially limit data read, then get the first row
             // Pass params as an array
             const reader = await (this.connection!).runAndReadUntil(sql, 1, params);
             // Removed generic <T> from getRowObjects
             const rows = reader.getRowObjects(); // Get results as objects
             const result = rows.length > 0 ? rows[0] : null;
             console.log(`Query returned ${result ? 'a row' : 'no rows'}.`);
             // Cast to 'any' temporarily if strict typing causes issues
             return result as any | null;
        } catch (error) {
            console.error(`Error executing DuckDB query (first row): ${sql}`, error);
            throw error;
        }
    }


    // Graceful shutdown
    public async close(): Promise<void> {
        console.log('Closing DuckDB connection and instance...');
        // Removed isClosed check
        if (this.connection) {
            try {
                // Use disconnectSync as per docs for explicit closing
                this.connection.disconnectSync();
                this.connection = null;
                console.log('DuckDB connection disconnected.');
            } catch (error) {
                console.error('Error disconnecting DuckDB connection:', error);
            }
        }
        if (this.instance) {
            try {
                // Instance doesn't have an explicit close/terminate in the provided docs for this version
                // Rely on garbage collection or process exit for instance cleanup
                this.instance = null;
                console.log('DuckDB instance reference released.');
            } catch (error) {
                console.error('Error closing DuckDB database instance:', error);
            }
        }
    }

    // --- Getters for file paths ---
    public getApiSpecPath(): string {
        return this.apiSpecPath;
    }

    public getDocsContentPath(): string {
        return this.docsContentPath;
    }
}

// Export a singleton instance (optional, depends on app structure)
// export const duckDBService = new DuckDBService();
