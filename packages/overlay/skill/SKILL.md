---
name: retune-visual-changes
description: Apply visual changes from the Retune overlay to source code. Use this skill when receiving output from retune MCP tools (retune_get_formatted_changes, retune_get_pending_changes) OR when the user pastes structured visual change output containing "# Visual Changes", "# Comments", a Before/After changes table, or property diffs with Token/Variable columns. Triggers on: retune, "Visual Changes", "apply these changes", style diff, design tokens, design variables, property before/after table, visual tweaks, overlay changes, "Comment #", "Address each comment".
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

Edit the `.module.css` file. Use the Selector and DOM Path to find the right stylesheet.

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

Edit the stylesheet. Use the Selector and DOM Path to find the right rule.

### Inline Styles

Edit the `style` prop on the JSX element.

```diff
- <div style={{ padding: '8px', borderRadius: '4px' }}>
+ <div style={{ padding: '12px', borderRadius: '8px' }}>
```

## Handling Conflicts

When competing rules appear in the resolution context:

- If the competing rule has `!important`, your change may be overridden. Either modify the competing rule, or add `!important` to your change (last resort).
- If multiple selectors set the same property, apply the change to the highest-specificity matching rule.
- If the source is `inline style` but the project uses classes/stylesheets, prefer moving the value to the appropriate stylesheet rather than keeping it inline.

## Scope Awareness

When the output includes a **Target classes** line (e.g., `.btn` (8) → `.btn-ghost` (2)), the user scoped their changes to a compound selector. Apply the change to the CSS rule matching that compound selector, not just the base class.

### Ancestor Compound Selectors

When the selector includes a descendant combinator (space) or child combinator (`>`), the user scoped their change to a specific ancestor context. For example:

- `.message-row--unread .message-row__subject` — change applies only to subjects inside unread rows
- `[data-state="open"] .accordion-content` — change applies only when the accordion is open
- `.theme-dark .card__title` — change applies only in dark mode

Find or create the CSS rule matching the full ancestor compound selector. Do NOT apply the change to the child class alone (e.g., don't edit `.message-row__subject` when the scope is `.message-row--unread .message-row__subject`).

If the rule doesn't exist yet, create it near the base rule for the child class.

### Blast Radius

The selector annotation tells you the blast radius:

- **class-scoped, N elements** — Your change affects N elements. If the user intended to change only this one, consider adding a more specific selector or class.
- **id-scoped, unique** — Safe to modify, affects one element.
- **element-specific** — Path-based selector, affects one element.

## Variable Associations

When the output includes `variableAssociations`, the user explicitly picked a design variable in Retune's variable picker. Always honor this association — use the variable's class name or CSS custom property, not the raw value.

## Structural Actions

The output may include structural DOM actions instead of (or alongside) CSS property changes. These appear as `### Action:` sections.

### Delete Element

```
### Action: Delete Element

Remove this element from the source code entirely.
```

Delete the entire JSX element (opening tag, children, closing tag) from the source file. Use the Component, Source, and Selector fields to locate it. If the element is rendered conditionally or inside a `.map()`, remove the appropriate block.

### Edit Text Content

```
### Action: Edit Text Content

| Text | Before | After |
|------|--------|-------|
| Content | `Get Started` | `Start Free Trial` |
```

Replace the text content in the JSX. Only change the text — don't modify the element's tag, classes, or styles.

### Reorder Element

```
### Action: Reorder Element

Moved from position 5 to position 1 within its parent container.
```

Move the element's JSX block to the new position among its siblings. If the children are rendered from a `.map()` call over an array, reorder the array items instead. If they're static JSX, move the entire JSX block (opening tag through closing tag, including all props and children).

When the output says **"This is a component-level change affecting N instances"**, the reorder applies to the component's JSX template, not a single rendered instance. Find the component definition and reorder the children there — all N instances will update automatically because they share the same template.

### Reparent Element

```
### Action: Reparent Element

Move this element from its current parent to a new parent container.
**From:** `.old-parent`
**To:** `.new-parent` (as child at position 2)
```

Move the element's JSX block from its current parent to the new parent container at the specified position. Use the **From** selector to locate the current parent and the **To** selector to locate the target parent. The position index (0-based) indicates where among the new parent's children the element should be inserted. If the children are rendered from a `.map()` call, update the data source accordingly. If they're static JSX, physically move the JSX block.

When the output says **"This is a component-level change affecting N instances"**, the reparent applies to the component's JSX template. Move the element in the component definition — all N instances will update automatically.

### Resize (Width/Height Changes)

Width and height changes from drag-to-resize appear as regular property changes in the changes table. Apply them using the project's styling approach — don't add inline styles if the project uses CSS classes or stylesheets.

## Comments

Retune allows users to leave comments on elements or areas of their running app. Comments describe intent, feedback, or instructions that complement (or replace) visual property changes.

### Comment Output Format

```
## Comment #1 on `<button>` "Get Started"

**Component:** HeroSection
**Selector:** `.hero > .cta-container > button.btn-primary`
**Classes:** `btn-primary`
**Marker position:** (500, 200) on viewport

> Make this button more prominent — larger, bolder, maybe a gradient background
```

### How to Handle Comments

Comments are **user intent in plain language**. Unlike property changes (which are exact values), comments require interpretation:

1. **Read the comment text** (blockquoted with `>`) — this is what the user wants
2. **Use the element identification** (Component, Selector, Classes) to find the element in source code
3. **Apply the requested change** using the project's styling conventions
4. **Use your judgment** — the user is describing what they want, not dictating exact CSS values
5. **If a comment accompanies visual changes**, the comment provides context for WHY the changes were made. Apply the visual changes first, then address any additional intent in the comment.

### Comment-Only Output

When the output header says "The user has left comments on their running app using Retune. Address each comment by making the described changes to the source code:", there are no visual property changes — only comments. Read each comment and make the described changes.

### Area Comments

Area comments target a region of the page rather than a specific element:

```
## Comment #2 on area

**Region:** (100, 300) 400×200px

> Add a testimonials section here
```

For area comments, use the region coordinates and surrounding elements to determine where in the source code to make changes.

## Clearing Changes

After applying all changes to source code, **always call `retune_clear_changes`** to clear the pending changes from the Retune overlay. This:
- Removes the change badge from the toolbar
- Clears the undo/redo history for applied changes
- Resets the overlay state so new changes can be tracked cleanly

If you don't clear, the overlay will still show the old changes and the user may get confused.

## Workflow

1. Read the formatted changes output
2. For each **visual change**:
   a. Locate the element using Source → Component → Selector → text content
   b. Check if an exact token/class/variable match exists
   c. Apply using the project's styling approach
   d. Watch for competing rules and scope
3. For **structural actions** (delete, text edit, reorder, reparent): apply the DOM change to the JSX source
4. For each **comment**:
   a. Read the comment text to understand the user's intent
   b. Locate the element using Component → Selector → Classes
   c. Make the described changes using the project's conventions
5. Verify all changes make sense in context (don't blindly apply if something looks wrong)
6. **Call `retune_clear_changes`** to clear the applied changes and comments from the overlay
