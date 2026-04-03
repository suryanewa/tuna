/**
 * Manifest generation prompts — shared between the overlay banner,
 * SKILL.md references, and MCP tool responses.
 */

export const MANIFEST_PROMPT = `Generate a retune.manifest.json file in the project's public directory (so it's served at /retune.manifest.json). This manifest describes the project's React components and design tokens so that Retune's visual editor can show accurate controls.

Place the file where your framework serves static assets:
- Next.js: public/retune.manifest.json
- Vite/CRA: public/retune.manifest.json
- Remix: public/retune.manifest.json

## Components

For each React component, include a "props" object and optionally a "state" object.

Props:
- All props with their types: "string", "number", "boolean", "enum", "function"
- For enum props, list all allowed values in a "values" array
- Default values where defined
- IMPORTANT: For props that determine which CSS class is applied, include a "class_map" object mapping each prop value to its CSS class name. Look for patterns like className={\`btn-\${variant}\`} or conditional class logic.

State (for components with useState hooks):
- List each useState hook in declaration order
- Use the variable name as the key (e.g., "activeFolder", "isOpen")
- Include type, default value, and description
- Use "enum" type with "values" when state has a finite set of possible values
- Use "boolean" for toggle states, "number" for counters/IDs, "string" for free text

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
- "value" -- a single resolvable CSS value (e.g., "#2563eb", "16px", "1.5rem"). NOT descriptions or compound values.
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

Color sub-groups:
The "colors" category MUST use nested groups. Group colors by their design system organization:
- By hue ramp for primitive palettes (e.g., "blue", "red", "gray")
- By semantic role for semantic tokens (e.g., "brand", "status", "ui")
- By component/feature for scoped tokens (e.g., "pagination", "article-ui")
Each group is an object containing its token entries. Read the project's Tailwind config, design system docs, or CSS variable naming to determine the natural groupings.

## Example

{
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

export const MANIFEST_COMPONENTS_PROMPT = `Update the existing retune.manifest.json to add a "components" section. The manifest already has design tokens. Do NOT modify the existing "tokens" section.

Scan the project's React components and add a "components" object to the manifest:

For each React component in the project, include a "props" object and optionally a "state" object:

Props:
- All props with their types: "string", "number", "boolean", "enum", "function"
- For enum props, list all allowed values in a "values" array
- Default values where defined
- For props that map to CSS classes, include a "class_map" object (e.g., size: "sm" maps to class "avatar--sm")

State (for components with useState hooks):
- List each useState hook in declaration order
- Use the variable name as the key (e.g., "activeFolder", "isOpen")
- Include type, default value, and description
- Use "enum" type with "values" when state has a finite set of possible values
- Use "boolean" for toggle states, "number" for counters/IDs, "string" for free text

If no meaningful components are found, add "components": {} to indicate the analysis was completed.`;
