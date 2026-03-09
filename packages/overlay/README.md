# Retune

Visual devtools that persist changes to source code via AI agents.

Select any element in your running app, tweak its styles visually, and the changes get sent to AI coding tools (Claude Code, Cursor, etc.) to apply as real code changes.

## Quick Start

```bash
npm install retune
```

Add the overlay to your app layout — it only renders in development by default:

```tsx
import { Retune } from "retune";

export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Retune />
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

## Features

### Dynamic Controls

Controls appear based on the selected element:

| Element type | Controls |
|---|---|
| Any element | padding, margin, border-radius, background, opacity, shadow |
| Text | font-size, weight, line-height, letter-spacing, color, alignment |
| Flex container | direction, gap, align, justify, wrap |
| Grid container | columns, rows, gap |
| Image | object-fit, aspect-ratio, border-radius |
| Positioned | position offsets, z-index |

### Pseudo-State Editing

Toggle between `:hover`, `:focus`, and `:active` states to inspect and edit styles that only apply in those states — without needing to hold the mouse in place.

### Class Selector Picker

When you select an element, Retune shows its CSS classes as clickable tags. Pick "This element" to scope changes to just that element, or pick a class to apply changes everywhere that class is used. Each tag shows how many elements share the class.

### Styling Approach Detection

Retune analyzes your stylesheets at runtime to detect whether you're using utility CSS (Tailwind, UnoCSS, etc.) or semantic CSS (CSS Modules, plain CSS). This context helps your AI agent write changes in the right format. No hardcoded framework patterns — it works by analyzing rule complexity in `document.styleSheets`.

### Scrub-to-Adjust

Click and drag on any numeric value to scrub it up or down. Hold Shift for 10x increments, Alt for 0.1x precision.

## AI Integration (MCP Server)

Retune includes a built-in MCP server. Configure your AI tool to use it:

```json
{
  "mcpServers": {
    "retune": {
      "command": "npx",
      "args": ["-y", "retune"]
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
  force                    // Show in production (default: false)
/>
```

## Element Identification

Retune uses layered identification to help AI agents find elements in your code:

1. **DOM-level** — CSS selector, text content, classes, computed styles
2. **React-specific** — Component name, props, component ancestry (via fiber tree)
3. **Source-level** — File path + line number (optional, via `__source` metadata)

## Compatibility

- **Frameworks:** Next.js, Vite, Remix
- **Styling:** Tailwind CSS, CSS Modules, plain CSS, any utility-first framework
- **AI tools:** Claude Code and Cursor via MCP, plus clipboard fallback for others
- **Viewport:** Desktop only (hidden below 768px)

## Tech Stack

React, TypeScript. Single package with two entry points:

- `import { Retune } from "retune"` — React overlay component
- `npx retune` — MCP server for AI tool integration

## Development

```bash
npm install
npm run build
npm run dev    # Watch mode
```

## License

MIT
