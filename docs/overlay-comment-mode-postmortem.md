# Overlay Comment Mode: Session Postmortem

This document records **all issues encountered during the comment-editor work session** (thermo-nuclear code quality review, Lexical/Shadow DOM fixes, mention-deletion bugs, mixed element/drawing sync, dashed-outline regressions, and debug instrumentation), how each was diagnosed and fixed, and how to avoid regressions.

It complements the deeper Lexical-specific guide: [Comment Editor: Lexical + Shadow DOM](./comment-editor-lexical-shadow-dom.md).

**Later session (June 2026):** [Comment Editor: Mention Delete & Live Editing](./comment-editor-mention-delete-and-live-editing.md) — wrong mention on Backspace/Delete, live shift/alt editing, mention titles/colors, typecheck CI (`cf764cd`).

**Primary commits:**

| Commit | Summary |
|---|---|
| `c4db19d` | Restore reliable typing and deletion in the Lexical comment editor (Shadow DOM) |
| `07f14bf` | Consolidate comment mention sync; fix deleted mentions reinserting |
| `09a7192` | Fix mixed mention clearing; suppress drawing area outlines (`fromDrawing` marker) |

---

## Scope of This Session

The session had four phases:

1. **Thermo-nuclear code quality review** — audit comment-mode changes and adjacent overlay code; implement high-confidence cleanup without a risky full decomposition of mega-files.
2. **Lexical + Shadow DOM stabilization** — fix typing, deletion, mention spacing, and focus inside the shadow-root comment editor (documented in detail in the Lexical postmortem).
3. **Mention deletion regressions** — user reported that deleting the first inline selected-element mention added spaces instead of removing it; then Cmd+A + Delete on mixed element/drawing mentions cleared drawings but left element outlines selected; then drawings remained visually selected.
4. **Drawing area outline regressions** — dashed `tuna-comment-area-outline` appeared around drawing-based comment drafts, including after deleting all inline element mentions from a mixed selection.

---

## Architecture: Three Sources of Truth

