# Comment Editor: Mention Delete & Live Editing Session

This document records **issues encountered in the June 2026 comment-editor debugging session** — wrong mention deletion on Backspace/Delete, live shift/alt mention editing while the popover is open, mention title/color regressions, typecheck/CI hardening, and picker refactor work — how each was diagnosed and fixed, and how to avoid regressions.

It extends the earlier session docs:

- [Overlay Comment Mode: Session Postmortem](./overlay-comment-mode-postmortem.md) — Issues 1–11 (draft/editor sync, mixed drawing sync, dashed outlines)
- [Comment Editor: Lexical + Shadow DOM](./comment-editor-lexical-shadow-dom.md) — Issues 1–8 (typing, spacing, focus in Shadow DOM)

**Primary commit:** `cf764cd` — `fix(overlay): delete the correct inline mention and improve live comment editing.`

---

## Scope of This Session

Four workstreams ran in parallel:

1. **Wrong mention deletion** — clicking in front of the second inline mention and pressing Backspace/Delete removed the first mention instead.
2. **Live mention editing** — shift-click to add and alt-click to remove mentions while the comment popover stays open.
3. **Mention presentation** — titles showed framework wrapper names (`InnerScrollAndFocusHandlerOld`) instead of user-facing component names (`TryItButton`); selection colors drifted after alt-deselect.
4. **Engineering hygiene** — overlay typecheck script + CI workflow, TypeScript fixes, picker module extraction, Retune component splits.

---

## Architecture: Four Layers for Delete Intent

The wrong-mention-delete bug exposed a **fourth input layer** on top of the three sources of truth documented in the earlier postmortem:

```
┌─────────────────────────────────────────────────────────────┐
│  Pointer geometry (document pointerdown capture)            │
│  — getPointerIntentMentionSelector() from DOM rects         │
└──────────────────────────┬──────────────────────────────────┘
                           │ latestPointerIntentMentionSelector
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Lexical selection (often stale in Shadow DOM)              │
│  — anchor node + offset in spacer TextNodes                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ DELETE_CHARACTER_COMMAND handler
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Comment draft (elementInfo.selectedElements)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ mentions prop reconciliation
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Lexical MentionNode tokens                                 │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** In Retune's Shadow DOM comment popover, a click that *looks* like it placed the caret "in front of" a mention often **does not update Lexical's selection**. The DOM event target may be outside the `contenteditable` subtree even when the click coordinates fall inside the editor's bounding box. Lexical then keeps a **stale caret** — frequently at the spacer after the first mention — and the delete handler removes the **previous** mention.

The fix treats **pointer geometry as first-class delete intent**, not just Lexical selection.

---

## Issue 12: Wrong Mention Deleted on Backspace/Delete

### Symptom

With two or more inline mentions (e.g. `@TryItButton` `@HeroInstallCopy`):

1. Click immediately **in front of the second** mention (the gap between chips, or just before the second chip).
2. Press **Backspace** or **Delete**.
3. **Expected:** second mention removed.
4. **Actual:** first mention removed (or whitespace grows while the wrong mention stays).

This persisted through several fix attempts because partial fixes worked in some click geometries but not others.

### Root causes (confirmed via runtime logs, session `efd493`)

| ID | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| H1 | Clicks miss the Lexical editor DOM; stale selection drives delete | **CONFIRMED** | Logs: `targetInsideEditor: false`, `inEditorBounds: true`, stale anchor on spacer after first mention |
| H2 | Backspace at offset 1 in whitespace gap deletes **previous** mention | **CONFIRMED** | Code path only preferred **next** mention at `offset === 0`; offset 1 fell through to `findMentionAcrossWhitespace(..., "previous")` |
| H3 | Caret lands inside editor but on wrong node | **CONFIRMED** | rAF selection logs showed anchor on spacer after M1 while pointer intent correctly identified M2 |
| H4 | Pointer intent null (outside 24px slop) → Lexical path used | **PARTIAL** | Some clicks had valid intent; others relied on whitespace-gap fix |
| H5 | `suppressMentionDeleteUntilFreshInput` blocked repeat deletes | **PARTIAL** | Prevented double-delete cascades; cleared on next pointerdown |
| H6 | Pointer intent resolved to wrong mention when caret before a different one | **CONFIRMED** | Geometry "nearest" could pick M1 when caret was clearly before M2 |

### Why clicks miss the editor

Several factors combine:

1. **Mention chips are `contentEditable=false`** — clicks on the chip hit the mention span, not editable text.
2. **CommentPopover stops pointer propagation** on capture — native pointer events may not reach Lexical's default caret-placement logic for children.
3. **Shadow DOM** — selection APIs behave inconsistently; Lexical's selection may not follow visual click intent.
4. **Input wrap focus handler** — `onPointerDown={() => editorRef.current?.focus()}` focuses the editor but does not necessarily move the caret to click coordinates.

Result: the user *believes* the caret is before mention B, but Lexical's anchor is often on the spacer after mention A.

### Fix (layered defense)

All changes live in `CommentEditor.tsx`.

#### 1. Pointer intent capture (document `pointerdown`, capture phase)

On every document pointerdown:

```typescript
latestCommentEditorPointerInside = targetInsideEditor || inEditorBounds;
latestPointerIntentMentionSelector = getPointerIntentMentionSelector(root, clientX, clientY);
```

`getPointerIntentMentionSelector()` resolves intent from DOM geometry:

1. **Following boundary** — click at or before a mention's left edge on the same row (within 24px slop) → that mention.
2. **Direct hit** — click inside a mention chip's rect → that mention.
3. **Nearest fallback** — closest mention within slop.

Mention DOM nodes expose `data-mention-selector` (set in `mention-node.ts`).

#### 2. Delete via pointer intent (before Lexical selection logic)

On `DELETE_CHARACTER_COMMAND`, if `latestPointerIntentMentionSelector` is set, delete **that** mention via `removePointerIntentMention()` — bypassing stale Lexical selection.

**Guard:** If the caret is inside the editor and Lexical's **next** mention sibling differs from pointer intent, skip intent and fall through to selection-based logic (prevents deleting M1 when caret is clearly before M2 but geometry picked M1).

#### 3. Whitespace-gap backspace prefers **next** mention

When the caret is in a whitespace-only `TextNode` and `text.slice(0, offset).trim() === ""`:

```typescript
// OLD (buggy): only at offset === 0
const nextMention = offset === 0 ? findMentionAcrossWhitespace(node, "next") : null;

