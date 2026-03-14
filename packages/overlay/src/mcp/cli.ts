/**
 * Retune MCP Server CLI.
 *
 * Starts a WebSocket bridge for the browser overlay and
 * connects to the AI tool via stdio transport.
 *
 * Usage:
 *   npx retune          — start the MCP server
 *   npx retune setup    — auto-configure MCP + install skill for AI tools
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Bridge } from "./bridge.js";
import { createServer } from "./server.js";

const port = parseInt(process.env.RETUNE_WS_PORT || "9223", 10);

async function startServer() {
  // Start WebSocket bridge for browser communication
  const bridge = new Bridge(port);
  await bridge.start();

  // Create MCP server with tools
  const server = createServer(bridge);

  // Connect via stdio for AI tool communication
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[Retune MCP] Server running. Waiting for AI tool connection...");

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

async function main() {
  const command = process.argv[2];

  if (command === "setup") {
    const { setup } = await import("./setup.js");
    await setup();
    return;
  }

  await startServer();
}

main().catch((err) => {
  console.error("[Retune MCP] Fatal error:", err);
  process.exit(1);
});
