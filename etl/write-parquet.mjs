import * as duckdb from '@duckdb/node-api'; // Import as namespace
import path from 'path';

/**
 * Writes structured data to a Parquet file via an in-memory DuckDB instance.
 * @param {object[]} data - Array of data objects.
 * @param {string} tableName - Name for the temporary SQL table.
 * @param {string} createTableSql - SQL statement to create the table.
 * @param {string[]} columns - Ordered list of column names matching data object keys and CREATE TABLE statement.
 * @param {string} outputParquetPath - Full path for the output Parquet file.
 * @param {duckdb.DuckDBConnection} connection - Active DuckDB connection (using namespace for type).
 */
export async function writeDataToParquet(data, tableName, createTableSql, columns, outputParquetPath, connection) {
    if (!data || data.length === 0) {
        console.warn(`No data provided for ${tableName}, skipping Parquet generation for ${outputParquetPath}.`);
        return;
    }
    console.log(`Writing ${data.length} rows to ${outputParquetPath} via table ${tableName}...`);

    try {
        // 1. Create the table
        // Use .run() for simple DDL statements
        await connection.run(`DROP TABLE IF EXISTS ${tableName};`);
        await connection.run(createTableSql);
        console.log(`Table ${tableName} created.`);

        // 2. Prepare insert statement
        // Quote column names that are reserved keywords (like "order")
        const quotedColumns = columns.map(col => col === 'order' ? `"${col}"` : col);
        const columnList = quotedColumns.join(',');

        // 3. Insert data row by row using direct INSERT statements (less efficient, but bypasses prepared statement issues)
        console.log(`Inserting data using direct INSERT statements...`);
        let insertedCount = 0;
        for (const row of data) {
            // Explicitly create an object with only the required columns before mapping
            const filteredRowData = {};
            columns.forEach(col => {
                // Ensure the key exists in the original row before assigning
                if (Object.prototype.hasOwnProperty.call(row, col)) {
                    filteredRowData[col] = row[col];
                } else {
                    filteredRowData[col] = null; // Assign null if key is missing in source row
                }
            });

            // Construct the VALUES part of the SQL string, escaping strings
            const valueStrings = columns.map(col => {
                const value = filteredRowData[col];
                if (value === null || value === undefined) {
                    return 'NULL';
                } else if (typeof value === 'string') {
                    // Basic escaping: replace single quotes with two single quotes
                    return `'${value.replace(/'/g, "''")}'`;
                } else if (typeof value === 'number' || typeof value === 'boolean') {
                    return value.toString();
                } else {
                    // Fallback for other types - might need adjustment for complex types
                    console.warn(`Unhandled type for column ${col}: ${typeof value}. Attempting toString().`);
                    return `'${value.toString().replace(/'/g, "''")}'`;
                }
            });

            const insertSqlForRow = `INSERT INTO ${tableName} (${columnList}) VALUES (${valueStrings.join(',')})`;

            try {
                // Execute the direct INSERT statement
                await connection.run(insertSqlForRow);
                insertedCount++;
            } catch (insertError) {
                console.error(`Error inserting row into ${tableName}:`, insertError);
                console.error('Problematic row data:', filteredRowData);
                console.error('Generated SQL:', insertSqlForRow); // Log the generated SQL on error
                // Decide: skip row or fail build? For now, log and continue.
            }
        }
        console.log(`Inserted ${insertedCount}/${data.length} rows into ${tableName}.`);

        // 4. Export to Parquet
        // Ensure the output directory exists (should be handled by run-etl.js, but good practice)
        const outputDir = path.dirname(outputParquetPath);
        // await fs.mkdir(outputDir, { recursive: true }); // fs needs to be imported if used here

        // Use .run() for the COPY statement
        await connection.run(`COPY ${tableName} TO '${outputParquetPath}' (FORMAT PARQUET);`);
        console.log(`Successfully wrote ${outputParquetPath}`);

    } catch (error) {
        console.error(`Failed to write Parquet file ${outputParquetPath}:`, error);
        throw error; // Re-throw error to potentially fail the build process
    }
}