// NEW (correct): any offset in the gap before the next mention
const nextMention = findMentionAcrossWhitespace(node, "next");
if (nextMention) { /* delete next, not previous */ }
```

This fixes the case where Lexical places the caret at **offset 1** in the `" "` spacer between mentions.

#### 4. Suppress stale outside-editor deletes

When the pointer is outside the editor and there is no pointer intent, suppress mention deletion driven by stale Lexical selection (`selectionWouldDeleteMention` returns true but we `return true` without deleting).

#### 5. Cascade guard after intent delete

`suppressMentionDeleteUntilFreshInput` prevents a second Backspace from immediately deleting the remaining mention using stale selection. Cleared on the next pointerdown or non-mention text input.

#### 6. Spacing normalization after removal

`normalizeSpacingAfterMentionRemoval()` collapses duplicate spacers and removes leading whitespace before the first mention — prevents visual space accumulation after repeated edits.

### Failed approaches (do not reintroduce)

| Approach | Why it failed |
|---|---|
| Fix selection placement only | Clicks often never reach Lexical; selection stays stale |
| Pointer intent only, no whitespace fix | Works when intent resolves; fails when slop misses or click is inside editor at offset 1 |
| Always delete previous mention in whitespace | Wrong semantics for "cursor before next mention" |
| Claim fixed after one log run | User repro showed multiple geometry paths; required layered fix |

### Prevention

| Do | Don't |
|---|---|
| Treat pointer geometry and Lexical selection as **two inputs** that can disagree | Assume `click → caret` is reliable in Shadow DOM |
| Prefer deleting the **next** mention when caret is in whitespace before it | Only handle `offset === 0` for next-mention deletion |
| Log `targetInsideEditor`, `inEditorBounds`, `pointerIntent`, and Lexical anchor on delete | Debug only Lexical internals when clicks miss the editor |
| Test: 2 mentions, click gap before second, Backspace **and** Delete | Test only Backspace at a single offset |
| Clear pointer intent after use; guard against stale intent vs caret mismatch | Keep pointer intent across unrelated keyboard navigation |

### Manual regression matrix (Issue 12)

| Scenario | Expected |
|---|---|
| 2 mentions, click gap before **second**, Backspace | Second mention removed |
| Same, Delete (forward) | Second mention removed |
| 2 mentions, click directly on second chip, Backspace | Second mention removed |
| 2 mentions, click after all mentions, Backspace through gaps | One mention per press; no space-only presses |
| Delete first mention, then immediately Backspace again | Second mention **not** deleted until fresh click/input |
| 3+ mentions, repeat gap-click delete on each | Always deletes the visually targeted mention |

---

## Issue 13: Shift/Alt Mention Editing Blocked With Popover Open

### Symptom

With the comment popover open on an element draft, shift-click to add another element or alt-click to remove one did nothing — or the popover blocked page clicks entirely.

### Root causes

1. **`shouldBlockForPopover()`** returned true for all open popovers, blocking picker clicks when the user had unsaved text — even for element drafts that should support live mention editing.
2. **`picker.ts` guard** — when `commentDraftActive && !commentMode`, selection clicks were blocked unless shift/alt modified the click.

### Fix

**`use-comment-mode.ts`:**

```typescript
export function supportsLiveMentionEditing(draft): boolean {
  return draft?.type === "element" || draft?.type === "area";
}

