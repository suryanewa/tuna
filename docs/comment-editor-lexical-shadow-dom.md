# Comment Editor: Lexical + Shadow DOM Bug Postmortem

This document records the bugs encountered while building the inline comment editor (`CommentEditor`), how they were diagnosed and fixed, and how to avoid regressions. The editor lives inside Tuna's **Shadow DOM** overlay and uses **Lexical** with a custom **`MentionNode`** for inline element references (colored `@`-style tokens).

**Primary files:**

| File | Role |
|---|---|
| `packages/overlay/src/overlay/comment/CommentEditor.tsx` | Lexical composer, input/delete handlers, mention insertion |
| `packages/overlay/src/overlay/comment/mention-node.ts` | Custom `MentionNode` (token mode, `contentEditable=false`) |
| `packages/overlay/src/overlay/Tuna.tsx` | Document-level keyboard handlers (must not steal keys from the editor) |

**Commit with fixes:** `c4db19d` — `fix(overlay): restore reliable typing and deletion in the comment editor.`

---

## Architecture Context

Understanding why these bugs happened requires three overlapping layers:

### 1. Lexical in a Shadow Root

The comment popover renders inside Tuna's shadow root. Lexical's default text input and deletion paths rely on browser APIs that behave differently (or fail silently) when the focused `contenteditable` is not in the light DOM:

- **`beforeinput`** — Lexical listens for controlled text insertion; in shadow DOM, native DOM updates and Lexical state can diverge.
- **`Selection.modify()`** — Lexical's default `deleteCharacter` implementation uses this for collapsed caret deletions; it is unreliable when selection lives inside a shadow tree.

### 2. Custom Mention Tokens

`MentionNode` extends Lexical's `TextNode` with:

- `setMode("token")` — treated as an atomic inline unit
- `contentEditable="false"` on the rendered DOM — the browser cannot place a text caret *inside* the mention
- Adjacent **spacer text nodes** (`" "`) — required so the caret has an editable anchor before/after each token

Spacer nodes are structural, not user-authored text. Any insertion or deletion logic must treat them as part of the mention boundary, not as normal characters.

### 3. Document-Level Keyboard Handlers

`Tuna.tsx` registers capture-phase `keydown` listeners for overlay shortcuts (delete selected element, undo, etc.). These must **bail out** when focus is in a text field inside the shadow root (`INPUT`, `TEXTAREA`, or `contentEditable`).

---

## Issue Timeline

The bugs surfaced in this order during development. Several fixes initially caused regressions in adjacent behavior — that coupling is documented below.

| # | Symptom | Severity |
|---|---|---|
| 1 | Cmd+A then Delete → `RangeError: Maximum call stack size exceeded` | Crash |
| 2 | Select-all delete works, but normal Backspace does nothing | Blocker |
| 3 | Typing skips characters (`"abcdef"` → `"bdf"`) | Blocker |
| 4 | New chars appear *before* cursor; normal delete breaks again | Regression |
| 5 | Deleting mentions unfocuses popover; extra Delete presses needed | Major |
| 6 | Caret disappears after Backspace at mention boundary | Major |
| 7 | Multiple mentions require too many Delete presses (spacer accumulation) | Major |
| 8 | Multiple inline mentions show **two** visual spaces between them | Visual |

---

## Issue 1: Stack Overflow on Select-All + Delete

### Symptom

Opening the chat input and pressing **Cmd+A** then **Delete** threw:

```
RangeError: Maximum call stack size exceeded
```

Normal deletion was also broken, but this crash was the first visible failure.

### Root Cause

`MentionNode`'s constructor called `this.setMode("token")`. Lexical's node lifecycle works like this:

1. `clone()` → `new MentionNode(...)` (constructor runs)
2. Constructor calls `setMode()` → `getWritable()` → clones the node again
3. Clone constructor calls `setMode()` again → infinite recursion

This surfaced on bulk delete because Lexical clones many nodes when clearing a selection that includes mention tokens.

### Fix

Move `setMode("token")` out of the constructor and into the factory function `$createMentionNode`, which is only called at intentional creation time — not during internal cloning.

```typescript
// mention-node.ts — constructor: do NOT call setMode()
constructor(name, color, selector, key?) {
  super(`@${name}`, key);
  this.__name = name;
  // ...
}

// Factory: safe to mutate mode here
export function $createMentionNode(...) {
  const node = new MentionNode(name, color, selector);
  node.setMode("token");
  return $applyNodeReplacement(node);
}
```

Lexical preserves token mode across clones via `TextNode.afterCloneFrom`; the constructor does not need to re-set it.

