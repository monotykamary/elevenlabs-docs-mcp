// Type definitions for tool arguments
export interface SearchDocsArgs {
  query: string;
  limit?: number;
}

export interface GetDocArgs {
  path: string;
}

export interface ListApiEndpointsArgs {
  category?: string;
  limit?: number;
}

export interface GetApiReferenceArgs {
  endpoint: string;
}

export interface GetDocsStructureArgs {
  includeApiDetails?: boolean;
}

export interface ListRepositoryPathArgs {
  path: string;
  depth?: number;
} 