const shouldBlockForPopover = () => {
  if (!popoverOpen) return false;
  if (supportsLiveMentionEditing(draft)) return false; // keep page clicks live
  // area-drag / dirty-text guard for non-live drafts...
};
```

**`picker.ts`:**

```typescript
const modifiedDraftClick = commentDraftActive && (shiftKey || altKey);
if (commentDraftActive && !commentMode && !modifiedDraftClick) return;
// allow shift/alt selection while popover is open
```

**`handleCommentSelect`** routes shift/alt diffs to `appendElementsToCommentDraft` / `removeElementsFromCommentDraft` when `liveEditable && popoverOpen`.

### Prevention

| Do | Don't |
|---|---|
| Gate popover click-blocking on draft **type** and live-edit support | Block all page interaction whenever any popover is open |
| Pass `selectionColors` through `SelectEventMeta` for color continuity | Recompute colors only from target index on append |
| Preserve `mentionColor` on existing targets via `existingTargetBySelector` map | Rebuild all targets from scratch on every append/remove |

---

## Issue 14: Wrong Mention Titles (Wrapper Component Names)

### Symptom

Inline mentions displayed `InnerScrollAndFocusHandlerOld` instead of `TryItButton` or `HeroInstallCopy`.

### Root cause

`buildCommentTargetFromInspected()` stored the **last** entry in `reactComponents` as `componentName`. React fiber paths often end with framework wrappers (scroll handlers, routers, boundary components) rather than the meaningful user component.

### Fix

`getMentionNameForTarget()` in `comment-draft.ts`:

1. Walk `componentPath` **reverse** (nearest component first).
2. Skip names matching wrapper patterns: `Boundary`, `Handler`, `Provider`, `Router`, `Positioner`, etc. (see `isLikelyWrapperComponentName`).
3. Fall back to `textContent` or capitalized tag name when no good component name exists.
4. When two peers would get the same display name, disambiguate with the text/tag fallback.

### Prevention

| Do | Don't |
|---|---|
| Prefer `componentPath` over single `componentName` for display | Blindly use the last fiber name |
| Maintain a wrapper-name denylist; extend as new patterns appear | Show raw React internal names to users |
| Disambiguate duplicate names across peers in multi-select | Assume component names are unique per page |

---

## Issue 15: Selection Color Drift After Alt-Deselect

### Symptom

After alt-click removing an element from a live comment draft, remaining mentions lost their original selection colors or all showed the same color.

### Root cause

Append/remove paths rebuilt `CommentElementTarget` objects without carrying forward `mentionColor`. Colors were re-derived from index into `SELECTION_COLORS`, which shifts when elements are removed.

### Fix

**`use-comment-mode.ts` — `buildCommentTargetWithColor()`:**

```typescript
const mentionColor = colorByElement.get(inspected.element)
  ?? existingTargetBySelector.get(target.selector)?.mentionColor;
