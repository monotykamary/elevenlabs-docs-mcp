// Type definitions for tool arguments
export interface SearchDocsArgs {
  query: string;
  limit?: number;
  includeFullContent?: boolean;
  includeSchemaDefinition?: boolean;
}

export interface SearchDocsResultItem {
  name: string;
  path: string;
  repository: string;
  url: string;
  snippet: string;
  section?: string;
}

export interface SearchDocsResult {
  results: SearchDocsResultItem[];
}

export interface GetDocArgs {
  path: string;
}