Most bugs in this session came from **unclear ownership** between three layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Picker / DOM selection (Tuna, picker.ts)                 │
│  — element outlines, drawing path selection, SVG appearance │
└──────────────────────────┬──────────────────────────────────┘
                           │ sync on pick / outline update
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Comment draft (comment-draft.ts, use-comment-mode.ts)      │
│  — elementInfo.selectedElements, spanMentionCount, area     │
└──────────────────────────┬──────────────────────────────────┘
                           │ mentions prop
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Lexical editor (CommentEditor.tsx, mention-node.ts)        │
│  — MentionNode tokens + spacer text nodes in editor state   │
└─────────────────────────────────────────────────────────────┘
```

A fourth visual layer sits **outside** the picker:

```
┌─────────────────────────────────────────────────────────────┐
│  React chrome (Tuna.tsx)                                  │
│  — tuna-comment-area-outline (dashed box for area drafts) │
└─────────────────────────────────────────────────────────────┘
```

**Invariants after all fixes:**

1. When the editor removes all inline mentions, `elementInfo.selectedElements` must be **`[]` (explicit empty array)**, and resolvers must treat that as authoritative — not as "missing data."
2. When the editor removes all inline mentions, **both** React picker state **and** picker visual chrome must be updated for **each target type** (elements and drawings).
3. Draw-derived area drafts must carry **`fromDrawing: true`** so the dashed React outline stays suppressed even after mention edits rewrite `elementInfo`.

---

## Part 1: Code Quality Review Findings & Fixes

A thermo-nuclear review flagged maintainability issues in the comment-mode branch and adjacent overlay code. The immediate pass focused on **consolidation and type safety**, deferring full file splits.

### Issue A: Duplicated `SELECTION_COLORS`

**Symptom:** The same color palette was defined in `picker.ts` and imported indirectly by comment UI.

**Fix:** Single source in `packages/overlay/src/ui/selection-colors.ts`. `picker.ts` re-exports for backward compatibility; `CommentPopover.tsx` and `comment-draft.ts` import from the canonical module.

**Prevention:** Shared visual tokens belong in `packages/overlay/src/ui/`, not duplicated inside feature modules.

### Issue B: Scattered draft target rebuilding

**Symptom:** `use-comment-mode.ts` hand-built `elementInfo.selectedElements` in three separate code paths (add elements, remove elements, sync from editor). Each path duplicated primary-field promotion logic (`tagName`, `componentName`, etc.).

**Fix:** Consolidated helpers in `comment-draft.ts`:

| Helper | Role |
|---|---|
| `resolveCommentElementTargets()` | Read targets from `elementInfo` (multi-select array or legacy single-element fallback) |
| `applyTargetsToDraft()` | Write a target list back onto a draft (primary promotion + `spanMentionCount`) |
| `getDraftElementTargets()` | Convenience: resolve from a full draft |
| `syncElementTargetsInDraft()` / `syncDrawingTargetsInDraft()` | Route picker/editor changes through `applyTargetsToDraft()` |

**Prevention:** Any new code path that mutates comment element targets should call `applyTargetsToDraft()` — never rebuild `elementInfo` inline.

### Issue C: Untyped comment store mutations

**Symptom:** Area-resize handlers in `Tuna.tsx` mutated `comment.area`, `comment.position`, and `(comment.elementInfo as any).containedElements` directly, then called `store.persist()`.

**Fix:** Added `CommentStore.patch(id, updates)` in `comment-store.ts` with a typed `CommentPatch` interface. Resize handlers compute `nextArea` / `containedElements` and patch atomically.

**Prevention:** Prefer `store.patch()` over direct field mutation + manual `persist()`. Avoid `as any` on `elementInfo` — extend `CommentPatch` if new fields need updating.

### Issue D: Large-file maintainability (deferred)

**Finding:** `Tuna.tsx` (~4k lines), `picker.ts` (~3k lines), and `identifier.ts` exceed the 1k-line maintainability threshold. Comment-mode logic adds branching to already-busy files.

**Decision:** Do **not** decompose these in the same pass as bug fixes. Track as follow-up extractions (comment orchestration module, picker selection submodule).

### Tests added (code quality pass)

- `comment-text-parse.test.ts` — target resolution, `syncElementTargetsInDraft`, clearing targets via shared path
- `comment-store.test.ts` — `CommentStore.patch()` behavior
- Existing `picker-utils.test.ts` — `SELECTION_COLORS` uniqueness

---

## Part 2: Lexical + Shadow DOM Issues (Issues 1–8)

Eight distinct bugs affected the inline comment editor inside Tuna's Shadow DOM. They are documented exhaustively in [comment-editor-lexical-shadow-dom.md](./comment-editor-lexical-shadow-dom.md).

**Summary table:**

| # | Symptom | Root cause (short) |
|---|---|---|
| 1 | Cmd+A → Delete crashes (stack overflow) | `setMode("token")` in `MentionNode` constructor → infinite clone loop |
| 2 | Normal Backspace does nothing | `Selection.modify()` unreliable in Shadow DOM |
| 3 | Typing skips characters | Native `beforeinput` vs Lexical state drift |
| 4 | Chars insert before cursor; delete regresses | Double-handling + blanket `stopImmediatePropagation` on keydown |
| 5 | Deleting mentions unfocuses popover | Caret lands inside `contentEditable=false` token |
| 6 | Caret disappears at mention boundary | Selection left in multi-space or empty spacer node |
| 7 | Too many Delete presses between mentions | Accumulated spacer text nodes (`"  "`, `"   "`) |
| 8 | Double visual space between mentions | Leading + trailing spacers overlap on sequential insert |

**Stable invariants (do not break):**

1. `MentionNode` constructor is pure — no `setMode()`, no `getWritable()`
2. Every mention has exactly one trailing `" "` spacer after insertion (`normalizeMentionSpacing`)
3. Document ends in an editable `TextNode` when the last node is a mention
4. Character deletion uses `TextNode.spliceText()`, not `Selection.modify()`
5. Character insertion uses capture-phase `beforeinput` + `spliceText` in Shadow DOM
6. Mention deletion skips whitespace runs and refocuses the editor
7. `KeyPlugin` only stops propagation for Enter/Escape

See the Lexical doc for the **manual regression test matrix** and debugging bisection guide.

---

## Part 3: Deleted Mentions Reinserting (Issue 9)

This was the **primary bug reported after the code-quality pass** and is the most important lesson from the draft/editor boundary.

### Symptom

Deleting the **first** inline selected-element mention in the chat input appeared to **add spaces behind it** rather than remove the mention cleanly. With repeated Backspace, whitespace accumulated in front of a mention that would not go away.

### Why it looked like a spacing bug

The Lexical delete handler **did remove the mention**. Each deletion cycle also left or recreated a leading spacer text node. Immediately afterward, prop reconciliation **reinserted the same mention** via `insertMentionsAtSelection()`. From the user's perspective: spaces grow, mention stays — not "mention comes back obviously," because the reinsert happened in the same frame as the delete.

### Diagnosis (runtime logs, session `2161c0`)

Five hypotheses were tested:

| ID | Hypothesis | Verdict |
|---|---|---|
| H1 | Caret in whitespace before first mention; backward-delete searches wrong direction | **Rejected** — delete command correctly found and removed the mention |
| H2 | Selection repair leaves spacer nodes that accumulate | **Partial** — contributes to visible spaces, not root cause |
| H3 | First mention has unexpected leading spacer from insertion | **Rejected** for this repro path |
| H4 | Native `beforeinput` delete double-mutates after custom handler | **Rejected** — no `beforeinput delete` events in logs |
| H5 | Parent/prop layer reinserts mention after editor sync sets `selectors: []` | **Confirmed** |

**Log sequence (confirmed):**

1. `DELETE_CHARACTER_COMMAND` removes mention; Lexical root shows fewer mention nodes.
2. `syncCommentDraftMentionsFromEditor` runs → draft gets `selectedElements: []`, `selectors: []`.
3. `CommentEditor` mentions-prop effect runs → `nextSelectors` is **non-empty** again.
4. `insertMentionsAtSelection()` reinserts the deleted mention + spacers.
5. Repeat on each Backspace → whitespace accumulates.

### Root cause

`resolveCommentElementTargets()` used:

```typescript
if (elementInfo.selectedElements?.length) return elementInfo.selectedElements;
```

In JavaScript, **`[].length` is `0` (falsy)**. So when the editor correctly synced `selectedElements: []`, the resolver treated it as "no array" and **fell back to legacy primary fields** on `elementInfo` (`tagName`, `componentName`, `textContent`, etc.). Those primary fields were **never cleared** when mentions were removed — only the array was emptied.

The prop-reconciliation effect in `CommentEditor` compared previous vs next mention selectors, saw the "missing" mention as newly added, and called `insertMentionsAtSelection()`.

### Failed fix attempt

**Speculative fix:** When editor mention sync left zero inspected targets, call `pickerRef.current?.clearSelection()`.

**Result:** Logs showed `clearSelection` fired, but reinsertion **still occurred** because the resolver continued to fall back to stale `elementInfo` primary fields. This fix was **reverted**.

### Actual fix

Treat an explicit empty array as intentional "zero mentions":

```typescript
// comment-draft.ts — resolveCommentElementTargets()
if (Array.isArray(elementInfo.selectedElements)) return elementInfo.selectedElements;
// only fall back to legacy single-element shape when selectedElements is absent (undefined)
```

When all mentions are removed, `applyTargetsToDraft()` with an empty target list also sets `selectedElements: []` and `spanMentionCount: 0`.

**Commit:** `07f14bf`.

### Prevention

| Do | Don't |
|---|---|
| Use `Array.isArray(x)` to distinguish **absent** vs **empty** | Use `arr?.length` as a proxy for "has array" |
| Clear or overwrite **both** `selectedElements` and legacy primary fields when mentions go to zero | Assume emptying the array alone communicates "no targets" if readers fall back to primary fields |
| Log `selectors` at the **prop reconciliation** boundary when debugging mention sync | Assume Lexical delete bugs when mentions "come back" — check draft resolver first |
| Add unit test: `resolveCommentElementTargets({ ..., selectedElements: [] })` → `[]` | Rely on manual QA alone for editor ↔ draft sync |

**Unit test added:** `comment-text-parse.test.ts` — `"treats an explicit empty selectedElements array as no targets"`.

---

## Part 4: Debug Instrumentation Crash

### Symptom

While debugging Issue 9, the app threw:

```
Unable to find an active editor state. State helpers or node methods can only be used
synchronously during the callback of editor.update(), editor.read(), or editorState.read().
```

Stack pointed at debug logging inside `CommentEditor`'s mentions-prop `useEffect`.

### Root cause

Temporary logging called Lexical node helpers (e.g. walking the root for debug) **outside** `editor.read()` / `editor.update()`. Lexical requires all node reads/writes inside those callbacks.

### Fix

1. Wrap debug reads in `editor.getEditorState().read(() => { ... })`.
2. Remove all instrumentation after fixes were confirmed.

### Prevention

- Never call `$getRoot()`, `$isMentionNode()`, or node methods from React effects, timeouts, or fetch handlers without an `editor.read()` boundary.
- Prefer logging **draft-level** data (`selectors`, `selectedElements`) in parent hooks when isolating sync bugs — less fragile than Lexical internals.

---

## Part 5: Mixed Element + Drawing Select-All Delete (Issue 10)

This issue had **four distinct root causes** discovered iteratively. Each looked like the same bug from the user's perspective but required a separate fix.

### Symptom (overall)

When an element mention and a drawing mention were both inserted inline in the chat input, **Cmd+A + Delete** did not fully clear both target types and their visual chrome. The failure mode changed after each partial fix:

1. Initially: drawings cleared, element outlines stayed selected.
2. After element fix: editor text cleared, element outlines cleared, drawings stayed selected.
3. After drawing selection fix: drawing **selection state** cleared, but paths still looked selected (filled stroke).

### Issue 10a: Picker delete shortcut stole Backspace from the editor

**Symptom:** Cmd+A + Delete in the Lexical editor sometimes deleted drawings but not element mentions, or behaved inconsistently.

**Root cause:** `picker.ts` registers a document-level `keydown` handler that deletes selected drawings on Delete/Backspace. It ran even when focus was inside the comment editor's `contentEditable` div, intercepting the keystroke before Lexical could process a range delete of all mentions.

**Fix:** Guard the picker shortcut the same way Tuna's document-level delete handler does:

```typescript
// picker.ts — drawing delete shortcut
const target = e.composedPath()[0] as HTMLElement | undefined;
if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
```

**Prevention:** Any global keyboard shortcut in `picker.ts` or `Tuna.tsx` must check `composedPath()[0]` for input/contenteditable targets before calling `preventDefault()`.

### Issue 10b: Element outlines not cleared when all mentions removed

**Symptom:** After Cmd+A + Delete, inline text and drawing selection cleared, but element selection outlines remained on the page.

**Root cause:** `syncCommentDraftMentionsFromEditor()` updated React state (`selectedElementsRef`, `setSelectedElements`) but only called `pickerRef.current?.showSelectionOutline(...)` when `remainingInspected.length > 0`. Drawings had an explicit empty path via `selectDrawPaths([])` in `handleCommentMentionsChange()`; elements did not.

**Fix:**

```typescript
// use-comment-mode.ts
if (remainingInspected.length > 0) {
  pickerRef.current?.showSelectionOutline(...);
} else {
  pickerRef.current?.showSelectionOutline([]);
}
```

**Prevention:** Every editor mention sync path must update **both** React state **and** picker visual state for empty and non-empty cases. Prefer type-specific clearing (`showSelectionOutline([])` for elements, `selectDrawPaths([])` for drawings) over `clearSelection()` in mixed flows.

### Issue 10c: Drawings looked selected after deselection (fill styling)

**Symptom:** After clearing all inline mentions, drawing SVG paths retained a filled appearance as if still selected.

**Root cause:** `syncDrawingPathAppearance()` applied fill to unselected paths when `drawMode` was true:

```typescript
path.setAttribute("fill", drawMode ? fillForColor(baseColor) : "none");
```

During an open comment draft, `drawMode` stays true (user may still be annotating), so deselected paths looked selected.

**Fix:** Only apply draw-mode fill when not in an active comment draft:

```typescript
path.setAttribute("fill", drawMode && !commentDraftActive ? fillForColor(baseColor) : "none");
```

**Prevention:** Distinguish **draw tool active** from **path visually selected**. Fill/stroke styling must consider `commentDraftActive`, `selectedDrawPaths`, and `drawMode` together — not any one flag alone.

### Issue 10d: `refreshSelectionVisuals()` skipped drawing appearance reset

**Symptom:** Even after Issue 10c's fill fix, paths could retain stale appearance when both element and drawing selections became empty simultaneously.

**Root cause:** `refreshSelectionVisuals()` called `hideSelection()` at the end but did not call `syncDrawingPathAppearance()` when both `selectedElements` and `selectedDrawPaths` were empty — even if drawing paths still existed on the canvas.

**Fix:**

```typescript
// picker.ts — refreshSelectionVisuals()
if (drawingSvg.childElementCount > 0) {
  syncDrawingPathAppearance();
}
hideSelection();
```

**Prevention:** Any code path that clears selection state must also refresh **all** visual layers affected by that state — outlines, drawing stroke/fill, and React chrome are separate.

**Commit:** `09a7192` (with Issue 11).

---

## Part 6: Dashed Area Outline on Drawing-Based Drafts (Issue 11)

### Symptom

A dashed rectangle (`tuna-comment-area-outline`) appeared around drawing-based comment drafts. This is **not** picker chrome — it is a React element rendered when `commentDraft.type === "area"`.

Observed variants:

1. **Immediately after opening chat from draw popup** — dashed box around the drawing's bounding box.
2. **Mixed selection (elements + Shift+draw)** — dashed box around the combined bounding area.
3. **After deleting all inline element mentions** — dashed box reappeared even though the draft was still drawing-derived.

### Why it happens

The draw tool creates an area draft: `type: "area"` with `area` set to the drawings' bounding box. `Tuna.tsx` renders a dashed outline for any area draft. Drawing-based comments should show only the SVG paths, not an additional dashed box.

### Failed fix attempts

**Attempt 1:** Suppress when `elementInfo.tagName === "drawing"`.

**Result:** Worked for pure drawing drafts, but failed for mixed selections where `enrichCommentDraft()` promoted a DOM element's tag (e.g. `"button"`) as the primary `tagName` while a drawing target remained in `selectedElements`.

**Attempt 2:** Also suppress when any `selectedElements` entry has `tagName === "drawing"`.

**Result:** Worked on initial open for mixed selections, but **failed after deleting all inline mentions**. Logs (session `2161c0`, H16 probe) showed:

```json
{
  "primaryTagName": "button",
  "selectedElementTagNames": [],
  "hasArea": true
}
```

After `applyTargetsToDraft(draft, [])`, `selectedElements` became `[]` but legacy primary fields (`tagName: "button"`) were preserved via spread. Neither suppression condition matched.

### Actual fix

Add a persistent top-level draft marker set once at draw-comment creation:

```typescript
// comment-draft.ts
export type CommentDraft = {
  // ...
  /** Area derived from draw tool bounds, not a drag-to-area gesture */
  fromDrawing?: boolean;
};

