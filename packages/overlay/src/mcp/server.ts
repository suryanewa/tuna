/**
 * MCP Server tool registration.
 *
 * Exposes tools that AI agents (Claude Code, Cursor) can call
 * to inspect the current selection, get pending changes, etc.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Bridge } from "./bridge.js";

export function createServer(bridge: Bridge): McpServer {
  const server = new McpServer({
    name: "retune",
    version: "0.1.0",
  });

  // --- Tools ---

  server.tool(
    "retune_get_selection",
    "Get the currently selected element in the Retune overlay, including its CSS selector, React component hierarchy, computed styles, and layout mode.",
    {},
    async () => {
      try {
        const selection = await bridge.request("getSelection");
        if (!selection) {
          return { content: [{ type: "text", text: "No element is currently selected in the Retune overlay." }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(selection, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}. Is the Retune overlay active in the browser?` }] };
      }
    }
  );

  server.tool(
    "retune_get_pending_changes",
    "Get all pending visual changes made in the Retune overlay. Returns a list of elements with their before/after style diffs. Shorthand properties (padding, margin, border-radius, etc.) are collapsed when all sides share the same value.",
    {},
    async () => {
      try {
        const changes = await bridge.request("getCollapsedChanges");
        if (!changes || changes.length === 0) {
          return { content: [{ type: "text", text: "No pending changes." }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(changes, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
  );

  server.tool(
    "retune_get_formatted_changes",
    "Get pending visual changes formatted as structured markdown, ready to apply to source code. Includes element identification (CSS selector, React component, text content) and exact before/after values for each changed property. Changes are automatically cleared after retrieval unless clear is set to false.",
    {
      fidelity: z.enum(["minimal", "standard", "full"]).optional()
        .describe("Level of context detail. 'minimal' = selector + diffs only. 'standard' = adds component tree and classes. 'full' = adds computed styles, parent layout, siblings. Default: standard."),
      clear: z.boolean().optional()
        .describe("Whether to clear changes after retrieval. Default: true."),
    },
    async ({ fidelity, clear }) => {
      try {
        const output = await bridge.request("getFormattedChanges", { fidelity: fidelity || "standard" });
        if (clear !== false) {
          await bridge.request("clearChanges");
        }
        return { content: [{ type: "text", text: output }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
  );

  server.tool(
    "retune_watch_changes",
    "Wait for new visual changes from the Retune overlay. Blocks until changes are available or timeout (30s). Use this to reactively apply changes as the user makes them.",
    {},
    async () => {
      // Check buffer first
      const buffered = bridge.consumeChanges();
      if (buffered.length > 0) {
        return { content: [{ type: "text", text: JSON.stringify(buffered, null, 2) }] };
      }

      // Wait for new changes (up to 30s)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          bridge.onChanges(() => {});
          resolve({ content: [{ type: "text", text: "No changes received within timeout." }] });
        }, 30000);

        bridge.onChanges((changes) => {
          clearTimeout(timeout);
          bridge.onChanges(() => {});
          resolve({ content: [{ type: "text", text: JSON.stringify(changes, null, 2) }] });
        });
      });
    }
  );

  server.tool(
    "retune_clear_changes",
    "Clear all pending visual changes from the Retune overlay. Call this after you have applied the changes to source code.",
    {},
    async () => {
      try {
        await bridge.request("clearChanges");
        return { content: [{ type: "text", text: "All pending changes have been cleared from the Retune overlay." }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    }
  );

  server.tool(
    "retune_status",
    "Check the status of the Retune overlay connection.",
    {},
    async () => {
      return {
        content: [{
          type: "text",
          text: bridge.connected
            ? "Retune overlay is connected and active."
            : "Retune overlay is not connected. Make sure the overlay is running in the browser.",
        }],
      };
    }
  );

  return server;
}
