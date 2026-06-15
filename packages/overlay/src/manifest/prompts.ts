/**
 * Manifest generation prompts — shared between the overlay banner,
 * SKILL.md references, and MCP tool responses.
 */

export const MANIFEST_PROMPT = `Generate a tuna.manifest.json file in the project's public directory (so it's served at /tuna.manifest.json). This manifest describes the project's React components and design tokens so that Tuna's visual editor can show accurate controls.

Place the file where your framework serves static assets:
- Next.js: public/tuna.manifest.json
- Vite/CRA: public/tuna.manifest.json
- Remix: public/tuna.manifest.json

## Manifest Version

Always include "version": 2 at the top level.

## Components

Think like a designer using Figma. Only document components that a designer would want to adjust visually. For each component, only include props that produce a VISIBLE change when modified.

**Include:** Components that render visible UI — buttons, cards, modals, dropdowns, navigation, tables, form inputs, layout containers with visual variants.

**Skip entirely:**
- Context providers and wrappers (ThemeProvider, MotionConfig, AuthProvider)
- Analytics/tracking components (I13nAnchor, BeaconComponent)
- Page-level shells that pass config downward (AppShell, PageWrapper)
- HOCs and utility wrappers (withTheme, withRouter, ErrorBoundary, Suspense)
- Components where ALL props are objects, functions, or internal config

**Props — only include props that produce visible changes:**
- Variant choices: "type": "enum", "values": ["primary", "secondary", "ghost"]
- Size options: "type": "enum", "values": ["sm", "md", "lg"]
- Content text: "type": "string" (labels, titles, placeholders)
- Visibility toggles: "type": "boolean" (isOpen, expanded, shown)
- State toggles: "type": "boolean" (disabled, loading, active)
- Default values where defined

**Skip these prop types:**
- Event handlers (onClick, onChange, onSubmit)
- Refs and DOM references
- Complex data objects and arrays
- Analytics/tracking props
- Internal IDs, className, style, children
- Config objects passed from providers

**class_map:** For props that determine which CSS class is applied, include a "class_map" object mapping each prop value to its CSS class name.

**hidden_unless (conditional visibility):** For props that are only relevant when another prop has a certain value, add "hidden_unless": { "otherProp": "requiredValue" }. Example: borderColor is only relevant when variant is "outline":
  "borderColor": { "type": "color", "hidden_unless": { "variant": "outline" } }

State (for components with useState hooks):
- Only include state that produces visible changes (open/closed, active tab, selected item)
- Skip internal state (previous values, RAF IDs, observer refs, debounce timers)
- Use the variable name as the key (e.g., "isOpen", "activeTab")
- Include type, default value, and description
- Use "enum" type with "values" when state has a finite set of possible values

## Design Tokens

Include a "tokens" object with these EXACT category keys. Only use these categories:

- "colors" -- color values (hex, rgb, hsl, oklch). MUST be organized into sub-groups (see below).
- "spacing" -- padding, margin, gap scales
- "sizing" -- width, height, min/max sizes
- "radii" -- border-radius values
- "borderWidths" -- border-width values
- "shadows" -- box-shadow values
- "typography" -- font-size, font-weight, line-height, letter-spacing, font-family values

Each token entry has:
- "value" -- the token's value exactly as defined. Use the actual value from the source (CSS variable, Tailwind config, SCSS variable). All color formats are valid: hex (#2563eb), rgb (rgb(59, 130, 246)), space-separated RGB (59 130 246), rgba, hsl, hsla, oklch, named colors (currentColor, transparent). All unit formats are valid: px, rem, em, %, unitless numbers. Do NOT skip tokens because of their value format. Do NOT transform values -- use them as-is.
- "variable" -- CSS custom property name starting with -- (if the project uses CSS custom properties for this token)
- "class" -- utility class name that applies this token (if the project uses utility classes like Tailwind)

Include "variable" when the token is a CSS custom property. Include "class" when the token is applied via a utility class. Include both when applicable.

Rules:
- Omit framework internals (--tw-ring-*, --tw-shadow*, --tw-translate-*, --tw-border-spacing-*, --tw-gradient-*, --tw-backdrop-*, --tw-blur*, --tw-brightness*, --tw-contrast*, --tw-grayscale*, --tw-hue-rotate*, --tw-invert*, --tw-saturate*, --tw-sepia*, --tw-pan-*, --tw-pinch-*, --tw-scroll-*, --tw-numeric-*, --tw-ordinal*, --tw-slashed-*, --tw-contain-*, --chakra-*, --mantine-*, --radix-*)
- Include tokens from design system packages (node_modules) if they define token scales
- Include the FULL spacing scale (every step, not just a few)
- Include the FULL color palette (every shade in every ramp)
- For Tailwind projects: extract tokens from tailwind.config.js theme values. The "class" field should be the base utility (e.g., "bg-blue-500" for colors used as backgrounds, "p-4" for spacing used as padding). For color tokens that can be used for multiple properties (text, bg, border), use the most common class prefix.
- For projects with CSS custom properties: use the actual variable names from the stylesheets
- For projects with SCSS/Less variables: convert to -- format for "variable" field
- Do NOT deduplicate tokens that resolve to the same value. Different variables may serve different purposes, belong to different teams, or have different overrides in other contexts (e.g., dark mode). Include ALL defined tokens.

Color sub-groups:
The "colors" category MUST use nested groups. Group colors by their design system organization:
- By hue ramp for primitive palettes (e.g., "blue", "red", "gray")
- By semantic role for semantic tokens (e.g., "brand", "status", "ui")
- By component/feature for scoped tokens (e.g., "pagination", "article-ui")
Each group is an object containing its token entries. Read the project's Tailwind config, design system docs, or CSS variable naming to determine the natural groupings. Group by purpose, NOT by value format -- tokens with hex values and space-separated RGB values belong in the same group if they serve the same role (e.g., all background colors together regardless of format).

## Responsive

Include a "responsive" object describing how the project handles responsive breakpoints:

- "strategy": How breakpoints are expressed in code
  - "tailwind" — Tailwind responsive prefixes (sm:, md:, lg:)
  - "media-queries" — Plain CSS @media queries
  - "css-in-js" — Theme breakpoints in styled-components/emotion
  - "scss-mixins" — SCSS/Sass mixin-based breakpoints
- "direction": "mobile-first" or "desktop-first" (Tailwind is mobile-first by default)
- "breakpoints": Map of token name → width value (e.g. "sm": "640px")

Detect from: tailwind.config.js/ts theme.screens, existing @media queries in CSS files, theme breakpoint objects in CSS-in-JS, SCSS breakpoint mixins/variables. If no breakpoints are defined, omit the "responsive" field entirely.

## Example

{
  "version": 2,
  "responsive": {
    "strategy": "tailwind",
    "direction": "mobile-first",
    "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px" }
  },
  "components": {
    "Avatar": {
      "props": {
        "size": {
          "type": "enum",
          "values": ["sm", "md", "lg"],
          "default": "md",
          "class_map": { "sm": "avatar--sm", "md": "avatar--md", "lg": "avatar--lg" }
        },
        "initials": { "type": "string" }
      }
    },
    "Button": {
      "props": {
        "variant": { "type": "enum", "values": ["solid", "outline", "ghost"], "default": "solid" },
        "size": { "type": "enum", "values": ["sm", "md", "lg"], "default": "md" },
        "disabled": { "type": "boolean", "default": false },
        "borderColor": { "type": "string", "hidden_unless": { "variant": "outline" } }
      }
    }
  },
  "tokens": {
    "colors": {
      "brand": {
        "brand": { "value": "#2563eb", "variable": "--color-brand" },
        "brand-light": { "value": "#60a5fa", "variable": "--color-brand-light" }
      },
      "blue": {
        "blue-500": { "value": "#3b82f6", "class": "bg-blue-500" },
        "blue-600": { "value": "#2563eb", "class": "bg-blue-600" },
        "blue-700": { "value": "#1d4ed8", "class": "bg-blue-700" }
      },
      "text": {
        "text-primary": { "value": "#1c1917", "variable": "--color-text", "class": "text-stone-900" },
        "text-muted": { "value": "#78716c", "variable": "--color-text-muted" }
      }
    },
    "spacing": {
      "1": { "value": "0.25rem", "class": "p-1" },
      "2": { "value": "0.5rem", "class": "p-2" },
      "4": { "value": "1rem", "variable": "--spacing-4", "class": "p-4" }
    },
    "radii": {
      "md": { "value": "0.375rem", "class": "rounded-md" },
      "lg": { "value": "0.5rem", "variable": "--radius-lg", "class": "rounded-lg" }
    },
    "typography": {
      "sm": { "value": "0.875rem", "class": "text-sm" },
      "font-bold": { "value": "700", "class": "font-bold" },
      "leading-normal": { "value": "1.5", "variable": "--leading-normal", "class": "leading-normal" }
    }
  }
}`;

export const MANIFEST_COMPONENTS_PROMPT = `Update the existing tuna.manifest.json to add or update the "components" section. Do NOT modify the existing "tokens" section. Set "version": 2.

Think like a designer using Figma. Only document components that render visible UI and have props that produce visible changes when modified.

**Include:** Buttons, cards, modals, dropdowns, navigation, tables, form inputs, layout containers with visual variants.

**Skip:** Context providers, analytics wrappers, HOCs, page shells, error boundaries, animation config wrappers, and any component where all props are objects/functions/internal config.

For each component, include:
- "props" — only visually meaningful props (variant, size, label, disabled, isOpen). Skip event handlers, refs, data objects, tracking props.
- "state" — only visible state (isOpen, activeTab). Skip internal state.
- "hidden_unless" — for props only relevant when another prop has a certain value: "borderColor": { "type": "string", "hidden_unless": { "variant": "outline" } }
- "class_map" — for props that map to CSS classes

Prop types: "string", "number", "boolean", "enum". For enum props, list values in a "values" array. Include defaults.

If no meaningful visual components are found, add "components": {} to indicate the analysis was completed.`;