```

On append, read colors from `SelectEventMeta.selectionColors` via `colorByElementFromMeta()`. On remove, preserve colors from the existing draft target map.

**`picker.ts` — `notifySelect()`** includes `selectionColors` in `SelectEventMeta`.

**`comment-draft.ts` — `getMentionColorForTarget()`** prefers `target.mentionColor` when set.

### Prevention

| Do | Don't |
|---|---|
| Treat `mentionColor` as part of target identity once assigned | Re-index into palette on every target list mutation |
| Thread picker colors through selection meta end-to-end | Compute colors only at initial draft creation |

---

## Issue 16: Typecheck Failures & Missing CI

### Symptom

`npx tsc --noEmit` in `packages/overlay` reported numerous errors; no CI job enforced type safety.

### Root causes

| Area | Problem |
|---|---|
| `inspector/styles.ts`, `selector/identifier.ts` | `\|\| []` inferred as `never[]` |
| `picker.ts` | Missing return types; untyped reorder drag state |
| `CommentEditor.tsx` | Lexical nodes used without `$isTextNode` / `$isElementNode` guards |
| Optional deps | `react-speech-recognition`, `@xenova/transformers` imported but not installed |

### Fix

- Added `"typecheck": "tsc --noEmit"` to `packages/overlay/package.json`.
- Added `.github/workflows/check.yml` running overlay typecheck + tests.
- Fixed inference with explicit types and guards.
- Added `packages/overlay/src/types/external.d.ts` ambient declarations for optional deps.
- Updated stale test fixtures.

### Prevention

| Do | Don't |
|---|---|
| Run `npm run typecheck -w packages/overlay` before pushing overlay changes | Rely on `tsup` build alone (different strictness path) |
| Add explicit types at JSON/`|| []` boundaries | Let TypeScript infer `never[]` from empty arrays |
| Guard all Lexical node access with `$is*` predicates | Call `.getTextContent()` on unknown nodes |

---

## Issue 17: Picker Maintainability Refactor

### Symptom (review finding)

`picker.ts` exceeded ~4k lines; geometry, snap, spacing, and type definitions were interleaved with selection logic — high merge-conflict risk.

### Fix (non-behavioral extraction)

New modules:

| Module | Contents |
|---|---|
| `picker-types.ts` | `PickerCallbacks`, `SelectEventMeta`, shared types |
| `picker-constants.ts` | Pool sizes, thresholds |
| `picker-geometry.ts` | Rect/bounds helpers |
| `picker-snap.ts` | Snap-to-edge logic |
| `picker-spacing.ts` | Spacing overlay helpers |

`picker.ts` imports and re-exports; behavior unchanged except where bug fixes above required it.

### Prevention

Extract new picker concerns into focused modules rather than growing `picker.ts`. Keep selection orchestration in `picker.ts` until a dedicated selection submodule is justified.

---

## Issue 18: Retune Component Extraction

### Symptom (review finding)

`Retune.tsx` was ~4k lines — toolbar, scope levels, comment markers, and logo inline.

### Fix

Extracted:

| File | Role |
|---|---|
| `AnimatedPanel.tsx` | Shared panel animation wrapper |
| `RetuneLogo.tsx` | Toolbar logo / collapse button |
| `CommentMarkers.tsx` | Saved comment markers on page |
| `scope-levels.ts` | Cascade scope level UI logic |

### Prevention

New overlay UI surfaces should land in focused components under `packages/overlay/src/overlay/`, not inline in `Retune.tsx`.

---

## Debug Process Lessons (This Session)

### What worked

1. **Runtime logging at layer boundaries** — pointerdown intent, Lexical anchor on delete, draft selector sync — not deep Lexical internals first.
2. **Multiple hypotheses in parallel** — geometry vs selection vs suppress flags vs offset edge cases.
3. **Cited log lines** to confirm/reject each hypothesis before coding.
4. **Layered fixes** — pointer intent + whitespace-gap logic + stale-selection suppress, not a single silver bullet.

### What failed

1. **Claiming fixed after one successful log run** — user still hit failing geometries; eroded trust.
2. **Removing instrumentation too early** — made iteration slower when regressions appeared.
3. **Fixing only pointer intent** — offset-1 whitespace case still deleted the wrong mention without the second fix.

### Recommended debug loop for mention-delete bugs

```
1. Log pointerdown: targetInsideEditor, inEditorBounds, pointerIntent, mention rects
2. Log rAF selection: anchor offset, node type, node text
3. Log delete entry: isBackward, pointerIntent, Lexical anchor, mention list
4. Log which branch deleted which selector
5. Fix one confirmed root cause
6. Re-run full manual matrix (not just the original repro)
7. Remove instrumentation only after user confirms
```

---

## State Ownership Addendum

### Module-level editor state (CommentEditor)

These are **intentionally outside React state** — they must synchronously influence the next keyboard event:

| Variable | Set on | Used on |
|---|---|---|
| `latestCommentEditorPointerInside` | pointerdown | delete suppress / intent routing |
| `latestPointerIntentMentionSelector` | pointerdown | delete via geometry |
| `suppressMentionDeleteUntilFreshInput` | after intent delete | prevent double-delete |

**Do not move these into React `useState`** — keyboard commands fire before re-render.

### Live edit flow (shift/alt with popover open)

```
User shift-clicks page element
  → picker allows click (modifiedDraftClick)
  → notifySelect with selectionColors
  → handleCommentSelect (liveEditable path)
  → appendElementsToCommentDraft with colorByElement
  → applyTargetsToDraft (preserves mentionColor)
  → CommentEditor mentions prop updates
  → Lexical insert/remove via prop reconciliation effect
