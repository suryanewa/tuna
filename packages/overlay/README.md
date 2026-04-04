# Retune

The visual layer for vibe coding.

Select, tweak, restructure — directly in your running app. Your AI agent writes the changes to source. No more prompting for pixels.

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

**Vite / Astro / SvelteKit:** These frameworks use `import.meta.env.DEV` instead of `process.env.NODE_ENV`. Retune detects both automatically since v0.7.2. If your dev check fails, use the `force` prop:

```tsx
<Retune force />
```

Press **Alt+D** (or **Option+D** on macOS) to toggle edit mode, then click any element to start tweaking.

### Monorepo Setup

Run `npx retune setup` from your **repo root**. It detects common app directories (`app/`, `client/`, `web/`, `packages/app`) by looking for framework config files (next.config, vite.config) and places `retune.manifest.json` in the correct `public/` folder. If your app directory isn't detected, run setup from within the app directory instead.

## How It Works

1. **Select** — Click any element in your app to inspect it
2. **Edit** — Adjust styles, reorder elements, edit text, delete, resize, and more
3. **Apply** — Changes are sent to your AI coding tool via MCP to persist in source code

Changes preview instantly in the browser, then get written to your actual source files.

## Features

### Direct Manipulation

- **Drag to reorder** — Drag elements to reorder among siblings. Live sibling shifting shows where the element will land. Works on flex, grid, and block layouts.
- **Drag to reparent** — Drag elements outside their parent to move them into a different container. Visual drop indicator shows the insertion point.
- **Resize by dragging** — Drag edges or corners to resize elements.
- **Reposition** — Drag absolute/fixed elements to move them. Snap guides show alignment with parent edges, centers, and siblings.
- **Inline text editing** — Double-click to edit text content. Enter for line breaks, click outside to save.
- **Delete elements** — Delete or Backspace removes the selected element.
- **Arrow key reorder** — Up/Down/Left/Right to reorder siblings within their container.

### Visual Feedback

- **Sibling outlines** — Hover a parent of the selected element to see dotted outlines on all siblings, revealing the layout structure.
- **Spacing measurements** — Hold Alt/Option while hovering to see distances between elements.
- **Snap guides** — Alignment lines with markers appear when repositioning or resizing near edges, centers, or sibling boundaries.
- **Selection badge** — Shows element dimensions below the selection box.
- **Parent indicator** — Dotted outline on the parent when a child is selected.

### Property Controls

Controls appear based on the selected element:

| Element type | Controls |
|---|---|
| Any element | padding, margin, border-radius, background, opacity, shadow, filters |
| Text | font-size, weight, line-height, letter-spacing, color, alignment, font family |
| Flex container | direction, gap, align, justify, wrap |
| Grid container | columns, rows, gap |
| Image | object-fit, aspect-ratio, border-radius |
| Positioned | position offsets, z-index |

### Pseudo-State Editing

Toggle between `:hover`, `:focus`, and `:active` states to inspect and edit styles that only apply in those states — without needing to hold the mouse in place.

### Class Selector Picker

When you select an element, Retune shows its CSS classes as clickable tags. Pick "This element" to scope changes to just that element, or pick a class to apply changes everywhere that class is used. Each tag shows how many elements share the class.

### Styling Approach Detection

Retune analyzes your stylesheets at runtime to detect whether you're using utility CSS (Tailwind, UnoCSS, etc.) or semantic CSS (CSS Modules, plain CSS). This context helps your AI agent write changes in the right format.

### Design Token Resolution

When you change a value, Retune finds matching design tokens (CSS variables, utility classes, semantic tokens) and suggests the best match. Your AI agent uses the token instead of a raw value.

### Scrub-to-Adjust

Click and drag on any numeric value to scrub it up or down. Hold Shift for 10x increments, Alt for 0.1x precision.

### Dark Mode

Full dark mode support for the Retune overlay. Toggle in Settings or follow system preference.

### Keyboard Shortcuts

| Action | Mac | Windows |
|---|---|---|
| Toggle edit mode | ⌥D | Alt+D |
| Undo | ⌘Z | Ctrl+Z |
| Redo | ⌘⇧Z | Ctrl+Shift+Z |
| Select child | Enter | Enter |
| Select parent | ⇧Enter | Shift+Enter |
| Next sibling | Tab | Tab |
| Previous sibling | ⇧Tab | Shift+Tab |
| Reorder | ↑↓←→ | ↑↓←→ |
| Delete | ⌫ | Delete |
| Measure spacing | ⌥+Hover | Alt+Hover |

### Elements Tab

Tree view of the DOM with drag-to-reorder and drag-to-reparent. Shows React component names, reflects visual order after reorder.

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

[PolyForm Shield 1.0.0](LICENSE)
