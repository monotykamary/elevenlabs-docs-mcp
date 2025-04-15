Okay, you're building an **ETL** pipeline within your **Docker** build process, likely orchestrated via **GitHub Actions**, to convert **ElevenLabs** docs (**OpenAPI JSON**, **Markdown/MDX**) from a **Git submodule** into **Parquet** files. These files will then be queried by your **MCP server** using the `@duckdb/node-api` client you provided documentation for. Solid plan. Let's outline the steps and code structure needed. Hand this off to another LLM to flesh out the implementation details.

**Objective:** Generate Node.js code snippets and instructions for an LLM to build this ETL pipeline.

**Assumptions:**
* Running within a Docker build environment.
* Input docs are in a Git submodule at a known path.
* Target output is one or more Parquet files.
* `@duckdb/node-api` is available, but other libraries (like Markdown parsers or direct Parquet writers) might be needed.

---

**Instructions for Implementation LLM:**

**Phase 1: Environment & Setup (Dockerfile / GitHub Action)**

* **Instruction:** Define the build environment setup.
* **Details:**
    1.  In your `Dockerfile` or GitHub Action workflow YAML, ensure you check out the main repository.
    2.  Crucially, initialize and update the Git submodule containing the documentation: `git submodule update --init --recursive`.
    3.  Install **Node.js**.
    4.  Install required Node.js packages via `npm install`. This must include `@duckdb/node-api` and likely a Markdown parser (`remark`, `marked`, etc.). Consider if a direct Parquet writer (`parquetjs-lite`) is needed as an alternative (see Phase 4).
* **Note:** No code snippet needed here, this is configuration for the build environment.

**Phase 2: Parse OpenAPI/JSON Files**

* **Instruction:** Implement Node.js code to find and parse `openapi.json` files.
* **Details:** Use Node.js `fs` module (promises API) to recursively scan the submodule directory for files matching the OpenAPI JSON pattern. Parse the JSON content. Extract the essential API details – paths, methods, parameters, descriptions, schemas. Structure this into a flat array of JavaScript objects. Each object represents a queryable piece of information (e.g., an endpoint parameter, an operation summary).
* **Snippet Placeholder (Implement This):**
    ```javascript
    // File: ./etl-scripts/parse-openapi.js (Example path)
    const fs = require('fs').promises;
    const path = require('path');

    /**
     * Finds files matching a regex pattern recursively.
     * @param {string} dir - Directory to search.
     * @param {RegExp} pattern - Regex pattern to match file names.
     * @returns {Promise<string[]>} - Array of matching file paths.
     */
    async function findFiles(dir, pattern) {
        // LLM: Implement recursive file search logic here
        let results = [];
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of list) {
            const fullPath = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                results = results.concat(await findFiles(fullPath, pattern));
            } else if (pattern.test(dirent.name)) {
                results.push(fullPath);
            }
        }
        return results;
    }

    /**
     * Parses OpenAPI JSON files found within a directory.
     * @param {string} basePath - Path to the documentation submodule root.
     * @returns {Promise<object[]>} - Array of structured data extracted from OpenAPI specs.
     */
    async function parseOpenApiFiles(basePath) {
        console.log('Parsing OpenAPI files...');
        const apiData = [];
        const files = await findFiles(basePath, /\.openapi\.json$/i); // Adjust pattern if needed

        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const spec = JSON.parse(content);

                // LLM: Implement extraction logic here.
                // Iterate through spec.paths, spec.components.schemas, etc.
                // Flatten the structure into meaningful rows. For example:
                for (const apiPath in spec.paths) {
                    for (const method in spec.paths[apiPath]) {
                         const operation = spec.paths[apiPath][method];
                         apiData.push({
                             filePath: path.relative(basePath, file),
                             path: apiPath,
                             method: method.toUpperCase(),
                             summary: operation.summary || '',
                             description: operation.description || '',
                             // Add more fields: parameters, responses, tags etc.
                         });
                         // LLM: Add detailed parameter extraction, response schema info, etc.
                    }
                }
                console.log(`Successfully parsed: ${file}`);
            } catch (error) {
                console.error(`Failed to parse ${file}:`, error);
            }
        }
        console.log(`Finished parsing OpenAPI files. Found ${apiData.length} operations/items.`);
        return apiData;
    }

    module.exports = { parseOpenApiFiles, findFiles };
    ```

**Phase 3: Parse Markdown/MDX Files**

