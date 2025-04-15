#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { allTools } from "./tools/definitions.js";
import { ElevenLabsClient } from "./services/ElevenLabsClient.js";
import { handleToolRequest } from "./handlers/index.js";

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;

  console.log("Starting ElevenLabs MCP Server...");
  const server = new Server(
    {
      name: "ElevenLabs MCP Server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  const elevenLabsClient = new ElevenLabsClient(githubToken);

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      console.log("Received CallToolRequest:", request);
      try {
        if (!request.params.arguments) {
          throw new Error("No arguments provided");
        }

        const result = await handleToolRequest(
          request.params.name,
          request.params.arguments,
          elevenLabsClient
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error) {
        console.error("Error executing tool:", error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools,
    };
  });

  const transport = new StdioServerTransport();
  console.log("Connecting server to transport...");
  await server.connect(transport);

  console.log("ElevenLabs MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
