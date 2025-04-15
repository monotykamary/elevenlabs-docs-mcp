# ElevenLabs Documentation MCP Server

A Model Context Protocol (MCP) server for interacting with ElevenLabs documentation. This is really a glorified GitHub MCP server point it to their `fern` docs on GitHub.

![alt text](image.png)

## Overview

This MCP server provides tools to access and search ElevenLabs documentation directly from Claude via the Model Context Protocol. It retrieves documentation from the official ElevenLabs documentation repository and provides structured access to API references and guides.

## Available Tools

The server provides the following tools:

1. **elevenlabs_search_docs**: Search ElevenLabs documentation based on keywords.
   - Parameters:
     - `query` (required): Search query or keywords
     - `limit` (optional): Maximum number of results to return (default: 10)

2. **elevenlabs_get_doc**: Get specific ElevenLabs document content by path.
   - Parameters:
     - `path` (required): Document path relative to the fern directory

3. **elevenlabs_get_docs_structure**: Retrieve and parse the docs.yml file to understand the documentation structure.
   - Parameters:
     - `includeApiDetails` (optional): Whether to include detailed API information or just the structure (default: false)

4. **elevenlabs_list_repository_path**: List files and directories at a specific path in the repository.
   - Parameters:
     - `path` (required): Path to list (relative to repository root)
     - `depth` (optional): How many levels deep to traverse (default: 1)

5. **elevenlabs_list_api_endpoints**: List available ElevenLabs API endpoints.
   - Parameters:
     - `category` (optional): API category to filter endpoints
     - `limit` (optional): Maximum number of endpoints to return (default: 20)

6. **elevenlabs_get_api_reference**: Get API reference for a specific ElevenLabs API endpoint.
   - Parameters:
     - `endpoint` (required): API endpoint path (e.g., '/v1/text-to-speech')

## Setup

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mcp-server-elevenlabs.git
   cd mcp-server-elevenlabs
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

### Environment Variables

The server uses the following environment variables:

- `GITHUB_TOKEN` (optional): GitHub personal access token for increased rate limits. If not provided, the server will use unauthenticated GitHub API access with lower rate limits.

### Running with Docker

1. Build the Docker image:
   ```bash
   docker build -t mcp-server-elevenlabs .
   ```

2. Run the container:
   ```bash
   docker run -e GITHUB_TOKEN=your_github_token mcp-server-elevenlabs
   ```

## Usage with Claude Desktop

To use this MCP server with Claude Desktop, add the following configuration to your Claude Desktop settings:

```json
{
  "mcpServers": {
    "elevenlabs-docs": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_TOKEN",
        "ghcr.io/monotykamary/elevenlabs-docs-mcp"
      ],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

With this configuration:
1. Claude will automatically start the Docker container when needed
2. The MCP server will have access to your GitHub token (optional, for higher rate limits)
3. The container will be removed when Claude Desktop is closed

To avoid rate limiting issues with GitHub, it's recommended to provide a GitHub personal access token with at least `public_repo` scope.

## Usage Examples

### Example 1: Searching for Text-to-Speech Documentation

```
mcp_elevenlabs_search_docs(query="text to speech tutorial", limit=5)
```

### Example 2: Getting API Reference for a Specific Endpoint

```
mcp_elevenlabs_get_api_reference(endpoint="/v1/text-to-speech")
```

### Example 3: Getting Documentation Structure

```
mcp_elevenlabs_get_docs_structure(includeApiDetails=false)
```

### Example 4: Exploring Repository Files

```
mcp_elevenlabs_list_repository_path(path="fern/apis", depth=2)
```

## Troubleshooting

- **Rate Limiting**: If you encounter rate limiting issues with the GitHub API, provide a `GITHUB_TOKEN` environment variable.
- **File Not Found**: Ensure that the document path is correct and exists in the ElevenLabs documentation repository.
- **Empty Search Results**: Try using more general search terms or check the spelling of your search query.

## License

MIT