* **Instruction:** Implement Node.js code to find and parse Markdown/MDX files, extracting structured content.
* **Details:** This is tricky. Use `fs` to find `.md`/`.mdx` files. Employ a robust Markdown parser that provides an **Abstract Syntax Tree (AST)**, like `remark`. Traverse the AST to identify headings, paragraphs, code blocks (capturing the language identifier if present), lists, etc. Try to maintain context – associate content blocks with their parent headings. Structure this into a flat array of objects suitable for querying (e.g., `filePath`, `headingLevel1`, `headingLevel2`, `contentType`, `content`).
* **Snippet Placeholder (Implement This):**
    ```javascript
    // File: ./etl-scripts/parse-markdown.js (Example path)
    const fs = require('fs').promises;
    const path = require('path');
    // LLM: Choose and import a suitable Markdown AST parser (e.g., remark and plugins)
    // const { unified } = require('unified');
    // const remarkParse = require('remark-parse');
    // const { visit } = require('unist-util-visit'); // Utility for traversing AST

    /**
     * Parses Markdown/MDX files found within a directory into structured data.
     * @param {string} basePath - Path to the documentation submodule root.
     * @param {function} findFiles - Re-use findFiles from parse-openapi.js.
     * @returns {Promise<object[]>} - Array of structured data extracted from Markdown files.
     */
    async function parseMarkdownFiles(basePath, findFiles) {
        console.log('Parsing Markdown files...');
        const markdownData = [];
        const files = await findFiles(basePath, /\.(md|mdx)$/i);
        // LLM: Initialize the chosen Markdown parser (e.g., const parser = unified().use(remarkParse);)

        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const ast = parser.parse(content); // Generate the AST

                // LLM: Implement AST traversal logic here.
                // Use 'visit' or similar function to walk the tree.
                // Keep track of current headings (H1, H2, etc.).
                // For each content node (paragraph, code, list, etc.), create an object
                // containing file path, current heading context, content type, and the content itself.
                // Example structure for an entry:
                // {
                //     filePath: path.relative(basePath, file),
                //     heading1: 'Current H1 Text',
                //     heading2: 'Current H2 Text',
                //     contentType: 'code', // 'paragraph', 'list_item', etc.
                //     language: 'javascript', // If contentType is 'code'
                //     content: 'Actual text or code content'
                // }
                // Push these structured objects into the markdownData array.

                console.log(`Successfully parsed: ${file}`);
            } catch (error) {
                console.error(`Failed to parse ${file}:`, error);
            }
        }
        console.log(`Finished parsing Markdown files. Found ${markdownData.length} content blocks.`);
        return markdownData;
    }

    module.exports = { parseMarkdownFiles };
    ```

**Phase 4: Transform & Write to Parquet**

* **Instruction:** Take the JavaScript arrays from Phases 2 & 3 and write them into Parquet files.
* **Details:** Use the `@duckdb/node-api`. The most robust way within DuckDB is likely:
    1.  Create an in-memory database instance (`:memory:`).
    2.  `CREATE OR REPLACE TABLE` statements defining the schemas for your API data and Markdown data.
    3.  Insert the data from your JavaScript arrays into these tables. Use **prepared statements** for efficiency, especially for larger datasets. Handle DuckDB data types carefully (mapping JS types like string, number, boolean, and potentially nested objects/arrays if your schema uses them).
    4.  Use the `COPY table_name TO 'output_file.parquet' (FORMAT PARQUET);` SQL command to serialize the tables to Parquet files.
    5.  Place the output Parquet files in a designated directory (e.g., `/app/data/` within the Docker image).
