import { DuckDBService } from "../services/DuckDBService.js"; // Changed import
import { SearchDocsArgs, SearchDocsResultItem } from "../types/interfaces.js"; // Corrected import to SearchDocsResultItem

function extractSnippet(
  content: string,
  query: string
): { snippet: string; section?: string; lineNumber?: number } {
  const lines = content.split(/\r?\n/);
  const lowerQuery = query.toLowerCase();
  let matchLine = -1;

  // Find the first line containing the query (case-insensitive)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lowerQuery)) {
      matchLine = i;
      break;
    }
  }

  // If not found, just return the first few lines
  if (matchLine === -1) {
    return { snippet: lines.slice(0, 3).join('\n') };
  }

  // Only return the matching line as the snippet
  const snippet = lines[matchLine];

  // Try to find the nearest preceding heading (Markdown or YAML)
  let section: string | undefined = undefined;
  for (let i = matchLine; i >= 0; i--) {
    // Markdown heading
    const mdMatch = lines[i].match(/^#+\s+(.*)/);
    if (mdMatch) {
      section = mdMatch[1].trim();
      break;
    }
    // YAML top-level key (for .yml/.yaml)
    const yamlMatch = lines[i].match(/^([a-zA-Z0-9_-]+):\s*$/);
    if (yamlMatch) {
      section = yamlMatch[1].trim();
      break;
    }
  }

  return { snippet, section, lineNumber: matchLine + 1 };
}