// Tuna.tsx — handleDrawComment()
const draft = enrichCommentDraft({
  type: "area",
  area,
  fromDrawing: true,
  // ...
});

// Tuna.tsx — draft area outline render
{active && commentDraft?.type === "area" && commentDraft.area
  && !commentDraft.fromDrawing
  && commentDraft.elementInfo?.tagName !== "drawing"
  && !commentDraft.elementInfo?.selectedElements?.some(t => t.tagName === "drawing") && (
  <div className="tuna-comment-area-outline" ... />
)}
```

`fromDrawing` survives `applyTargetsToDraft()` because that helper spreads `...draft` at the top level. The tagName/selectedElements checks remain as defense-in-depth for saved comments and drafts created before the marker existed.

The same suppression logic was applied to **saved** area comments in `Tuna.tsx`.

**Commit:** `09a7192`.

### Prevention

| Do | Don't |
|---|---|
| Mark draft **provenance** (`fromDrawing`, `fromDragArea`) at creation time | Infer draft intent from `elementInfo.tagName` after enrichment rewrites it |
| Put persistent flags on the **draft top level**, not inside `elementInfo` fields that get overwritten | Rely on `selectedElements.some(...)` alone when the array can become `[]` |
| Suppress React chrome based on draft provenance **and** current target composition | Assume `type === "area"` always means "show dashed box" |

---

## Part 7: State Ownership Rules

These rules summarize lessons from Issues 1–11:

### Editor → Draft (user edits text / deletes mentions)

1. `CommentEditor` emits mention selector changes via `onMentionsChange`.
2. `syncCommentDraftMentionsFromEditor` in `use-comment-mode.ts` maps selectors → targets → `applyTargetsToDraft()`.
3. Result must include **`selectedElements: []`** when the last mention is removed — not `undefined`, not omitted.
4. Also clear picker visuals: `showSelectionOutline([])` for elements; `selectDrawPaths([])` for drawings (via `handleCommentMentionsChange`).

### Draft → Editor (props drive mention chips)

1. `getDraftElementTargets(draft)` → `resolveCommentElementTargets()` → mention list for `CommentEditor`.
2. Prop effect diff adds/removes mentions in Lexical.
3. **If resolver lies** (returns stale target when array is empty), editor will reinsert.

### Picker → Draft (user selects elements on page)

1. Picker selection updates inspected elements.
2. `syncElementTargetsInDraft` merges DOM targets with existing drawing targets.
3. Picker state and draft state can temporarily diverge during editor-driven removal — that's OK **as long as the draft resolver doesn't fall back to stale data**.

### Legacy `elementInfo` primary fields

Legacy comments stored a single element on `elementInfo` without `selectedElements`. The fallback path in `resolveCommentElementTargets()` exists for **backward compatibility** with saved comments and drafts that predate multi-select.

Once `selectedElements` exists on an object — **even as `[]`** — it is the sole source of truth for inline mentions.

### Visual chrome is not one system

| Visual | Owner | Cleared by |
|---|---|---|
| Element selection outlines | `picker.ts` | `showSelectionOutline([])` |
| Drawing path stroke/fill | `picker.ts` | `syncDrawingPathAppearance()` |
| Dashed area box | `Tuna.tsx` React render | Suppress via `fromDrawing` / tag checks |
| Inline mention chips | Lexical `CommentEditor` | Editor delete + prop reconciliation |

A bug in one layer often looks like a bug in another. When debugging, log **which layer** still shows stale state.

---

## Part 8: Verification Checklist

### Automated

```bash
cd packages/overlay
npm test -- src/__tests__/comment-text-parse.test.ts src/__tests__/comment-store.test.ts src/__tests__/picker-utils.test.ts
npm test   # full suite
```

Key regression tests in `comment-text-parse.test.ts`:

- `"treats an explicit empty selectedElements array as no targets"`
- `"clears mixed element and drawing targets through the shared draft application path"`

### Manual

| Scenario | Expected |
|---|---|
| Insert 2+ inline mentions, Backspace through **first** mention | Mention removed; no space growth; no reinsert |
| Delete all mentions one by one | Editor empty; draft `selectedElements: []`; no phantom mention |
| Delete last remaining mention | Same as above; popover stays focused |
| Type after deleting all mentions | Normal typing; no mention reappears |
| Insert one element mention + one drawing mention, Cmd+A → Delete | Both mentions removed; element outlines cleared; drawing paths deselected (no fill) |
| Draw with draw tool, open comment from popup | No dashed area outline around drawing |
| Select elements, Shift+draw, open comment | No dashed area outline |
| Mixed draft: Cmd+A → Delete all inline mentions | No dashed area outline reappears |
| Drag-to-area comment (not from draw tool) | Dashed area outline **does** appear |

---

## Part 9: Debugging Methodology Used in This Session

When comment-mode bugs recurred, the session followed a consistent loop:

1. **Generate 3–5 falsifiable hypotheses** spanning editor, draft, picker, and React chrome layers.
2. **Instrument at boundaries** — prop reconciliation, `syncCommentDraftMentionsFromEditor`, picker delete shortcuts, render decisions — not deep inside Lexical unless the layer is confirmed.
3. **Reproduce once** with clean logs.
4. **Evaluate each hypothesis** as CONFIRMED / REJECTED / PARTIAL with cited log lines.
5. **Apply one minimal fix** per confirmed root cause.
6. **Verify with a second log run** before removing instrumentation.
7. **Revert speculative fixes** when logs reject the hypothesis — do not accumulate defensive guards.

Common misdirection:

- **"Lexical delete is broken"** → often draft resolver reinserting via props (Issue 9).
- **"Selection state is wrong"** → often picker visuals not updated on empty branch (Issue 10b).
- **"Drawing still selected"** → often SVG appearance not refreshed, not selection state (Issues 10c/10d).
- **"Wrong outline showing"** → often React `tuna-comment-area-outline`, not picker (Issue 11).

---

## Part 10: Deferred Work

| Item | Rationale |
|---|---|
| Split `Tuna.tsx` comment orchestration | Reduces merge conflicts; too large for bugfix pass |
| Split `picker.ts` selection/outline module | Same |
| Lexical unit tests for `normalizeMentionSpacing` | Issues 7–8 |
| Playwright spec for full comment matrix | Automate Lexical + draft sync + drawing flows |
| Clear legacy primary fields when `selectedElements` becomes `[]` | Would make fallback path safer; not required once resolver is correct |
| Persist `fromDrawing` on saved comments at submit time | Currently only needed on drafts; saved comments use tagName checks |

---

## Key Files Reference

| File | Role |
|---|---|
| `packages/overlay/src/ui/selection-colors.ts` | Canonical mention/selection palette |
| `packages/overlay/src/overlay/comment/comment-draft.ts` | Draft model, `fromDrawing`, target resolve/apply, text parse |
| `packages/overlay/src/overlay/comment/use-comment-mode.ts` | Hook: draft state, editor ↔ picker sync |
| `packages/overlay/src/overlay/comment/CommentEditor.tsx` | Lexical composer, input/delete, prop reconciliation |
| `packages/overlay/src/overlay/comment/mention-node.ts` | Custom `MentionNode` |
| `packages/overlay/src/engine/comment-store.ts` | Persisted comments + `patch()` API |
| `packages/overlay/src/overlay/Tuna.tsx` | Overlay shell, dashed area outline, document keyboard guards |
| `packages/overlay/src/selector/picker.ts` | DOM selection, drawing appearance, outline colors |
| `packages/overlay/src/__tests__/comment-text-parse.test.ts` | Target resolution and draft sync regression tests |

---

## Related Reading

- [Comment Editor: Lexical + Shadow DOM](./comment-editor-lexical-shadow-dom.md) — Issues 1–8, test matrix, Lexical debugging
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — editor/draft sync belongs in event handlers, not effects that fight Lexical
- [Lexical TextNode token mode](https://lexical.dev/docs/concepts/nodes#textnode)
