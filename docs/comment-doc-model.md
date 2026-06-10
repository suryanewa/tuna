# Comment Document Model

Comments are rich text with atomic mention tokens. Plain `@Button hello` strings cannot faithfully represent selectors, colors, or mention order. The canonical model is **`CommentDoc`**; everything else is a projection.

## Canonical type

```ts
type CommentDoc = {
  version: 1;
  blocks: [{
    type: "paragraph";
    children: Array<
      | { type: "text"; text: string }
      | { type: "mention"; mention: { selector: string; label: string; color: string } }
    >;
  }];
};
```

Module: [`packages/overlay/src/overlay/comment/comment-doc.ts`](../packages/overlay/src/overlay/comment/comment-doc.ts)

## Surfaces and transforms

| Surface | Consumes |
|---------|----------|
| Lexical editor | `docToLexicalParts(doc)` → nodes |
| Hover preview | `getDoc(comment)` → `docToLexicalParts` |
| Persistence | `content` JSON + derived `text` via `docToPlainText` |
| Dictation cancel | full `CommentDoc` snapshot restore |
| Picker outlines | `docToMentionSelectors(doc)` |
| Draft sync | `docToTargets(doc, existingTargets)` |
| MCP / AI export | `comment.text` (plain projection, unchanged) |

## Persistence (dual-write)

`CommentStore` stores:

- `content?: CommentDoc` — canonical
- `text: string` — derived projection for search, MCP blockquotes, backward compat

On `restore()`, legacy comments without `content` are migrated via `commentToDoc()` and re-persisted.

## Spacing

Spaces before, between, and after inline mentions are stored in **text blocks**, not inferred at serialize time. Each element mention insertion is an atomic bundle via `buildMentionInsertionParts`:

`[{ text: " " }, mention, { text: " " }]`

Batch insertions use `buildInlineMentionInsertionsParts`; doc edits use `insertMentionsIntoDoc`. Lexical insertions call the same helpers so the editor and `CommentDoc` stay aligned. Snapshot export keeps **one text block per Lexical text node** (spacer nodes are never merged into neighboring prose).

## Invariants

1. Documents end with editable text (`validateDoc`).
2. `selectedElements: []` means zero mentions (never legacy fallback).
3. Edit submit calls `updateContent()` — patches `content`, `text`, and `selectedElements` atomically.
4. `parseCommentTextIntoParts` is migration-only; runtime reads use `getDoc(comment)`.

## Related docs

- [Comment Editor: Lexical + Shadow DOM](./comment-editor-lexical-shadow-dom.md)
- [Comment Editor: Mention Delete & Live Editing](./comment-editor-mention-delete-and-live-editing.md)
- [Overlay Comment Mode Postmortem](./overlay-comment-mode-postmortem.md)

## Manual QA matrix

- Type, backspace mention, shift/alt add/remove, reopen edit, hover preview, dictate+cancel, multi-select, Cmd+A delete, drawing-only draft
