/**
 * Composer MCP Server entry point.
 *
 * Starts a WebSocket bridge for the browser overlay and
 * connects to the AI tool via stdio transport.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Bridge } from "./bridge.js";
import { createServer } from "./server.js";

const port = parseInt(process.env.COMPOSER_WS_PORT || "9223", 10);

async function main() {
  // Start WebSocket bridge for browser communication
  const bridge = new Bridge(port);
  await bridge.start();

  // Create MCP server with tools
  const server = createServer(bridge);

  // Connect via stdio for AI tool communication
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[Composer MCP] Server running. Waiting for AI tool connection...");

  // Graceful shutdown
  process.on("SIGINT", () => {
    bridge.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    bridge.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Composer MCP] Fatal error:", err);
  process.exit(1);
});