* **Alternative:** If direct Parquet writing is preferred or inserting via DuckDB proves cumbersome, investigate Node.js libraries like `parquetjs-lite` or Apache Arrow bindings (`arrow-js`) to directly serialize the JS arrays to Parquet. This might require careful schema definition matching what DuckDB expects. *Prioritize the DuckDB `COPY TO` method first as it leverages the provided client.*
* **Snippet Placeholder (Implement This - Using DuckDB `COPY TO`):**
    ```javascript
    // File: ./etl-scripts/write-parquet.js (Example path)
    const duckdb = require('@duckdb/node-api');
    const path = require('path');

    /**
     * Writes structured data to a Parquet file via an in-memory DuckDB instance.
     * @param {object[]} data - Array of data objects.
     * @param {string} tableName - Name for the temporary SQL table.
     * @param {string} createTableSql - SQL statement to create the table.
     * @param {string[]} columns - Ordered list of column names matching data object keys and CREATE TABLE statement.
     * @param {string} outputParquetPath - Full path for the output Parquet file.
     * @param {duckdb.Connection} connection - Active DuckDB connection.
     */
    async function writeDataToParquet(data, tableName, createTableSql, columns, outputParquetPath, connection) {
        if (data.length === 0) {
            console.warn(`No data provided for ${tableName}, skipping Parquet generation.`);
            return;
        }
        console.log(`Writing data to ${outputParquetPath} via table ${tableName}...`);
        try {
            // 1. Create the table
            await connection.run(`DROP TABLE IF EXISTS ${tableName};`);
            await connection.run(createTableSql);
            console.log(`Table ${tableName} created.`);

            // 2. Prepare insert statement
            const placeholders = columns.map(() => '?').join(',');
            const insertSql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;
            const stmt = await connection.prepare(insertSql);
            console.log(`Prepared insert statement for ${tableName}.`);

            // 3. Insert data (row by row for simplicity, batching is better for performance)
            // LLM: Implement robust data type handling based on target schema
            for (const row of data) {
                const values = columns.map(col => row[col] === undefined ? null : row[col]);
                 try {
                    await stmt.run(...values); // Spread values as arguments
                 } catch(insertError) {
                     console.error(`Error inserting row into ${tableName}:`, row, insertError);
                     // Decide: skip row or fail build?
                 }
            }
            await stmt.finalize();
            console.log(`Data inserted into ${tableName}.`);

            // 4. Export to Parquet
            await connection.run(`COPY ${tableName} TO '${outputParquetPath}' (FORMAT PARQUET);`);
            console.log(`Successfully wrote ${outputParquetPath}`);

        } catch (error) {
            console.error(`Failed to write Parquet file ${outputParquetPath}:`, error);
            throw error; // Fail the build if Parquet writing fails
        }
    }

    module.exports = { writeDataToParquet };

    // --- Main ETL script ---
    // File: ./run-etl.js (Example)
    const path = require('path');
    const duckdb = require('@duckdb/node-api');
    const { parseOpenApiFiles, findFiles } = require('./etl-scripts/parse-openapi');
    const { parseMarkdownFiles } = require('./etl-scripts/parse-markdown');
    const { writeDataToParquet } = require('./etl-scripts/write-parquet');

    async function runETL() {
        const submodulePath = process.env.DOCS_SUBMODULE_PATH || path.resolve(__dirname, 'docs-repo'); // Get path from env or default
        const outputDir = process.env.PARQUET_OUTPUT_DIR || path.resolve(__dirname, 'data'); // Get path from env or default

        await require('fs').promises.mkdir(outputDir, { recursive: true });

        const db = new duckdb.Database(':memory:');
        const connection = await db.connect();
        console.log('DuckDB connection established.');

        try {
            // --- Process OpenAPI ---
            const apiData = await parseOpenApiFiles(submodulePath);
            // LLM: Define the precise CREATE TABLE SQL and column order for api_spec
            const apiCreateTableSql = `CREATE OR REPLACE TABLE api_spec (
                filePath VARCHAR, path VARCHAR, method VARCHAR, summary VARCHAR, description VARCHAR
                -- Add more columns as extracted...
            );`;
            const apiColumns = ['filePath', 'path', 'method', 'summary', 'description' /*,... */];
            await writeDataToParquet(apiData, 'api_spec', apiCreateTableSql, apiColumns, path.join(outputDir, 'api_spec.parquet'), connection);

            // --- Process Markdown ---
            const markdownData = await parseMarkdownFiles(submodulePath, findFiles);
             // LLM: Define the precise CREATE TABLE SQL and column order for docs_content
            const mdCreateTableSql = `CREATE OR REPLACE TABLE docs_content (
                filePath VARCHAR, heading1 VARCHAR, heading2 VARCHAR, contentType VARCHAR, language VARCHAR, content VARCHAR
                -- Add more columns as extracted...
            );`;
            const mdColumns = ['filePath', 'heading1', 'heading2', 'contentType', 'language', 'content' /*,... */];
            await writeDataToParquet(markdownData, 'docs_content', mdCreateTableSql, mdColumns, path.join(outputDir, 'docs_content.parquet'), connection);

            console.log('ETL process completed successfully.');

        } catch (error) {
            console.error('ETL process failed:', error);
            process.exit(1); // Ensure build fails on error
        } finally {
            await connection.close();
            await db.close();
            console.log('DuckDB connection closed.');
        }
    }

    runETL();
    ```

**Phase 5: Dockerfile Integration**

* **Instruction:** Execute the main ETL script during the Docker build.
* **Details:** In your `Dockerfile`, *after* the submodule checkout and `npm install` steps, add:
    ```dockerfile
    # Set environment variables for paths if needed
    ENV DOCS_SUBMODULE_PATH=/app/docs-repo
    ENV PARQUET_OUTPUT_DIR=/app/data

    # Copy your ETL scripts into the image
    COPY ./etl-scripts /app/etl-scripts
    COPY ./run-etl.js /app/run-etl.js

    # Run the ETL process
    RUN node /app/run-etl.js

    # Ensure the rest of your application setup follows,
    # and the /app/data directory is accessible by the server.
    ```

**Phase 6: MCP Server Usage (Conceptual)**

* **Instruction:** Note how the server will use the generated files.
* **Details:** The MCP server application, also using `@duckdb/node-api`, will run queries against the generated Parquet files. Example SQL within the Node.js server code:
    ```sql
    SELECT api.path, api.method, api.summary, docs.content
    FROM read_parquet('/app/data/api_spec.parquet') AS api
    JOIN read_parquet('/app/data/docs_content.parquet') AS docs
      ON api.filePath = docs.filePath /* Or some other relevant join key */
    WHERE api.summary ILIKE '%some keyword%' OR docs.content ILIKE '%some keyword%';
    ```
    The server connects to its own DuckDB instance (likely in-memory) and uses `read_parquet()` to access the data built into the Docker image.

---

This detailed breakdown provides the structure and conceptual code. The LLM's task is to fill in the specific parsing logic (especially for Markdown AST traversal) and the exact `CREATE TABLE` schemas based on the desired queryable fields. Emphasize robust error handling during parsing and insertion. Good luck!