### Prevention

**Never call `getWritable()`, `setMode()`, or any method that triggers a writable clone from a Lexical node's constructor or `clone()` path.**

Safe places for initialization side effects:

- `$create*` factory functions
- `createDOM()` / `updateDOM()`
- `importJSON()` (via factory)

---

## Issue 2: Normal Backspace/Delete Does Nothing

### Symptom

After fixing the stack overflow, **Cmd+A + Delete** worked, but pressing **Backspace** one character at a time had no effect.

### Root Cause

Lexical's built-in `DELETE_CHARACTER_COMMAND` handler ultimately calls `window.getSelection().modify("extend", ...)` for collapsed caret deletions. Inside a Shadow DOM, this API often fails to modify the selection correctly, so Lexical never applies the deletion.

### Fix

Register a **high-priority** custom handler at `COMMAND_PRIORITY_CRITICAL` that performs deletion via Lexical's node API instead of browser selection APIs:

```typescript
editor.registerCommand(DELETE_CHARACTER_COMMAND, (isBackward) => {
  // For collapsed selection in a plain TextNode:
  node.spliceText(start, count, "", true);
  return true; // handled — skip Lexical's broken path
}, COMMAND_PRIORITY_CRITICAL);
```

Also handle **UTF-16 surrogate pairs** (emoji) by deleting two code units when appropriate.

### Prevention

When embedding Lexical inside Shadow DOM (or any non-standard editing surface):

- Assume `Selection.modify()` may not work
- Prefer `TextNode.spliceText()` for character-level edits
- Test Backspace/Delete on every platform (macOS Safari is especially sensitive)

---

## Issue 3: Characters Skipped While Typing

### Symptom

Typing `"abcdef"` slowly produced `"bdf"` — roughly every other keystroke was lost.

### Root Cause

In Shadow DOM, native `beforeinput` events fire and the browser may briefly insert text into the DOM, but Lexical's controlled update pipeline does not always commit the change to editor state. On the next render, Lexical reconciles from its (stale) state and overwrites the DOM, dropping characters.

This is distinct from Issue 4 — here characters vanish entirely rather than appearing in the wrong position.

### Fix

Add a **capture-phase `beforeinput` listener** on the editor root that manually inserts text via Lexical when `inputType === "insertText"`:

```typescript
root.addEventListener("beforeinput", (e) => {
  if (e.inputType === "insertText" && e.data && !e.isComposing) {
    editor.update(() => {
      node.spliceText(offset, 0, e.data, true);
    });
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);
```

### Prevention

- Treat Shadow DOM text input as **fully controlled** — do not rely on Lexical's default DOM listener chain alone
- Always call `preventDefault()` + `stopImmediatePropagation()` after handling, or native and Lexical paths will race
- Test with slow, deliberate typing — race conditions are easier to miss with fast input
- On `insertText`, trust Lexical selection when already collapsed in an editable text node. Unconditional `$applyDomSelectionToLexical` before every keystroke re-introduces Shadow DOM selection desync and causes typing-at-end regressions after pointer-based caret placement.

---

## Issue 4: Characters Insert Before Cursor; Delete Regressed

### Symptom

After adding the `beforeinput` fix, new characters appeared **before** the blinking caret instead of after. Normal delete stopped working again (only select-all delete worked).

### Root Cause

The `beforeinput` handler applied the insert via `spliceText`, but **did not prevent the default** in all code paths. Both the manual insert and Lexical/native handling ran, causing double insertion or incorrect caret placement.

Additionally, `KeyPlugin` was calling `stopImmediatePropagation()` on **every** keydown (not just Enter/Escape), which blocked Lexical's own key handlers including delete.

### Fix

1. Only call `preventDefault()` / `stopImmediatePropagation()` when the handler actually performed the insert (`handled === true`)
2. Narrow `KeyPlugin` keydown suppression to **Enter** and **Escape** only — do not blanket-stop propagation on Backspace/Delete/printable keys

### Prevention

- When adding custom input handlers, verify the event is fully consumed (`preventDefault` + `stopImmediatePropagation`)
- Never use blanket `stopImmediatePropagation()` on editor keydown — scope it to keys you truly own
- After any input fix, run the full matrix: type, backspace, delete, select-all delete, mention boundaries

---

## Issue 5: Deleting Mentions Unfocuses the Popover

### Symptom

Backspace near an inline mention caused the chat popover to **lose focus**. Clicking back in showed the caret at the far right. Each Delete press unfocused again until the user typed (which restored correct caret behavior).

### Root Cause

