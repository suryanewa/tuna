# Retune

Visual devtools that persist changes to source code via AI agents.

Select any element in your running app, tweak its styles visually, and the changes get sent to AI coding tools (Claude Code, Cursor, etc.) to apply as real code changes.

## Quick Start

```bash
npm install retune
```

Add the overlay to your app layout (dev mode only):

```tsx
import { Retune } from "retune";

export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <Retune />}
      </body>
    </html>
  );
}
```

Press **Alt+D** to toggle edit mode, then click any element to start tweaking.

## How It Works

1. **Select** — Click any element in your app to inspect it
2. **Tweak** — Adjust properties with visual controls (sliders, color pickers, etc.)
3. **Apply** — Changes are sent to your AI coding tool via MCP to persist in source code

Changes preview instantly in the browser (like devtools), then get written to your actual files.

## Dynamic Controls

Controls appear based on the selected element:

| Element type | Controls |
|---|---|
| Any element | padding, margin, border-radius, background, opacity, shadow |
| Text | font-size, weight, line-height, letter-spacing, color, alignment |
| Flex container | direction, gap, align, justify, wrap |
| Grid container | columns, rows, gap |
| Image | object-fit, aspect-ratio, border-radius |
| Positioned | position offsets, z-index |

## AI Integration (MCP Server)

Retune includes an MCP server that connects to AI coding tools. Add it to your `.mcp.json`:

```json
{
  "mcpServers": {
    "retune": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "RETUNE_WS_PORT": "9223"
      }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|---|---|
| `retune_get_selection` | Get the currently selected element with its selector, component tree, and styles |
| `retune_get_pending_changes` | Get all visual changes as before/after diffs |
| `retune_get_formatted_changes` | Get changes as structured markdown, ready to apply to code |
| `retune_watch_changes` | Wait for new changes (blocks up to 30s) |
| `retune_clear_changes` | Clear pending changes after applying them |
| `retune_status` | Check overlay connection status |

## Configuration

```tsx
<Retune
  port={9223}              // WebSocket port for MCP bridge
  hotkey="alt+d"           // Toggle hotkey
  fidelity="standard"      // Output detail: "minimal" | "standard" | "full"
  position="bottom-right"  // Toolbar position
/>
```

## Element Identification

Retune uses layered identification to help AI agents find elements in your code:

1. **DOM-level** — CSS selector, text content, classes, computed styles
2. **React-specific** — Component name, props, component ancestry (via fiber tree)
3. **Source-level** — File path + line number (optional, via `__source` metadata)

## Tech Stack

React, TypeScript, npm workspaces. Packages:

- `retune` — Browser overlay (the main package)
- `@retune/mcp-server` — MCP server for AI tool integration

## Development

```bash
npm install
npm run build
npm run dev    # Watch mode
```

The demo app runs on `localhost:3001`.

## License

MIT