// Changed client to service: DuckDBService and adjusted args order
export async function handleSearchDocs(
  args: SearchDocsArgs,
  service: DuckDBService
): Promise<any> { // Keep Promise<any> for now, refine later if needed
  if (!args.query) {
    throw new Error("Missing required argument: query");
  }

  const { query, limit = 10 } = args; // Use args from tool definition
  const fuzzyThreshold = 2; // Lower threshold for per-word fuzzy matching

  // Optimization: If the query looks like an exact model/schema name, do a direct lookup
  // e.g., "UpdatePhoneNumberRequest" or "GetPhoneNumberResponseModel"
  const isExactSchemaQuery = /^[A-Z][A-Za-z0-9_]+(Request|Response|Model)?$/.test(query);

  if (isExactSchemaQuery) {
    // Enhanced: Search summary, fileName, schemaDefinition, and content for exact or partial matches
    const sql = `
      SELECT
        filePath,
        fileName,
        content,
        lineNumber,
        'api' as sourceType,
        summary,
        description,
        apiPath,
        method,
        schemaDefinition,
        NULL as heading1,
        NULL as heading2,
        NULL as heading3,
        NULL as contentType,
        NULL as language
      FROM read_parquet(?)
      WHERE
        summary = ?
        OR fileName = ?
        OR lower(summary) LIKE lower(?)
        OR lower(fileName) LIKE lower(?)
        OR lower(schemaDefinition) LIKE lower(?)
        OR lower(content) LIKE lower(?)
      LIMIT ?;
    `;
    const likePattern = `%${query}%`;
    const params = [
      service.getApiSpecPath(),
      query,
      query,
      likePattern,
      likePattern,
      likePattern,
      likePattern,
      limit
    ];
    const dbResults = await service.executeQuery(sql, params);

    const formattedResults: SearchDocsResultItem[] = dbResults.map((row: any) => {
      let section: string | undefined = row.apiPath ? `${row.apiPath} (${row.method})` : row.summary;
      const snippetObj = extractSnippet(row.content, query);
      let snippet = snippetObj.snippet;
      let lineNumber: number | undefined = row.lineNumber;
      if (snippetObj.lineNumber) lineNumber = snippetObj.lineNumber;
      if (snippetObj.section) section = snippetObj.section;

      const result: any = {
        name: row.fileName,
        path: row.filePath,
        repository: "elevenlabs/elevenlabs-docs",
        url: `https://github.com/elevenlabs/elevenlabs-docs/blob/main/${row.filePath}`,
        snippet,
        section: section || undefined,
        lineNumber,
      };
      // Attach schemaDefinition if present
      if (row.schemaDefinition) {
        result.schemaDefinition = row.schemaDefinition;
      }
      return result;
    });

    return { results: formattedResults };
  }

  // Split query into words for multi-word fuzzy search
  const words = query
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  // Build WHERE clause for each word, for each field
  function buildWordClauses(fields: string[]) {
    const clauses: string[] = [];
    for (const word of words) {
      for (const field of fields) {
        clauses.push(`${field} ILIKE ?`);
        clauses.push(`levenshtein(lower(${field}), lower(?)) <= ?`);
      }
    }
    return clauses;
  }

  const apiFields = [
    "content",
    "summary",
    "description",
    "apiPath",
    "method"
  ];
  const mdFields = ["content"];

  const apiClauses = buildWordClauses(apiFields);
  const mdClauses = buildWordClauses(mdFields);

  // Compose the full SQL
  const sql = `
    WITH combined_results AS (
      SELECT
        filePath,
        fileName,
        content,
        lineNumber,
        'api' as sourceType,
        summary,
        description,
        apiPath,
        method,
        NULL as heading1,
        NULL as heading2,
        NULL as heading3,
        NULL as contentType,
        NULL as language
      FROM read_parquet(?)
      WHERE (${apiClauses.join(" OR ")})
      UNION ALL
      SELECT
        filePath,
        fileName,
        content,
        lineNumber,
        'markdown' as sourceType,
        NULL as summary,
        NULL as description,
        NULL as apiPath,
        NULL as method,
        heading1,
        heading2,
        heading3,
        contentType,
        language
      FROM read_parquet(?)
      WHERE (${mdClauses.join(" OR ")})
    )
    SELECT * FROM combined_results
    ORDER BY filePath
    LIMIT ?;
  `;

  // Build params array
  const params: any[] = [];
  params.push(service.getApiSpecPath());
  for (const word of words) {
    for (let i = 0; i < apiFields.length; i++) {
      params.push(`%${word}%`);
      params.push(word);
      params.push(fuzzyThreshold);
    }
  }
  params.push(service.getDocsContentPath());
  for (const word of words) {
    for (let i = 0; i < mdFields.length; i++) {
      params.push(`%${word}%`);
      params.push(word);
      params.push(fuzzyThreshold);
    }
  }
  params.push(limit);

  const dbResults = await service.executeQuery(sql, params);

  // TODO: Implement snippet generation based on linesContext and fullFile.
  // This is more complex now as we don't have the full file content readily available.
  // Option 1: Fetch surrounding rows from Parquet based on filePath and order/lineNumber.
  // Option 2: If fullFile is true, read the original file from /app/elevenlabs-docs using fs.
  // Option 3: Add full file content to Parquet during ETL (increases size).

  // For each result, return either the full file or a snippet with context
  const formattedResults: SearchDocsResultItem[] = dbResults.map((row: any) => {
    let section: string | undefined = undefined;
    let modelName: string | undefined = undefined;
    if (row.sourceType === 'api') {
      // Prefer summary as the model/schema name, fallback to fileName
      modelName = row.summary || row.fileName;
      section = row.apiPath ? `${row.apiPath} (${row.method})` : modelName;
    } else if (row.sourceType === 'markdown') {
      section = [row.heading1, row.heading2, row.heading3].filter(Boolean).join(' > ');
    }

    // Always extract a snippet with context lines
    const snippetObj = extractSnippet(row.content, query);
    let snippet = snippetObj.snippet;
    let lineNumber: number | undefined = row.lineNumber;
    if (snippetObj.lineNumber) lineNumber = snippetObj.lineNumber;
    if (snippetObj.section) section = snippetObj.section;

    // For API spec results, prepend the model/schema name to the snippet for discoverability
    if (row.sourceType === 'api' && modelName) {
      snippet = `Model: ${modelName}\n${snippet}`;
    }

    const result: any = {
      name: row.fileName,
      path: row.filePath,
      repository: "elevenlabs/elevenlabs-docs",
      url: `https://github.com/elevenlabs/elevenlabs-docs/blob/main/${row.filePath}`,
      snippet,
      section: section || undefined,
      lineNumber,
    };
    // Only include fullContent for markdown rows if requested
    if (args.includeFullContent && row.sourceType === 'markdown' && row.fullContent) {
      result.fullContent = row.fullContent;
    }
    return result;
  });

  return { results: formattedResults };
}
