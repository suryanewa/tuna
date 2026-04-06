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
| Image | object-fit, object-position, alt text, loading (lazy/eager) |
| Video | object-fit, autoplay, loop, muted, controls |
| SVG shapes | fill, stroke color, stroke width |
| Positioned | position offsets, z-index |
| Background image | background-size, position, repeat |

### Component Props & State

View and edit React component props and state hooks directly in the panel. Enum props show as dropdowns, booleans as toggle controls. When a manifest is present, state hooks display with their actual variable names and enum values.

### Comments

Annotate elements (click) or areas (drag) with text notes. Comment markers follow scroll, expand on hover with a text preview. Comments are included in the output so your AI agent can address them alongside visual changes.

### Manifest System (v2)

Generate a `retune.manifest.json` to describe your design system's components, props, state hooks, and tokens. The manifest powers accurate token pickers, component variant controls, scope pill labels, and richer output context for your AI agent.

**v2 features:**
- **Smart prop filtering** — non-manifest components auto-filter to show only designer-relevant props. Framework plumbing components are hidden entirely.
- **Conditional visibility** — props can declare `"hidden_unless"` to only show when relevant.
- **Variable picker cleanup** — class-only tokens excluded from the variable picker. Only CSS custom properties show.

Generate via the in-app banner prompt, MCP nudge, or `npx retune setup`. Existing v1 manifests trigger a regeneration nudge.

### Aspect Ratio Lock

Lock toggle in the Size section constrains proportions when editing width or height. Images and video lock by default during resize (hold Shift to unlock).

### Trigger Editing

Toggle between Hover, Focus, and Active states to inspect and edit styles that only apply in those interaction states.

### Scope Targeting

When you select an element with multiple classes, Retune shows scope levels so you can choose how broadly your changes apply — from the base class (all buttons) to a variant (ghost buttons) to "This instance". When a manifest is present, variant classes are labeled accurately using the manifest's prop values.

### Design Token Resolution

When you change a value, Retune finds matching design tokens (CSS variables, utility classes, semantic tokens) and suggests the best match. When a manifest is present, manifest tokens replace the runtime scanner for more accurate results with proper categorization.

### Elements Tab

Figma-style tree view with layout-aware icons (flex-row, flex-column, grid, block, text, image, component). SVG shapes render as mini path previews. Text elements show content preview as the layer name. Drag to reorder or reparent. Selecting an element highlights its descendants.

### More

- **Scrub-to-adjust** — Click and drag on numeric values. Shift for 10x, Alt for 0.1x.
- **Dark mode** — Full dark mode for the overlay. Toggle in Settings or follow system preference.
- **Styling approach detection** — Detects Tailwind, CSS Modules, plain CSS to help your AI agent write changes in the right format.

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

## Setup

Auto-configure MCP, install the AI skill, and extract design tokens:

```bash
npx retune setup
```

This detects Claude Code and Cursor, configures the MCP server, installs the skill, and generates a partial manifest with your project's design tokens from CSS files. The output prompts your AI agent to complete the manifest with component definitions.

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
| `retune_get_comments` | Get all comments/annotations left by the user |
| `retune_manifest_loaded` | Notify the overlay after generating or updating the manifest |
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

- **Frameworks:** Next.js, Vite, Remix, Astro, SvelteKit
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
