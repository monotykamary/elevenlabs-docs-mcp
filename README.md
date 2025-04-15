# ElevenLabs Documentation MCP Server

A Model Context Protocol (MCP) server for interacting with [ElevenLabs documentation](https://elevenlabs.io/docs/overview) at [https://github.com/elevenlabs/elevenlabs-docs](https://github.com/elevenlabs/elevenlabs-docs). This server provides tools to access and search ElevenLabs documentation and API spec files directly via the Model Context Protocol.

![alt text](image.png)

## Overview

This MCP server provides tools to access and search ElevenLabs documentation directly from Claude via the Model Context Protocol. It retrieves documentation from the official ElevenLabs documentation repository and provides structured access to API references and guides.

## Available Tools

### elevenlabs_search_docs

Searches indexed ElevenLabs documentation and API spec content (from DuckDB Parquet files: `docs_content.parquet` and `api_spec.parquet`) based on keywords. This tool does **not** open or read large files directly—results are limited to what is present in the indexed data. Returns file name, path, a snippet of matching content, repository, url, line number, and (if available) section/heading for each result.

**Parameters:**
- `query` (string, required): Search query or keywords (applies to content, summary, description, apiPath, method fields)
- `includeFullContent` (boolean, optional, default: false): If true, include the fullContent column (full document text) in results (docs search only)
- `limit` (number, optional, default: 10): Maximum number of results to return
- `includeSchemaDefinition` (boolean, optional, default: false): If true, include the schemaDefinition column (full JSON schema) in results (API spec search only)

**Returns:**  
An array of results with the following fields:
- `name`
- `path`
- `snippet`
- `repository`
- `url`
- `lineNumber`
- `section`
- `fullContent` (if requested)

## Setup

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/monotykamary/elevenlabs-docs-mcp.git
   cd elevenlabs-docs-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run the server:
   ```bash
   node dist/src/index.js
   ```

### Running with Docker

1. Build the Docker image:
   ```bash
   docker build -t elevenlabs-docs-mcp .
   ```

2. Run the container:
   ```bash
   docker run elevenlabs-docs-mcp
   ```

## Usage with Claude Desktop

To use this MCP server with Claude Desktop, add the appropriate configuration to your Claude Desktop settings to launch the Docker container for this server.

```json
{
  "mcpServers": {
    "elevenlabs-docs": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "ghcr.io/monotykamary/elevenlabs-docs-mcp"
      ]
    }
  }
}
```

With this configuration:
1. Claude will automatically start the Docker container when needed.
2. The container will be removed when Claude Desktop is closed.

## Usage Example

```
mcp_elevenlabs_search_docs(query="text to speech tutorial", limit=5, includeFullContent=true)
```

## Troubleshooting

- **File Not Found**: Ensure that the document path is correct and exists in the ElevenLabs documentation repository.
- **Empty Search Results**: Try using more general search terms or check the spelling of your search query.

## License

MIT
