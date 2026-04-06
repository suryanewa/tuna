/**
 * MCP Server tool registration.
 *
 * Exposes tools that AI agents (Claude Code, Cursor) can call
 * to inspect the current selection, get pending changes, etc.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync } from "fs";
import { join } from "path";
import type { Bridge } from "./bridge.js";
import { MANIFEST_PROMPT, MANIFEST_COMPONENTS_PROMPT } from "../manifest/prompts.js";

/** Check manifest status in the project directory */
function checkManifest(): { exists: boolean; hasComponents: boolean; prompt: string | null } {
  const publicDirs = ["public", "static", "dist"];
  for (const dir of publicDirs) {
    const path = join(process.cwd(), dir, "retune.manifest.json");
    if (existsSync(path)) {
      try {
        const data = JSON.parse(require("fs").readFileSync(path, "utf-8"));
        if (data && !("components" in data)) {
          return { exists: true, hasComponents: false, prompt: MANIFEST_COMPONENTS_PROMPT };
        }
        // Check manifest version — v1 manifests should be regenerated
        if (data && (!data.version || data.version < 2)) {
          return { exists: true, hasComponents: true, prompt: `Your retune.manifest.json is version ${data.version || 1}. Regenerate it with the latest format (version 2) for better component filtering, conditional prop visibility (hidden_unless), and designer-focused prop selection.\n\n${MANIFEST_PROMPT}` };
        }
        return { exists: true, hasComponents: true, prompt: null };
      } catch {
        return { exists: true, hasComponents: false, prompt: null };
      }
    }
  }
  return { exists: false, hasComponents: false, prompt: MANIFEST_PROMPT };
}

/** Prepend manifest nudge to tool response text if manifest is missing/incomplete */
function withManifestNudge(text: string): string {
  const status = checkManifest();
  if (!status.prompt) return text;

  const label = status.exists
    ? "⚠ retune.manifest.json is missing component definitions."
    : "⚠ No retune.manifest.json found. Generate one for more accurate token pickers, scope targeting, and component controls.";

  return `${label}\n\nTo generate it, follow these instructions:\n\n${status.prompt}\n\nAfter writing the manifest, call \`retune_manifest_loaded\` to notify the overlay.\n\n---\n\n${text}`;
}

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
    "Get all pending visual changes made in the Retune overlay. Returns a list of elements with their before/after style diffs. Shorthand properties (padding, margin, border-radius, etc.) are collapsed when all sides share the same value. Set enriched=true to include token/class/variable candidates per property.",
    {
      enriched: z.boolean().optional()
        .describe("Include token/class/variable candidates and specificity context per property. Default: false."),
    },
    async ({ enriched }) => {
      try {
        const requestType = enriched ? "getEnrichedChanges" : "getCollapsedChanges";
        const changes = await bridge.request(requestType);
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
        return { content: [{ type: "text", text: withManifestNudge(output) }] };
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
    "retune_manifest_loaded",
    "Notify the Retune overlay that a retune.manifest.json file has been generated or updated. Call this after writing the manifest file so the overlay can load it immediately without waiting. The overlay will re-fetch the manifest and update its token pickers, component controls, and scope targeting.",
    {},
    async () => {
      try {
        await bridge.request("reloadManifest");
        return { content: [{ type: "text", text: "Manifest reloaded. The Retune overlay has updated its token pickers and component controls." }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}. Is the Retune overlay active in the browser?` }] };
      }
    }
  );

  server.tool(
    "retune_get_comments",
    "Get all comments/annotations left by the user on elements or areas. Comments describe intent, feedback, or instructions that complement visual changes. Each comment includes the target element's selector/component info or area bounding box.",
    {
      clear: z.boolean().optional()
        .describe("Whether to clear comments after retrieval. Default: false."),
    },
    async ({ clear }) => {
      try {
        const comments = await bridge.request("getComments");
        if (!comments || comments.length === 0) {
          return { content: [{ type: "text", text: "No comments." }] };
        }
        if (clear) {
          await bridge.request("clearComments");
        }
        return { content: [{ type: "text", text: JSON.stringify(comments, null, 2) }] };
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
      const statusText = bridge.connected
        ? "Retune overlay is connected and active."
        : "Retune overlay is not connected. Make sure the overlay is running in the browser.";
      return {
        content: [{
          type: "text",
          text: withManifestNudge(statusText),
        }],
      };
    }
  );

  return server;
}
