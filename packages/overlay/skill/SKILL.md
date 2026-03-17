---
name: retune-visual-changes
description: Apply visual changes from the Retune overlay to source code. Use this skill when receiving output from retune MCP tools (retune_get_formatted_changes, retune_get_pending_changes) OR when the user pastes structured visual change output containing "# Visual Changes", a Before/After changes table, or property diffs with Token columns. Triggers on: retune, "Visual Changes", "apply these changes", style diff, design tokens, property before/after table, visual tweaks, overlay changes.
---

# Applying Retune Visual Changes

Retune sends you structured diffs of visual changes the user made in the browser. Your job is to translate these into precise source code edits that respect the project's styling conventions.

## The User's Value Is Sacred

The user chose an exact CSS value through direct visual manipulation. Never snap, round, correct, or second-guess their chosen value. Your job is to find the right place to apply it and the right mechanism (token, class, variable, or raw value) based on what the project already uses.

## Value Resolution

When Retune output includes candidate tokens, classes, or CSS variables, use this priority:

1. **Exact semantic token match** — A design token that resolves to the exact value the user set. Always prefer this. Example: user sets `16px`, token `spacing-4` resolves to `1rem` (16px) → use the token.

2. **Exact utility class match** — A framework utility class (Tailwind, etc.) that produces the exact value. Example: user sets `16px` padding → `p-4` → use the class.

3. **Exact CSS variable match** — A CSS custom property that resolves to the exact value. Example: user sets `#1e3a5f` → `var(--color-navy)` resolves to `#1e3a5f` → use the variable.

4. **Raw value** — When no exact match exists, use the user's raw value directly. Never use a "close" token — if the nearest token is `14px` but the user set `15px`, use `15px`.

**Fuzzy matches are context, not suggestions.** When the output shows a non-exact candidate with a distance label (e.g., `nearest: 1rem vs 1.1rem`), this tells you what tokens exist nearby — useful for understanding the design system, but never apply a fuzzy match in place of the user's value.

## Reading the Output

### Changes Table

```
| Property | Before | After | Token |
|----------|--------|-------|-------|
| `padding` | `8px` | `16px` | `.p-4` |
```

- **Property**: The CSS property that changed (kebab-case)
- **Before/After**: Exact computed values before and after the user's edit
- **Token**: Best matching candidate, if any. `—` means no match found
- The **Selector** line above the table tells you where to apply the change

### Resolution Context

When present, the `<details>` block provides deeper context per property:
- **Recommended**: The best candidate (exact or nearest)
- **Alternatives**: Other tokens in the same category
- **CSS vars**: Custom properties that resolve to this value
- **Competing rules**: Other CSS rules that set this property (watch for `!important`)

### Element Identification

Use these fields to find the element in source code, in order of reliability:

1. **Source** — File path and line number (most precise, from React `_debugSource`)
2. **Component** — React component hierarchy (e.g., `HeroSection → Button`)
3. **Selector** — CSS selector with scope annotation (class-scoped, element-specific)
4. **Classes** — Applied class names
5. **Text content** — The element's visible text
6. **DOM Path** — Full traversal path (last resort)

### Pseudo-State Changes

When the selector annotation says `hover state`, `focus state`, etc., the change applies to that pseudo-state, not the default state. Apply the change to the corresponding CSS pseudo-selector or conditional class.

## Applying Changes by Styling Approach

The output's **Styling** field tells you how the element is styled. Follow the approach:

### Tailwind CSS

Replace or add utility classes in the JSX/HTML. Never add inline styles to Tailwind-styled elements.

```diff
- <button className="px-3 py-2 rounded-md bg-blue-600">
+ <button className="px-4 py-3 rounded-lg bg-blue-700">
```

When the Token column shows a utility class like `.p-4`, that's the class to use. When no utility class matches, use arbitrary values: `p-[15px]`.

### CSS Modules

Edit the `.module.css` file. The Source column tells you which stylesheet.

```diff
/* Button.module.css */
  .button {
-   padding: 8px 16px;
+   padding: 12px 24px;
    border-radius: 8px;
  }
```

### CSS-in-JS / Emotion / styled-components

Edit the style object or template literal in the component file.

```diff
  const Button = styled.button`
-   padding: 8px 16px;
+   padding: 12px 24px;
    border-radius: 8px;
  `;
```

### Plain CSS

Edit the stylesheet. Use the Source and Selector fields to find the right rule.

### Inline Styles

Edit the `style` prop on the JSX element.

```diff
- <div style={{ padding: '8px', borderRadius: '4px' }}>
+ <div style={{ padding: '12px', borderRadius: '8px' }}>
```

## Handling Conflicts

When competing rules appear in the resolution context:

- If the competing rule has `!important`, your change may be overridden. Either modify the competing rule, or add `!important` to your change (last resort).
- If multiple selectors set the same property, apply the change to the highest-specificity rule that the Source column identifies.
- If the source is `inline style` but the project uses classes/stylesheets, prefer moving the value to the appropriate stylesheet rather than keeping it inline.

## Scope Awareness

The selector annotation tells you the blast radius:

- **class-scoped, N elements** — Your change affects N elements. If the user intended to change only this one, consider adding a more specific selector or class.
- **id-scoped, unique** — Safe to modify, affects one element.
- **element-specific** — Path-based selector, affects one element.

## Token Associations

When the output includes `tokenAssociations`, the user explicitly picked a design token in Retune's token picker. Always honor this association — use the token's class name, not the raw value.

## Workflow

1. Read the formatted changes output
2. Locate the element using Source → Component → Selector → text content
3. For each changed property:
   a. Check if an exact token/class/variable match exists
   b. Apply using the project's styling approach
   c. Watch for competing rules and scope
4. Verify the change makes sense in context (don't blindly apply if something looks wrong)