```

---

## Verification Checklist

### Automated

```bash
cd packages/overlay
npm run typecheck
npm test
```

Notable tests: `comment-text-parse.test.ts` (target resolution, empty array, mention names).

### Manual (add to existing matrices in prior docs)

| Scenario | Expected |
|---|---|
| Live edit: popover open, shift-click new element | New mention appended with correct color/title |
| Live edit: alt-click selected element | Mention removed; remaining colors unchanged |
| 2 mentions, gap-click before second, Backspace | Second mention deleted |
| Same with Delete key | Second mention deleted |
| Click mention chip, Backspace | That mention deleted |
| Drawing + element mixed draft, live add/remove | See [postmortem Issue 10](./overlay-comment-mode-postmortem.md#part-5-mixed-element--drawing-select-all-delete-issue-10) |

---

## Key Files (This Session)

| File | Changes |
|---|---|
| `packages/overlay/src/overlay/comment/CommentEditor.tsx` | Pointer intent, delete routing, spacing normalization |
| `packages/overlay/src/overlay/comment/mention-node.ts` | `data-mention-selector` on DOM |
| `packages/overlay/src/overlay/comment/use-comment-mode.ts` | Live edit, color preservation, popover blocking |
| `packages/overlay/src/overlay/comment/comment-draft.ts` | Mention naming, `mentionColor`, live-edit helpers |
| `packages/overlay/src/overlay/comment/CommentPopover.tsx` | Mention color/title display |
| `packages/overlay/src/selector/picker.ts` | Live-edit click guard, `selectionColors` in meta |
| `packages/overlay/src/selector/picker-*.ts` | Extracted modules |
| `.github/workflows/check.yml` | CI typecheck + test |

---

## Related Reading

- [Overlay Comment Mode: Session Postmortem](./overlay-comment-mode-postmortem.md)
- [Comment Editor: Lexical + Shadow DOM](./comment-editor-lexical-shadow-dom.md)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — pointer intent belongs in event handlers, not effects
- Commit `cf764cd` on `main`
