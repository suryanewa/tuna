/**
 * Tuna MCP Server CLI.
 *
 * Starts a WebSocket bridge for the browser overlay and
 * connects to the AI tool via stdio transport.
 *
 * Usage:
 *   npx tuna          — start the MCP server
 *   npx tuna setup    — auto-configure MCP + install skill for AI tools
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Bridge } from "./bridge.js";
import { createServer } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = parseInt(process.env.TUNA_WS_PORT || "9223", 10);

/** Auto-sync bundled skill file to installed location on startup */
function syncSkill() {
  // dist/cli.js → ../skill/SKILL.md (package root)
  const bundledPath = join(__dirname, "..", "skill", "SKILL.md");
  if (!existsSync(bundledPath)) return;

  const targets = [
    join(homedir(), ".claude", "skills", "tuna-visual-changes", "SKILL.md"),
    join(homedir(), ".cursor", "skills", "tuna-visual-changes", "SKILL.md"),
  ];

  const bundled = readFileSync(bundledPath, "utf-8");

  for (const target of targets) {
    try {
      if (!existsSync(dirname(target))) continue; // tool not installed
      const installed = existsSync(target) ? readFileSync(target, "utf-8") : "";
      if (installed !== bundled) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, bundled);
        console.error(`[Tuna MCP] Skill synced: ${target}`);
      }
    } catch {
      // Permission error or similar — skip silently
    }
  }
}

async function startServer() {
  // Auto-sync skill file before anything else
  syncSkill();

  // Start WebSocket bridge for browser communication
  const bridge = new Bridge(port);
  await bridge.start();

  // Create MCP server with tools
  const server = createServer(bridge);

  // Connect via stdio for AI tool communication
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[Tuna MCP] Server running. Waiting for AI tool connection...");

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
  console.error("[Tuna MCP] Fatal error:", err);
  process.exit(1);
});