Mention tokens are `contentEditable=false`. When Backspace deleted the spacer text node adjacent to a mention, the collapsed selection could land **inside** the mention node. The browser cannot host a text caret there, so focus blurs or jumps unpredictably.

The insertion path also created `[space][mention][space]` per mention, so boundaries were fragile.

### Fix

Custom `DELETE_CHARACTER_COMMAND` logic for mention boundaries:

1. **Caret on a MentionNode** → remove the mention, reposition to an adjacent editable text node
2. **Caret in whitespace-only text before a mention** → skip spacer run, delete the mention directly
3. After removal, **`requestAnimationFrame(() => editor.focus())`** to restore focus
4. **Normalize spacer** to a single `" "` after removal via `normalizeSpacer()`

### Prevention

- Never end document content with a bare `MentionNode` — always append a trailing editable text node (see `createContentNodesFromParts`)
- When deleting token nodes, always explicitly set selection to a `TextNode` sibling
- Test focus retention after every delete at mention boundaries

---

## Issue 6: Caret Disappears at Mention Boundary

### Symptom

After Backspace deleted the character immediately before an inline element, the **blinking caret vanished**. A second Delete was needed to remove the mention itself.

### Root Cause

The spacer-delete path removed the mention but left selection in an inconsistent state — sometimes in a multi-space text node (`"  "`) or at offset 0 of an empty spacer, which the browser renders as no visible caret.

### Fix

Extended the spacer-delete fallback to treat **any whitespace-only prefix** before the caret as a mention boundary (not just a single `" "` at offset 1):

```typescript
if (isBackward && text.slice(0, offset).trim() === "") {
  const previousMention = findMentionAcrossWhitespace(node, "previous");
  // remove mention + normalize spacer + refocus
}
```

`findMentionAcrossWhitespace` walks backward through adjacent whitespace-only text nodes to find the preceding mention.

### Prevention

- Model mention spacing as **structural whitespace runs**, not individual characters
- After boundary operations, verify both Lexical selection *and* visible DOM caret

---

## Issue 7: Too Many Delete Presses Between Multiple Mentions

### Symptom

With several inline mentions inserted, Backspace required **extra keypresses** — each press deleted a spacer character rather than the next mention token.

### Root Cause (confirmed via runtime logs)

Insertion created overlapping spacer nodes:

```
[mention] [" "] [" "] [mention] [" "]
```

When Lexical merged adjacent text nodes, spacers became `"  "` or `"   "`. Each Backspace deleted one space character instead of the adjacent mention.

Log evidence (paraphrased):

- Before insert: `[mention] [" "]`
- After second insert: `[mention] ["  "] [mention] [" "]`
- Backspace on `"  "` → plain text delete removes one space, not the mention

### Fix

Two complementary changes:

**On insert — `normalizeMentionSpacing()`:**

After `$insertNodes`, collapse each mention's trailing whitespace run to exactly one `" "` and remove duplicate spacer text nodes.

**On delete — `findMentionAcrossWhitespace()`:**

When the caret sits in whitespace-only text, skip the entire whitespace run and delete the adjacent mention in one action.

### Prevention

- Run spacing normalization after **every** mention insertion path, not just bulk insert
- When adding new mention insertion code paths, log or inspect the Lexical node sequence: `[mention][text:len=1]` between tokens, never `[text:len=2+]`
- Add a regression test: insert N mentions, Backspace N times → empty editor

---

## Issue 8: Double Visual Space Between Multiple Mentions

### Symptom

Selecting multiple elements and inserting them inline showed **two spaces** between mention chips instead of one.

### Root Cause

`insertMentionsAtSelection` builds nodes as:

```typescript
for (const mention of mentions) {
  nodes.push($createTextNode(" "));  // leading spacer
  nodes.push($createMentionNode(...));
  nodes.push($createTextNode(" "));  // trailing spacer
}
```

When inserting the second mention at the caret (which already sits in a trailing `" "` from the first mention), the pattern produces:

```
[mention1][" "][" "][mention2][" "]
         ^^^^^ ^^^^^
         existing + new leading = double gap
```

### Fix

`normalizeMentionSpacing()` (same helper as Issue 7) runs at the end of every insert:

1. For each mention, find its next sibling if it is whitespace-only
2. Set that sibling's content to exactly `" "`
3. Remove any additional whitespace-only siblings after it

### Prevention

- Treat mention spacing as **normalized invariants**, not insertion-time perfection
- Prefer post-insert normalization over trying to compute perfect spacer insertion at cursor time — cursor context varies too much
- Visually inspect multi-mention insert during QA

---

## Document-Level Keyboard Handler Interaction

