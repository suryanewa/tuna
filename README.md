# Retune

The visual layer for vibe coding.

Click any element in your running app, adjust spacing, colors, typography, and more, and your AI agent writes the changes to source. No more prompting for pixels.

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

Press **Alt+D** (or **Option+D** on macOS) to toggle edit mode, then click any element to start tweaking.

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

### CSS Variable Detection

Retune scans your project's stylesheets at runtime and detects CSS custom properties (`--spacing-4`, `--color-brand`, etc.). It categorizes them by analyzing which CSS properties actually use each variable — not by guessing from names. When editing a property, the variable picker shows only relevant variables (e.g., font-size variables when editing font-size).

Variables can be applied, swapped, and unlinked directly from property inputs, gradient stop colors, and section-level actions for fill and shadow.

### Target Scoping

When you select an element with multiple classes (e.g., `.btn.btn-ghost`), Retune shows pre-computed scope levels so you can choose how broadly your changes apply — from the base class (all buttons) to the specific compound selector (just ghost buttons) to "This element" (path selector). The panel only shows properties owned by the selected scope.

### Gradient Editor

Full inline gradient editor with linear, radial, and conic support. Includes a visual stop bar for dragging color stops, angle control, reverse/rotate actions, and per-stop change tracking. Gradient stop colors support the variable picker for applying color tokens.

### Pseudo-State Editing

Toggle between `:hover`, `:focus`, and `:active` states to inspect and edit styles that only apply in those states — without needing to hold the mouse in place.

### Font Picker

Browse and apply fonts from your project's stylesheets, system fonts (via Local Font Access API), and generic CSS families. Filter by category (serif, sans-serif, monospace, etc.).

### Scrub-to-Adjust

Click and drag on any numeric value to scrub it up or down. Hold Shift for 10x increments, Alt for 0.1x precision.

### Change Tracking

Every property change shows a visual indicator. Click it to reset to the original value. Undo/redo support across all changes. The output includes precise before/after diffs for each property.

### Styling Approach Detection

Retune analyzes your stylesheets at runtime to detect whether you're using utility CSS (Tailwind, UnoCSS, etc.) or semantic CSS (CSS Modules, plain CSS). This context helps your AI agent write changes in the right format.

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

### Claude Code Skill

Retune ships with a built-in skill (`retune-visual-changes`) that teaches Claude Code how to apply visual changes to source code. It handles value resolution (design tokens, utility classes, CSS variables, raw values), respects your project's styling conventions, and routes changes to the correct files. The skill activates automatically when Retune output is detected.

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

[PolyForm Shield 1.0.0](LICENSE)