During debugging, a hypothesis was that `Tuna.tsx`'s document `keydown` handler intercepted Backspace/Delete meant for the comment editor.

**Finding:** The handler already guards correctly:

```typescript
if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
```

This was **not** the root cause of the editor bugs, but it remains a footgun: any new document-level delete handler must preserve this guard.

---

## Current Invariants (Do Not Break)

These rules summarize the stable state after all fixes:

1. **`MentionNode` constructor is pure** — no `setMode()`, no `getWritable()`
2. **Every mention has exactly one trailing `" "` spacer** after insertion (enforced by `normalizeMentionSpacing`)
3. **Document always ends in an editable `TextNode`** when the last node is a mention
4. **Character deletion uses `spliceText`**, not `Selection.modify()`
5. **Character insertion uses capture-phase `beforeinput` + `spliceText`** in Shadow DOM
6. **Mention deletion skips whitespace runs** and refocuses the editor
7. **`KeyPlugin` only stops propagation for Enter/Escape**
8. **Explicit `selectedElements: []` means zero mentions** — resolvers must not fall back to legacy primary `elementInfo` fields ([Issue 9](./overlay-comment-mode-postmortem.md#part-3-deleted-mentions-reinserting-issue-9))

---

## Recommended Test Matrix

Run these manually in the playground with the comment popover open (Shadow DOM active):

| Scenario | Expected |
|---|---|
| Type `"hello world"` at normal speed | All characters appear in order |
| Backspace through typed text | One character removed per press |
| Cmd+A → Delete | All content cleared, no crash |
| Insert 1 mention, type after it | Cursor stays after mention, text appends correctly |
| Insert 3 mentions at once | Single space between each mention visually |
| Backspace from end through 3 mentions | One mention removed per press (not one space per press) |
| Backspace at mention boundary | Caret stays visible; popover stays focused |
| Delete forward through mention | Same as backspace but forward direction |
| Type emoji, backspace once | Whole emoji removed (surrogate pair) |
| Enter / Escape | Submit / cancel without breaking editor state |

---

## Debugging Guide

If comment editor input breaks again:

### 1. Determine the layer

| Layer | Quick check |
|---|---|
| Lexical state | Log `$getRoot().getTextContent()` and node types in `editor.update` |
| DOM vs state drift | Compare DOM `textContent` of contenteditable to Lexical root text |
| Focus | Log `document.activeElement` and shadow root `activeElement` on blur |
| Event interception | Log `e.defaultPrevented` in capture-phase keydown/beforeinput |

### 2. Inspect mention node sequence

In devtools or a temporary log, dump siblings after each mention:

```typescript
root.getAllTextNodes().map(n => ({
  type: $isMentionNode(n) ? "mention" : "text",
  text: n.getTextContent(),
  len: n.getTextContent().length,
}));
```

Red flags: consecutive text nodes with `len > 1` containing only spaces, or two text nodes between mentions.

### 3. Bisect custom handlers

The editor has three custom input layers — disable one at a time:

1. `DELETE_CHARACTER_COMMAND` handler (delete)
2. `beforeinput` capture handler (insert)
3. `normalizeMentionSpacing()` (spacing)

### 4. Shadow DOM sanity check

Confirm the editor root's `getRootNode()` returns a `ShadowRoot`. If the editor ever moves to light DOM, re-evaluate whether the custom handlers are still necessary.

---

## Future Improvements

These were not required for the fix but would reduce fragility:

- **Unit tests** for `normalizeMentionSpacing` with synthetic Lexical editor states
- **Single insertion builder** that accepts cursor context and emits minimal nodes (instead of insert-then-normalize)
- **Lexical ShadowRoot plugin** upstream — check if newer Lexical versions address shadow DOM selection officially
- **Playwright regression spec** covering the test matrix above

---

## Related Reading

- [Overlay Comment Mode: Session Postmortem](./overlay-comment-mode-postmortem.md) — code quality pass, mention reinsert bug (Issue 9), mixed element/drawing sync (Issue 10), dashed outline suppression (Issue 11), draft/editor/picker state ownership
- [Comment Editor: Mention Delete & Live Editing](./comment-editor-mention-delete-and-live-editing.md) — wrong mention on Backspace/Delete (Issue 12), live shift/alt editing (Issue 13), mention titles/colors (Issues 14–15), typecheck CI (`cf764cd`)
- [Lexical TextNode token mode](https://lexical.dev/docs/concepts/nodes#textnode)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — editor state should be mutated in event handlers, not synced via Effects
- Tuna comment architecture: `packages/overlay/src/overlay/comment/comment-draft.ts` (serialization of inline mentions)
