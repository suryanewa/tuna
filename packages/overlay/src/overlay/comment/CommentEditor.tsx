import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $selectAll,
  $setSelection,
  $createRangeSelection,
  $createRangeSelectionFromDom,
  COMMAND_PRIORITY_CRITICAL,
  DELETE_CHARACTER_COMMAND,
  getDOMSelection,
  isSelectionWithinEditor,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextNode,
} from "lexical";
import type { CommentElementTarget } from "../../engine/comment-store";
import type { CommentContentPart } from "./comment-draft";
import {
  buildInlineMentionInsertionsParts,
  buildMentionInsertionParts,
  createDocFromLeadingMentions,
  docToLexicalParts,
  docToPlainText,
  docToUserText,
  lexicalPartsToDoc,
  type CommentDoc,
  type CommentEditorSnapshot,
} from "./comment-doc";
import { $createMentionNode, $isMentionNode, MentionNode } from "./mention-node";

let latestCommentEditorPointerInside = true;
let latestPointerIntentMentionSelector: string | null = null;
let latestCaretBeforeMentionSelector: string | null = null;
let latestCaretAfterMentionSelector: string | null = null;
let latestCaretAfterMentionOffset = 0;
let suppressMentionDeleteUntilFreshInput = false;
let shouldSyncDomSelectionOnNextInput = false;
let latestEditorPointerForInput: { x: number; y: number } | null = null;
let latestEditorPointerDown: { x: number; y: number } | null = null;
const CARET_ANCHOR_TEXT = "\u200b";
const POINTER_DRAG_SELECTION_THRESHOLD_PX = 3;
const CARET_NAV_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

function getEditorPlainText(root: HTMLElement): string {
  return (root.textContent ?? "").replace(/\u200b/g, "");
}

function getEditorWindow(editor: LexicalEditor): Window {
  return editor.getRootElement()?.ownerDocument.defaultView ?? window;
}

/**
 * Chrome/Safari hide shadow-tree selections from `window.getSelection()`, so a
 * native drag-select inside the shadow-DOM editor reads as collapsed. Prefer the
 * shadow root's own selection so drag highlights survive pointerup.
 */
function getEditorDomSelection(editor: LexicalEditor): Selection | null {
  const rootNode = editor.getRootElement()?.getRootNode();
  if (rootNode instanceof ShadowRoot) {
    const shadowSelection = (rootNode as ShadowRoot & {
      getSelection?: () => Selection | null;
    }).getSelection?.();
    if (shadowSelection) return shadowSelection;
  }
  return getDOMSelection(getEditorWindow(editor));
}

function selectionIntersectsEditor(root: HTMLElement, editor: LexicalEditor): boolean {
  const domSel = getEditorDomSelection(editor);
  if (!domSel || domSel.rangeCount === 0) return false;
  if (isSelectionWithinEditor(editor, domSel.anchorNode, domSel.focusNode)) return true;
  const editorRoot = editor.getRootElement();
  if (!editorRoot) return false;
  const nodeInEditor = (node: Node | null): boolean => {
    if (!node) return false;
    let current: Node | null = node;
    while (current) {
      if (current === editorRoot) return true;
      current = current.parentNode;
    }
    return false;
  };
  return nodeInEditor(domSel.anchorNode) || nodeInEditor(domSel.focusNode);
}

function domHasExpandedSelection(root: HTMLElement, editor: LexicalEditor): boolean {
  const domSel = getEditorDomSelection(editor);
  if (!domSel || domSel.rangeCount === 0) return false;
  const range = domSel.getRangeAt(0);
  if (range.collapsed) return false;
  return domSel.toString().length > 0 && selectionIntersectsEditor(root, editor);
}

function domHasAnyExpandedSelectionInEditor(root: HTMLElement, editor: LexicalEditor): boolean {
  const domSel = getEditorDomSelection(editor);
  if (!domSel || domSel.rangeCount === 0) return false;
  if (domSel.getRangeAt(0).collapsed) return false;
  return selectionIntersectsEditor(root, editor);
}

function pointerMovedEnoughToSelectText(start: { x: number; y: number } | null, end: { x: number; y: number }): boolean {
  if (!start) return false;
  return Math.hypot(end.x - start.x, end.y - start.y) > POINTER_DRAG_SELECTION_THRESHOLD_PX;
}

/** Shadow DOM: native select-all can leave Lexical collapsed while DOM toString spans most of the editor. */
function domSelectionCoversEditor(root: HTMLElement, editor: LexicalEditor): boolean {
  const selected = getEditorDomSelection(editor)?.toString() ?? "";
  if (selected.length <= 1) return false;
  const editorText = getEditorPlainText(root);
  if (editorText.length === 0) return false;
  return selected.length >= editorText.length * 0.75;
}

function nodeWithinEditorRoot(rootEl: HTMLElement, node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (current === rootEl) return true;
    current = current.parentNode;
  }
  return false;
}

function getDOMTextNodeFromElement(element: Node | null): Text | null {
  if (!element) return null;
  if (element.nodeType === Node.TEXT_NODE) return element as Text;
  let node: Node | null = element.firstChild;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) return node as Text;
    node = node.firstChild;
  }
  return null;
}

function getLastDOMTextDescendant(element: Node): Text | null {
  if (element.nodeType === Node.TEXT_NODE) return element as Text;
  for (let i = element.childNodes.length - 1; i >= 0; i -= 1) {
    const found = getLastDOMTextDescendant(element.childNodes[i]!);
    if (found) return found;
  }
  return null;
}

function resolveDomTextPoint(
  domNode: Node,
  offset: number,
): { textNode: Text; offset: number } | null {
  if (domNode.nodeType === Node.TEXT_NODE) {
    return { textNode: domNode as Text, offset };
  }
  if (domNode.nodeType !== Node.ELEMENT_NODE) return null;
  const element = domNode as Element;
  if (offset < element.childNodes.length) {
    const child = element.childNodes[offset]!;
    if (child.nodeType === Node.TEXT_NODE) {
      return { textNode: child as Text, offset: 0 };
    }
    const nested = getDOMTextNodeFromElement(child);
    if (nested) return { textNode: nested, offset: 0 };
  }
  const lastText = getLastDOMTextDescendant(element);
  if (lastText) {
    return { textNode: lastText, offset: lastText.textContent?.length ?? 0 };
  }
  return null;
}

function lexicalTextElementForDomNode(
  editor: LexicalEditor,
  domNode: Node,
): HTMLElement | null {
  let current: Node | null = domNode;
  const root = editor.getRootElement();
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.hasAttribute("data-lexical-text")) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function domPointToLexicalPoint(
  editor: LexicalEditor,
  domNode: Node,
  offset: number,
): { key: string; offset: number } | null {
  const resolved = resolveDomTextPoint(domNode, offset);
  if (!resolved) return null;
  const lexicalEl = lexicalTextElementForDomNode(editor, resolved.textNode);
  for (const lexicalNode of rootTextNodes()) {
    if ($isMentionNode(lexicalNode)) continue;
    const element = editor.getElementByKey(lexicalNode.getKey());
    if (!element) continue;
    if (element === lexicalEl || element.contains(resolved.textNode)) {
      const clamped = Math.max(0, Math.min(resolved.offset, lexicalNode.getTextContent().length));
      return { key: lexicalNode.getKey(), offset: clamped };
    }
  }
  return null;
}

function getTextOffsetAtClientX(textNode: Text, x: number): number {
  const text = textNode.textContent ?? "";
  if (text.length === 0) return 0;
  const doc = textNode.ownerDocument;
  const range = doc.createRange();
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    range.setStart(textNode, mid);
    range.setEnd(textNode, Math.min(mid + 1, text.length));
    const rect = range.getBoundingClientRect();
    const midX = rect.width > 0 ? rect.left + rect.width / 2 : rect.left;
    if (x < midX) high = mid;
    else low = mid + 1;
  }
  return low;
}

function $setSelectionAtTextNodeX(
  editor: LexicalEditor,
  lexicalTextNode: TextNode,
  x: number,
): boolean {
  const element = editor.getElementByKey(lexicalTextNode.getKey());
  if (!element) return false;
  const domText = getDOMTextNodeFromElement(element);
  const offset = domText ? getTextOffsetAtClientX(domText, x) : 0;
  const clamped = Math.max(0, Math.min(offset, lexicalTextNode.getTextContent().length));
  const sel = $createRangeSelection();
  sel.anchor.set(lexicalTextNode.getKey(), clamped, "text");
  sel.focus.set(lexicalTextNode.getKey(), clamped, "text");
  $setSelection(sel);
  return true;
}

function elementFromClientPoint(rootEl: HTMLElement, x: number, y: number): Element | null {
  const rootNode = rootEl.getRootNode();
  const hit = rootNode instanceof ShadowRoot
    ? rootNode.elementFromPoint(x, y)
    : rootEl.ownerDocument.elementFromPoint(x, y);
  return hit instanceof Element ? hit : null;
}

function $placeSelectionOnHitTextNode(
  editor: LexicalEditor,
  rootEl: HTMLElement,
  x: number,
  y: number,
): boolean {
  const hit = elementFromClientPoint(rootEl, x, y);
  if (!hit || !nodeWithinEditorRoot(rootEl, hit)) return false;
  const mentionHit = hit.closest<HTMLElement>("[data-mention-selector]");
  if (mentionHit?.dataset.mentionSelector) {
    const mention = findMentionNodeBySelector(mentionHit.dataset.mentionSelector);
    const rect = mentionHit.getBoundingClientRect();
    if (mention && shouldPlaceCaretBeforeMention(rect, x)) {
      return $placeCaretBeforeMention(editor, mention, x, rect);
    }
    if (mention && shouldPlaceCaretAfterMention(rect, x)) {
      return $placeCaretAfterMention(editor, mention, x, rect);
    }
    return false;
  }
  for (const lexicalNode of rootTextNodes()) {
    if ($isMentionNode(lexicalNode)) continue;
    const element = editor.getElementByKey(lexicalNode.getKey());
    if (!element) continue;
    if (element === hit || element.contains(hit)) {
      return $setSelectionAtTextNodeX(editor, lexicalNode, x);
    }
  }
  return false;
}

function $setLexicalSelectionFromDomRange(editor: LexicalEditor, range: Range): boolean {
  const anchor = domPointToLexicalPoint(editor, range.startContainer, range.startOffset);
  const focus = domPointToLexicalPoint(editor, range.endContainer, range.endOffset);
  if (!anchor || !focus) return false;
  const sel = $createRangeSelection();
  sel.anchor.set(anchor.key, anchor.offset, "text");
  sel.focus.set(focus.key, focus.offset, "text");
  $setSelection(sel);
  return true;
}

function $placeSelectionFromPointerGeometry(
  editor: LexicalEditor,
  rootEl: HTMLElement,
  x: number,
  y: number,
): boolean {
  const nearMentions = getMentionElementsNearPoint(rootEl, x, y);

  // Before-mention placement wins in tight gaps between adjacent chips.
  for (const mentionEl of nearMentions) {
    const selector = mentionEl.dataset.mentionSelector;
    if (!selector) continue;
    const mention = findMentionNodeBySelector(selector);
    if (!mention) continue;
    const rect = mentionEl.getBoundingClientRect();
    if (!shouldPlaceCaretBeforeMention(rect, x)) continue;
    if ($placeCaretBeforeMention(editor, mention, x, rect)) return true;
  }

  for (const mentionEl of nearMentions) {
    const selector = mentionEl.dataset.mentionSelector;
    if (!selector) continue;
    const mention = findMentionNodeBySelector(selector);
    if (!mention) continue;
    const rect = mentionEl.getBoundingClientRect();
    if (!shouldPlaceCaretAfterMention(rect, x)) continue;
    if ($placeCaretAfterMention(editor, mention, x, rect)) return true;
  }

  return false;
}

type PlacementResult = { ok: boolean; method: string; domOffset: number | null };

function $selectEditorEnd(): boolean {
  const root = $getRoot();
  const paragraph = root.getFirstChild();
  if (!$isElementNode(paragraph)) return false;

  const lastChild = paragraph.getLastChild();
  if ($isTextNode(lastChild) && !$isMentionNode(lastChild)) {
    $selectTextNodeEnd(lastChild);
    clearMentionEditPlacementState();
    return true;
  }

  const anchor = $createCaretAnchorTextNode();
  paragraph.append(anchor);
  $selectTextNodeStart(anchor);
  clearMentionEditPlacementState();
  return true;
}

function $overrideDomCaretNearMention(
  editor: LexicalEditor,
  rootEl: HTMLElement,
  x: number,
  y: number,
): boolean {
  const nearMentions = getMentionElementsNearPoint(rootEl, x, y);

  for (const mentionEl of nearMentions) {
    const selector = mentionEl.dataset.mentionSelector;
    if (!selector) continue;
    const rect = mentionEl.getBoundingClientRect();
    if (!shouldPlaceCaretBeforeMention(rect, x)) continue;
    const mention = findMentionNodeBySelector(selector);
    if (!mention) continue;
    if ($placeCaretBeforeMention(editor, mention, x, rect)) return true;
  }

  for (const mentionEl of nearMentions) {
    const selector = mentionEl.dataset.mentionSelector;
    if (!selector) continue;
    const rect = mentionEl.getBoundingClientRect();
    if (!shouldPlaceCaretAfterMention(rect, x)) continue;
    const mention = findMentionNodeBySelector(selector);
    if (!mention) continue;
    if ($placeCaretAfterMention(editor, mention, x, rect)) return true;
  }

  return false;
}

function $placeSelectionAtCoordinates(
  editor: LexicalEditor,
  rootEl: HTMLElement,
  x: number,
  y: number,
): PlacementResult {
  if ($placeSelectionFromPointerGeometry(editor, rootEl, x, y)) {
    return { ok: true, method: "geometryFirst", domOffset: null };
  }

  const range = getCaretRangeFromPoint(rootEl.ownerDocument, x, y);
  if (range && nodeWithinEditorRoot(rootEl, range.startContainer)) {
    const resolved = resolveDomTextPoint(range.startContainer, range.startOffset);
    if ($setLexicalSelectionFromDomRange(editor, range)) {
      if ($overrideDomCaretNearMention(editor, rootEl, x, y)) {
        return { ok: true, method: "domCaretNearMention", domOffset: null };
      }
      clearMentionEditPlacementState();
      return { ok: true, method: "domCaret", domOffset: resolved?.offset ?? null };
    }
    const domSel = getEditorDomSelection(editor);
    if (domSel) {
      domSel.removeAllRanges();
      domSel.addRange(range);
      if ($applyDomSelectionToLexical(editor)) {
        if ($overrideDomCaretNearMention(editor, rootEl, x, y)) {
          return { ok: true, method: "domSelNearMention", domOffset: null };
        }
        clearMentionEditPlacementState();
        return { ok: true, method: "domSelApply", domOffset: resolved?.offset ?? null };
      }
      if ($setLexicalSelectionFromDomRange(editor, range)) {
        if ($overrideDomCaretNearMention(editor, rootEl, x, y)) {
          return { ok: true, method: "domCaretRetryNearMention", domOffset: null };
        }
        clearMentionEditPlacementState();
        return { ok: true, method: "domCaretRetry", domOffset: resolved?.offset ?? null };
      }
    }
  }

  if ($placeSelectionOnHitTextNode(editor, rootEl, x, y)) {
    clearMentionEditPlacementState();
    return { ok: true, method: "hitTextX", domOffset: null };
  }

  if ($selectEditorEnd()) {
    return { ok: true, method: "editorEndFallback", domOffset: null };
  }

  return { ok: false, method: "none", domOffset: null };
}

function getCaretRangeFromPoint(doc: Document, x: number, y: number): Range | null {
  if (typeof doc.caretRangeFromPoint === "function") {
    return doc.caretRangeFromPoint(x, y);
  }
  const caretPositionFromPoint = (doc as Document & {
    caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null;
  }).caretPositionFromPoint;
  if (typeof caretPositionFromPoint === "function") {
    const position = caretPositionFromPoint.call(doc, x, y);
    if (!position) return null;
    const range = doc.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return null;
}

function $syncSelectionFromDomInteraction(
  editor: LexicalEditor,
  root: HTMLElement,
  clientX: number,
  clientY: number,
): PlacementResult {
  const domSel = getEditorDomSelection(editor);
  const hasExpandedDom = domSel != null
    && domSel.rangeCount > 0
    && !domSel.getRangeAt(0).collapsed
    && domSel.toString().length > 0;
  if (hasExpandedDom && selectionIntersectsEditor(root, editor)) {
    latestPointerIntentMentionSelector = null;
    if ($applyDomSelectionToLexical(editor)) {
      return { ok: true, method: "expandedDom", domOffset: null };
    }
    if ($setLexicalSelectionFromDomRange(editor, domSel.getRangeAt(0))) {
      return { ok: true, method: "expandedDomManual", domOffset: null };
    }
  }
  return $placeSelectionAtCoordinates(editor, root, clientX, clientY);
}

function $getTrustedInsertSelection(): RangeSelection | null {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return null;
  if (sel.anchor.key !== sel.focus.key) return null;
  const node = sel.anchor.getNode();
  if (!$isTextNode(node) || $isMentionNode(node)) return null;
  return sel;
}

function $applyDomSelectionToLexical(editor: LexicalEditor): boolean {
  const domSel = getEditorDomSelection(editor);
  if (!domSel || domSel.rangeCount === 0) return false;
  const rangeSelection = $createRangeSelectionFromDom(domSel, editor);
  if ($isRangeSelection(rangeSelection)) {
    $setSelection(rangeSelection);
    return true;
  }
  return $setLexicalSelectionFromDomRange(editor, domSel.getRangeAt(0));
}

function $syncSelectionForPendingPointerInput(editor: LexicalEditor, root: HTMLElement): void {
  if (!shouldSyncDomSelectionOnNextInput) return;
  shouldSyncDomSelectionOnNextInput = false;

  if (latestEditorPointerForInput) {
    $placeSelectionAtCoordinates(
      editor,
      root,
      latestEditorPointerForInput.x,
      latestEditorPointerForInput.y,
    );
    return;
  }

  if (!$applyDomSelectionToLexical(editor)) {
    $selectEditorEnd();
  }
}

function $deleteDomSelectedContent(root: HTMLElement, editor: LexicalEditor): boolean {
  if (!domHasExpandedSelection(root, editor) && !domSelectionCoversEditor(root, editor)) {
    return false;
  }
  if (domHasExpandedSelection(root, editor) && $applyDomSelectionToLexical(editor)) {
    const expanded = $getSelection();
    if ($isRangeSelection(expanded) && !expanded.isCollapsed()) {
      expanded.removeText();
      return true;
    }
  }
  if (domSelectionCoversEditor(root, editor)) {
    $selectAll();
    const expanded = $getSelection();
    if ($isRangeSelection(expanded) && !expanded.isCollapsed()) {
      expanded.removeText();
      return true;
    }
  }
  return false;
}

const OUTSIDE_POINTER_MENTION_HIT_SLOP_PX = 24;
/** Clicks within this distance of a mention edge edit in the adjacent spacer, not delete. */
const MENTION_EDGE_EDIT_ZONE_PX = 16;

function getMentionElementsNearPoint(root: HTMLElement, x: number, y: number): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-mention-selector]")).filter((mentionEl) => {
    const rect = mentionEl.getBoundingClientRect();
    const withinY = y >= rect.top - OUTSIDE_POINTER_MENTION_HIT_SLOP_PX
      && y <= rect.bottom + OUTSIDE_POINTER_MENTION_HIT_SLOP_PX;
    const withinX = x >= rect.left - OUTSIDE_POINTER_MENTION_HIT_SLOP_PX
      && x <= rect.right + OUTSIDE_POINTER_MENTION_HIT_SLOP_PX;
    return withinY && withinX;
  });
}

function shouldPlaceCaretBeforeMention(rect: DOMRect, x: number): boolean {
  return x < rect.left + MENTION_EDGE_EDIT_ZONE_PX;
}

function shouldPlaceCaretAfterMention(rect: DOMRect, x: number): boolean {
  return x > rect.right - MENTION_EDGE_EDIT_ZONE_PX;
}

function clearMentionEditPlacementState(): void {
  latestCaretBeforeMentionSelector = null;
  latestCaretAfterMentionSelector = null;
  latestCaretAfterMentionOffset = 0;
}

function $getOrCreateEditableTextSibling(
  mention: MentionNode,
  direction: "previous" | "next",
): TextNode {
  const sibling = direction === "previous"
    ? mention.getPreviousSibling()
    : mention.getNextSibling();
  if ($isTextNode(sibling) && !$isMentionNode(sibling)) return sibling;

  const textNode = $createCaretAnchorTextNode();
  if (direction === "previous") {
    mention.insertBefore(textNode);
  } else {
    mention.insertAfter(textNode);
  }
  return textNode;
}

function $placeCaretBeforeMention(
  editor: LexicalEditor,
  mention: MentionNode,
  x: number,
  mentionRect: DOMRect,
): boolean {
  const spacerBefore = $getOrCreateEditableTextSibling(mention, "previous");

  const spacerLen = spacerBefore.getTextContent().length;
  let offset = spacerLen;
  if (x < mentionRect.left) {
    const element = editor.getElementByKey(spacerBefore.getKey());
    const domText = element ? getDOMTextNodeFromElement(element) : null;
    offset = domText
      ? getTextOffsetAtClientX(domText, x)
      : spacerLen;
    offset = Math.max(0, Math.min(offset, spacerLen));
  }

  const sel = $createRangeSelection();
  sel.anchor.set(spacerBefore.getKey(), offset, "text");
  sel.focus.set(spacerBefore.getKey(), offset, "text");
  $setSelection(sel);
  latestPointerIntentMentionSelector = null;
  latestCaretAfterMentionSelector = null;
  latestCaretAfterMentionOffset = 0;
  latestCaretBeforeMentionSelector = mention.getSelector();
  return true;
}

function $placeCaretAfterMention(
  editor: LexicalEditor,
  mention: MentionNode,
  x: number,
  mentionRect: DOMRect,
): boolean {
  const spacerAfter = $getOrCreateEditableTextSibling(mention, "next");

  const spacerLen = spacerAfter.getTextContent().length;
  let offset = 0;
  if (x > mentionRect.right) {
    const element = editor.getElementByKey(spacerAfter.getKey());
    const domText = element ? getDOMTextNodeFromElement(element) : null;
    offset = domText
      ? getTextOffsetAtClientX(domText, x)
      : 0;
    offset = Math.max(0, Math.min(offset, spacerLen));
  }

  const sel = $createRangeSelection();
  sel.anchor.set(spacerAfter.getKey(), offset, "text");
  sel.focus.set(spacerAfter.getKey(), offset, "text");
  $setSelection(sel);
  latestPointerIntentMentionSelector = null;
  latestCaretBeforeMentionSelector = null;
  latestCaretAfterMentionSelector = mention.getSelector();
  latestCaretAfterMentionOffset = offset;
  return true;
}

function $ensureCaretBeforeTrackedMention(): boolean {
  if (!latestCaretBeforeMentionSelector) return false;
  const mention = findMentionNodeBySelector(latestCaretBeforeMentionSelector);
  if (!mention) {
    latestCaretBeforeMentionSelector = null;
    return false;
  }
  const spacerBefore = $getOrCreateEditableTextSibling(mention, "previous");
  const offset = spacerBefore.getTextContent().length;
  spacerBefore.select(offset, offset);
  return true;
}

function $ensureCaretAfterTrackedMention(): boolean {
  if (!latestCaretAfterMentionSelector) return false;
  const mention = findMentionNodeBySelector(latestCaretAfterMentionSelector);
  if (!mention) {
    latestCaretAfterMentionSelector = null;
    latestCaretAfterMentionOffset = 0;
    return false;
  }
  const spacerAfter = $getOrCreateEditableTextSibling(mention, "next");
  const offset = Math.max(0, Math.min(latestCaretAfterMentionOffset, spacerAfter.getTextContent().length));
  spacerAfter.select(offset, offset);
  return true;
}

function $ensureCaretNearTrackedMention(): boolean {
  return $ensureCaretBeforeTrackedMention() || $ensureCaretAfterTrackedMention();
}

function findAdjacentMentionAcrossWhitespace(
  node: TextNode,
  direction: "previous" | "next",
): MentionNode | null {
  let cursor: LexicalNode | null = direction === "previous"
    ? node.getPreviousSibling()
    : node.getNextSibling();
  while ($isTextNode(cursor) && !$isMentionNode(cursor) && isEditorTextEmpty(cursor.getTextContent())) {
    cursor = direction === "previous" ? cursor.getPreviousSibling() : cursor.getNextSibling();
  }
  return $isMentionNode(cursor) ? cursor : null;
}

/**
 * Mentions are `contentEditable=false`, so the browser cannot host a caret on
 * them; arrow navigation across one drops the caret. When the collapsed caret
 * sits at a text-node boundary next to a mention, hop it to the editable spacer
 * on the far side of that mention.
 */
function $moveCaretAcrossMention(direction: "previous" | "next"): boolean {
  const sel = $getSelection();
  if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;
  const node = sel.anchor.getNode();
  if (!$isTextNode(node) || $isMentionNode(node)) return false;
  const offset = sel.anchor.offset;
  const text = node.getTextContent();
  if (direction === "next") {
    if (offset < text.length) return false;
    const mention = findAdjacentMentionAcrossWhitespace(node, "next");
    if (!mention) return false;
    $selectTextNodeStart($getOrCreateEditableTextSibling(mention, "next"));
    return true;
  }
  if (offset > 0) return false;
  const mention = findAdjacentMentionAcrossWhitespace(node, "previous");
  if (!mention) return false;
  $selectTextNodeEnd($getOrCreateEditableTextSibling(mention, "previous"));
  return true;
}

/** Recover a caret that resolved onto a mention by hopping to an editable sibling. */
function $ensureCaretOffMention(preferDirection: "previous" | "next"): boolean {
  const sel = $getSelection();
  if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;
  const node = sel.anchor.getNode();
  if (!$isMentionNode(node)) return false;
  const sibling = $getOrCreateEditableTextSibling(node, preferDirection);
  if (preferDirection === "previous") $selectTextNodeEnd(sibling);
  else $selectTextNodeStart(sibling);
  return true;
}


export type CommentMention = {
  name: string;
  color: string;
  selector: string;
};

export type CommentEditorApi = {
  insertText: (text: string) => void;
  insertMentions: (mentions: CommentMention[]) => void;
  getDoc: () => CommentDoc;
  getText: () => string;
  getUserText: () => string;
  getMentions: () => string[];
  setText: (text: string) => void;
  /** Restore full editor content from canonical doc. */
  restoreDoc: (doc: CommentDoc) => void;
  placeSelectionAtPoint: (x: number, y: number) => void;
  focus: () => void;
  clear: () => void;
};

type CommentEditorProps = {
  initialText: string;
  mentions: CommentMention[];
  /** Parsed stored comment text with inline mention positions (edit mode). */
  contentParts?: CommentContentPart[];
  /** Target pool for building canonical docs from editor snapshots. */
  targets?: CommentElementTarget[];
  placeholder?: string;
  onChange?: (doc: CommentDoc) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
};

function normalizeEditorText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\u200b/g, "");
}

function isEditorTextEmpty(text: string): boolean {
  return normalizeEditorText(text).trim() === "";
}

function isCaretAnchorText(text: string): boolean {
  return text === CARET_ANCHOR_TEXT;
}

function replaceCaretAnchorWithText(node: TextNode, text: string): boolean {
  if (!isCaretAnchorText(node.getTextContent())) return false;
  node.setTextContent(text);
  node.select(text.length, text.length);
  return true;
}

function $createCaretAnchorTextNode(): TextNode {
  return $createTextNode(CARET_ANCHOR_TEXT);
}

function $selectTextNodeStart(node: TextNode): void {
  node.select(0, 0);
}

function $selectTextNodeEnd(node: TextNode): void {
  const length = node.getTextContent().length;
  node.select(length, length);
}

function getSnapshotFromEditorState(editorState: EditorState): CommentEditorSnapshot {
  let snapshot: CommentEditorSnapshot = { text: "", userText: "", mentionSelectors: [], parts: [] };
  editorState.read(() => {
    const root = $getRoot();
    const mentionSelectors: string[] = [];
    const userTextParts: string[] = [];
    const parts: CommentContentPart[] = [];

    for (const node of root.getAllTextNodes()) {
      if ($isMentionNode(node)) {
        mentionSelectors.push(node.getSelector());
        parts.push({
          type: "mention",
          mention: {
            name: node.getName(),
            color: node.getColor(),
            selector: node.getSelector(),
          },
        });
        continue;
      }

      const text = normalizeEditorText(node.getTextContent());
      userTextParts.push(text);
      parts.push({ type: "text", text });
    }

    snapshot = {
      text: normalizeEditorText(root.getTextContent()).trim(),
      userText: userTextParts.join("").trim(),
      mentionSelectors,
      parts,
    };
  });
  return snapshot;
}

function createContentNodesFromParts(parts: CommentContentPart[]): LexicalNode[] {
  const nodes: LexicalNode[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    if (part.type === "mention") {
      nodes.push($createMentionNode(part.mention.name, part.mention.color, part.mention.selector));
    } else {
      const previous = parts[index - 1];
      const next = parts[index + 1];
      const isLegacyMentionSpacer = part.text.trim() === ""
        && (previous?.type === "mention" || next?.type === "mention");
      if (isLegacyMentionSpacer) continue;
      nodes.push($createTextNode(part.text));
    }
  }
  const lastNode = nodes[nodes.length - 1];
  if (!lastNode || $isMentionNode(lastNode)) {
    nodes.push($createCaretAnchorTextNode());
  }
  return nodes;
}

function isWhitespaceOnlyTextNode(node: LexicalNode | null | undefined): node is TextNode {
  return $isTextNode(node) && !$isMentionNode(node) && isEditorTextEmpty(node.getTextContent());
}

function normalizeMentionSpacing() {
  const root = $getRoot();
  for (const node of root.getAllTextNodes()) {
    if (!$isMentionNode(node)) continue;
    const previous = node.getPreviousSibling();
    if (
      isWhitespaceOnlyTextNode(previous)
      && previous.getTextContent().length > 0
      && !isCaretAnchorText(previous.getTextContent())
    ) {
      previous.remove();
    }
    const next = node.getNextSibling();
    if (
      isWhitespaceOnlyTextNode(next)
      && next.getTextContent().length > 0
      && !isCaretAnchorText(next.getTextContent())
    ) {
      next.remove();
    }
  }
}

function normalizeSpacingAfterMentionRemoval() {
  normalizeMentionSpacing();

  let nodes = rootTextNodes();
  const hasMention = nodes.some((node) => $isMentionNode(node));
  const hasUserText = nodes.some((node) => !$isMentionNode(node) && !isEditorTextEmpty(node.getTextContent()));

  if (!hasMention && !hasUserText) {
    for (const node of nodes) {
      if (!$isMentionNode(node)) node.remove();
    }
    return;
  }

  const firstContent = nodes.find((node) =>
    $isMentionNode(node) || node.getTextContent().trim() !== ""
  );
  if ($isMentionNode(firstContent)) {
    for (const node of nodes) {
      if (node === firstContent) break;
      if (
        isWhitespaceOnlyTextNode(node)
        && node.getTextContent().length > 0
        && !isCaretAnchorText(node.getTextContent())
      ) {
        node.remove();
      }
    }
  }

  nodes = rootTextNodes();
  for (const node of nodes) {
    if (
      isWhitespaceOnlyTextNode(node)
      && node.getTextContent().length > 0
      && !isCaretAnchorText(node.getTextContent())
    ) {
      node.remove();
    }
  }
}

function rootTextNodes(): TextNode[] {
  return $getRoot().getAllTextNodes();
}

function getPointerIntentMentionSelector(root: HTMLElement, x: number, y: number): string | null {
  for (const mentionEl of getMentionElementsNearPoint(root, x, y)) {
    const rect = mentionEl.getBoundingClientRect();
    const selector = mentionEl.dataset.mentionSelector;
    if (!selector) continue;
    if (x < rect.left || x > rect.right) continue;
    if (shouldPlaceCaretBeforeMention(rect, x)) continue;
    if (shouldPlaceCaretAfterMention(rect, x)) continue;
    return selector;
  }
  return null;
}

function findMentionNodeBySelector(selector: string): MentionNode | null {
  for (const node of rootTextNodes()) {
    if ($isMentionNode(node) && node.getSelector() === selector) return node;
  }
  return null;
}

function resetEditorContent(editor: LexicalEditor, mentions: CommentMention[], text: string) {
  const parts = docToLexicalParts(createDocFromLeadingMentions(mentions, text));
  resetEditorContentFromParts(editor, parts);
}

function resetEditorContentFromParts(editor: LexicalEditor, parts: CommentContentPart[]) {
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    const paragraph = $createParagraphNode();
    paragraph.append(...createContentNodesFromParts(parts));
    root.append(paragraph);
    paragraph.selectEnd();
  });
}

function insertMentionsAtSelection(editor: LexicalEditor, mentions: CommentMention[]) {
  if (mentions.length === 0) return;
  const insertionParts = mentions.length === 1
    ? buildMentionInsertionParts(mentions[0]!)
    : buildInlineMentionInsertionsParts(mentions);
  editor.update(() => {
    const nodes = createContentNodesFromParts(insertionParts);
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      $insertNodes(nodes);
    } else {
      const root = $getRoot();
      const paragraph = root.getFirstChild();
      if ($isElementNode(paragraph)) {
        paragraph.append(...nodes);
        paragraph.selectEnd();
      }
    }
    normalizeMentionSpacing();
  });
}

function CommentEditorPlugins({
  initialText,
  mentions,
  contentParts,
  targets = [],
  onChange,
  editorRef,
  onSubmit,
  onCancel,
}: CommentEditorProps & {
  editorRef: MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();
  const mentionSelectorsRef = useRef<string[]>(mentions.map((mention) => mention.selector));
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  editorRef.current = editor;
  const restoreFromParts = !!contentParts;

  useEffect(() => {
    const isWhitespaceTextNode = (node: LexicalNode | null | undefined): node is TextNode =>
      $isTextNode(node) && !$isMentionNode(node) && isEditorTextEmpty(node.getTextContent());

    const findMentionAcrossWhitespace = (node: LexicalNode, direction: "previous" | "next") => {
      const skippedWhitespace: TextNode[] = [];
      let cursor = direction === "previous" ? node.getPreviousSibling() : node.getNextSibling();
      while (isWhitespaceTextNode(cursor)) {
        skippedWhitespace.push(cursor);
        cursor = direction === "previous" ? cursor.getPreviousSibling() : cursor.getNextSibling();
      }
      if (!$isMentionNode(cursor)) return null;
      for (const whitespaceNode of skippedWhitespace) {
        whitespaceNode.remove();
      }
      return cursor;
    };

    const normalizeSpacer = (node: LexicalNode | null | undefined) => {
      if (!isWhitespaceTextNode(node)) return null;
      if (node.getTextContent().length > 0 && !isCaretAnchorText(node.getTextContent())) {
        node.setTextContent(CARET_ANCHOR_TEXT);
      }
      return node;
    };

    const findMentionAcrossWhitespaceReadOnly = (node: LexicalNode, direction: "previous" | "next") => {
      let cursor = direction === "previous" ? node.getPreviousSibling() : node.getNextSibling();
      while (isWhitespaceTextNode(cursor)) {
        cursor = direction === "previous" ? cursor.getPreviousSibling() : cursor.getNextSibling();
      }
      return $isMentionNode(cursor) ? cursor : null;
    };

    const selectionWouldDeleteMention = (node: LexicalNode, isBackward: boolean, offset: number) => {
      if ($isMentionNode(node)) return true;
      if (!$isTextNode(node) || $isMentionNode(node)) return false;

      const text = node.getTextContent();
      if (isBackward && isEditorTextEmpty(text.slice(0, offset))) {
        if (findMentionAcrossWhitespaceReadOnly(node, "next")) return true;
        return !!findMentionAcrossWhitespaceReadOnly(node, "previous");
      }
      if (!isBackward && isEditorTextEmpty(text.slice(offset))) {
        return !!findMentionAcrossWhitespaceReadOnly(node, "next");
      }
      return false;
    };

    const selectAnchorAfterMentionRemoval = (
      removedMention: LexicalNode,
      direction: "previous" | "next",
      fallbackTextNode?: LexicalNode,
    ) => {
      const previousSibling = removedMention.getPreviousSibling();
      const nextSibling = removedMention.getNextSibling();
      const parent = removedMention.getParent();
      const insertionIndex = removedMention.getIndexWithinParent();
      removedMention.remove();
      clearMentionEditPlacementState();
      latestPointerIntentMentionSelector = null;

      const preferred = direction === "previous"
        ? (normalizeSpacer(nextSibling) ?? normalizeSpacer(fallbackTextNode) ?? normalizeSpacer(previousSibling))
        : (normalizeSpacer(previousSibling) ?? normalizeSpacer(fallbackTextNode) ?? normalizeSpacer(nextSibling));

      if ($isTextNode(preferred)) {
        if (preferred === previousSibling) $selectTextNodeEnd(preferred);
        else $selectTextNodeStart(preferred);
      } else {
        const anchor = $createCaretAnchorTextNode();
        if ($isElementNode(parent)) {
          parent.splice(insertionIndex, 0, [anchor]);
          $selectTextNodeStart(anchor);
        } else {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            paragraph.append(anchor);
            $selectTextNodeStart(anchor);
          }
        }
      }
      requestAnimationFrame(() => editor.focus());
    };

    const removePointerIntentMention = (isBackward: boolean) => {
      const rootEl = editor.getRootElement();
      if (rootEl && domHasExpandedSelection(rootEl, editor)) return false;
      if (latestCaretBeforeMentionSelector || latestCaretAfterMentionSelector) return false;
      if (!latestPointerIntentMentionSelector) return false;
      const intentMention = findMentionNodeBySelector(latestPointerIntentMentionSelector);
      if (!intentMention) return false;

      if (latestCommentEditorPointerInside) {
        const sel = $getSelection();
        if ($isRangeSelection(sel) && sel.isCollapsed()) {
          const node = sel.anchor.getNode();
          if ($isTextNode(node) && !$isMentionNode(node)) {
            const nextMention = findMentionAcrossWhitespaceReadOnly(node, "next");
            if (nextMention?.getSelector() === latestPointerIntentMentionSelector) {
              latestPointerIntentMentionSelector = null;
              return false;
            }
            if (nextMention && nextMention.getSelector() !== latestPointerIntentMentionSelector) {
              latestPointerIntentMentionSelector = null;
              return false;
            }
          }
        }
      }

      selectAnchorAfterMentionRemoval(intentMention, isBackward ? "previous" : "next");
      latestPointerIntentMentionSelector = null;
      suppressMentionDeleteUntilFreshInput = true;
      return true;
    };

    const unregDel = editor.registerCommand(DELETE_CHARACTER_COMMAND, (isBackward) => {
      const root = editor.getRootElement();
      if (root) {
        $syncSelectionForPendingPointerInput(editor, root);
      }
      $ensureCaretNearTrackedMention();
      const sel = $getSelection();
      if (root && $isRangeSelection(sel) && sel.isCollapsed()) {
        if ($deleteDomSelectedContent(root, editor)) {
          return true;
        }
        if (domHasExpandedSelection(root, editor)) {
          return false;
        }
      }
      if ($isRangeSelection(sel) && !sel.isCollapsed()) {
        return false;
      }
      if ($isRangeSelection(sel) && sel.isCollapsed() && sel.anchor.key === sel.focus.key) {
        const node = sel.anchor.getNode();

        if (suppressMentionDeleteUntilFreshInput && selectionWouldDeleteMention(node, isBackward, sel.anchor.offset)) {
          return true;
        }
        if (suppressMentionDeleteUntilFreshInput && !selectionWouldDeleteMention(node, isBackward, sel.anchor.offset)) {
          suppressMentionDeleteUntilFreshInput = false;
        }

        if (removePointerIntentMention(isBackward)) {
          return true;
        }

        if (!latestCommentEditorPointerInside && selectionWouldDeleteMention(node, isBackward, sel.anchor.offset)) {
          return true;
        }

        if ($isMentionNode(node)) {
          selectAnchorAfterMentionRemoval(node, isBackward ? "previous" : "next");
          return true;
        }
        if ($isTextNode(node) && !$isMentionNode(node)) {
          const text = node.getTextContent();
          const offset = sel.anchor.offset;
          if (isBackward && isEditorTextEmpty(text.slice(0, offset)) && offset > 0) {
            const nextMention = findMentionAcrossWhitespaceReadOnly(node, "next");
            if (nextMention) {
              if (isCaretAnchorText(text)) {
                selectAnchorAfterMentionRemoval(node.getPreviousSibling() ?? nextMention, "previous", node);
              } else {
                node.spliceText(offset - 1, 1, "", true);
              }
              latestPointerIntentMentionSelector = null;
              return true;
            }
          }
          if (isBackward && isEditorTextEmpty(text.slice(0, offset))) {
            // A whitespace-only spacer puts the caret "before the next" chip, so
            // backspace removes the next mention (Issue 12). In a real text node,
            // backspace at offset 0 must remove the mention to the LEFT instead.
            if (isEditorTextEmpty(text)) {
              const nextMention = findMentionAcrossWhitespace(node, "next");
              if (nextMention) {
                selectAnchorAfterMentionRemoval(nextMention, "previous", node);
                requestAnimationFrame(() => editor.focus());
                return true;
              }
            }
            const previousMention = findMentionAcrossWhitespace(node, "previous");
            if (previousMention) {
              selectAnchorAfterMentionRemoval(previousMention, "previous", node);
              requestAnimationFrame(() => editor.focus());
              return true;
            }
            const trailingMention = findMentionAcrossWhitespace(node, "next");
            if (trailingMention) {
              selectAnchorAfterMentionRemoval(trailingMention, "previous", node);
              requestAnimationFrame(() => editor.focus());
              return true;
            }
          }
          if (!isBackward && isEditorTextEmpty(text.slice(offset)) && offset < text.length) {
            const nextMention = findMentionAcrossWhitespaceReadOnly(node, "next");
            if (nextMention) {
              if (isCaretAnchorText(text)) {
                selectAnchorAfterMentionRemoval(nextMention, "next", node);
              } else {
                node.spliceText(offset, 1, "", true);
              }
              latestPointerIntentMentionSelector = null;
              return true;
            }
          }
          if (!isBackward && isEditorTextEmpty(text.slice(offset))) {
            const nextMention = findMentionAcrossWhitespace(node, "next");
            if (nextMention) {
              selectAnchorAfterMentionRemoval(nextMention, "next", node);
              requestAnimationFrame(() => editor.focus());
              return true;
            }
          }
          if (isBackward && offset === 0 && $isMentionNode(node.getPreviousSibling())) {
            node.getPreviousSibling()?.remove();
            node.selectStart();
            requestAnimationFrame(() => editor.focus());
            return true;
          }
          if (!isBackward && offset === text.length && $isMentionNode(node.getNextSibling())) {
            node.getNextSibling()?.remove();
            node.selectStart();
            requestAnimationFrame(() => editor.focus());
            return true;
          }
          const isSurrogatePairBackward = isBackward
            && offset >= 2
            && /[\uDC00-\uDFFF]/.test(text[offset - 1])
            && /[\uD800-\uDBFF]/.test(text[offset - 2]);
          const isSurrogatePairForward = !isBackward
            && offset + 1 < text.length
            && /[\uD800-\uDBFF]/.test(text[offset])
            && /[\uDC00-\uDFFF]/.test(text[offset + 1]);
          const start = isBackward ? offset - (isSurrogatePairBackward ? 2 : 1) : offset;
          const count = isSurrogatePairBackward || isSurrogatePairForward ? 2 : 1;
          if (start >= 0 && start < text.length) {
            node.spliceText(start, count, "", true);
            return true;
          }
        }
      }
      return false;
    }, COMMAND_PRIORITY_CRITICAL);
    return unregDel;
  }, [editor]);

  useLayoutEffect(() => {
    if (contentParts) {
      resetEditorContentFromParts(editor, contentParts);
    } else {
      resetEditorContent(editor, mentions, initialText);
    }
    requestAnimationFrame(() => editor.focus());
    // Initial content must only be seeded once. Later mention changes are reconciled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (restoreFromParts) return;
    const previousSelectors = mentionSelectorsRef.current;
    const nextSelectors = mentions.map((mention) => mention.selector);
    const previousSet = new Set(previousSelectors);
    const nextSet = new Set(nextSelectors);
    const added = mentions.filter((mention) => !previousSet.has(mention.selector));
    const removed = previousSelectors.filter((selector) => !nextSet.has(selector));
    mentionSelectorsRef.current = nextSelectors;

    if (removed.length > 0) {
      editor.update(() => {
        const root = $getRoot();
        for (const node of root.getAllTextNodes()) {
          if ($isMentionNode(node) && removed.includes(node.getSelector())) {
            node.remove();
          }
        }
        normalizeSpacingAfterMentionRemoval();
      });
    }
    if (added.length > 0) {
      insertMentionsAtSelection(editor, added);
    }
  }, [editor, mentions, restoreFromParts]);

  return (
    <>
      <OnChangePlugin
        onChange={(editorState) => {
          const snapshot = getSnapshotFromEditorState(editorState);
          onChangeRef.current?.(lexicalPartsToDoc(snapshot.parts));
        }}
      />
      <KeyPlugin onSubmit={onSubmit} onCancel={onCancel} />
    </>
  );
}

function KeyPlugin({ onSubmit, onCancel }: { onSubmit?: () => void; onCancel?: () => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const handleBeforeInputCapture = (e: InputEvent) => {
      if (
        (e.inputType === "deleteContentBackward" || e.inputType === "deleteContentForward")
        && (domHasExpandedSelection(root, editor) || domSelectionCoversEditor(root, editor))
      ) {
        latestPointerIntentMentionSelector = null;
        let handled = false;
        editor.update(() => {
          handled = $deleteDomSelectedContent(root, editor);
        });
        if (handled) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (e.inputType === "insertText" && e.data && !e.isComposing) {
        suppressMentionDeleteUntilFreshInput = false;
        let handled = false;
        editor.update(() => {
          $syncSelectionForPendingPointerInput(editor, root);
          $ensureCaretNearTrackedMention();
          let sel = $getTrustedInsertSelection();
          if (!sel) {
            $applyDomSelectionToLexical(editor);
            $ensureCaretNearTrackedMention();
            const synced = $getSelection();
            if (!$isRangeSelection(synced)) return;
            sel = synced;
          }
          // Tracked placement only anchors the first keystroke after a click near
          // a mention. Releasing it lets the caret advance normally; otherwise the
          // stale offset re-anchors every keystroke and text types backwards.
          clearMentionEditPlacementState();
          if (!sel.isCollapsed()) {
            sel.insertText(e.data ?? "");
            handled = true;
            return;
          }
          const node = sel.anchor.getNode();
          if (!$isTextNode(node) || $isMentionNode(node)) return;
          const offset = sel.anchor.offset;
          if (replaceCaretAnchorWithText(node, e.data ?? "")) {
            handled = true;
            return;
          }
          node.spliceText(offset, 0, e.data ?? "", true);
          handled = true;
        });
        if (handled) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
    };
    const handlePointerUpInEditor = (e: PointerEvent) => {
      requestAnimationFrame(() => {
        editor.update(() => {
          const pointerUp = { x: e.clientX, y: e.clientY };
          if (
            pointerMovedEnoughToSelectText(latestEditorPointerDown, pointerUp)
            && domHasAnyExpandedSelectionInEditor(root, editor)
          ) {
            clearMentionEditPlacementState();
            latestPointerIntentMentionSelector = null;
            latestEditorPointerForInput = null;
            shouldSyncDomSelectionOnNextInput = false;
            $applyDomSelectionToLexical(editor);
            return;
          }
          clearMentionEditPlacementState();
          latestEditorPointerForInput = pointerUp;
          $syncSelectionFromDomInteraction(editor, root, e.clientX, e.clientY);
          shouldSyncDomSelectionOnNextInput = true;
        });
      });
    };
    const handleDocumentPointerDownCapture = (e: PointerEvent) => {
      suppressMentionDeleteUntilFreshInput = false;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const targetInsideEditor = target ? root.contains(target) : false;
      const editorRect = root.getBoundingClientRect();
      const inEditorBounds = e.clientX >= editorRect.left
        && e.clientX <= editorRect.right
        && e.clientY >= editorRect.top
        && e.clientY <= editorRect.bottom;
      latestCommentEditorPointerInside = targetInsideEditor || inEditorBounds;
      if (latestCommentEditorPointerInside) {
        const clientX = e.clientX;
        const clientY = e.clientY;
        latestEditorPointerDown = { x: clientX, y: clientY };
        latestEditorPointerForInput = { x: clientX, y: clientY };
        editor.update(() => {
          clearMentionEditPlacementState();
          $placeSelectionAtCoordinates(editor, root, clientX, clientY);
        });
        latestPointerIntentMentionSelector = getPointerIntentMentionSelector(root, clientX, clientY);
        shouldSyncDomSelectionOnNextInput = true;
      } else {
        clearMentionEditPlacementState();
        latestPointerIntentMentionSelector = null;
        latestEditorPointerForInput = null;
        latestEditorPointerDown = null;
        shouldSyncDomSelectionOnNextInput = false;
      }
    };
    root.addEventListener("beforeinput", handleBeforeInputCapture, true);
    root.addEventListener("pointerup", handlePointerUpInEditor);
    document.addEventListener("pointerdown", handleDocumentPointerDownCapture, true);

    const isEditorFocused = () => {
      const rootNode = root.getRootNode();
      const active = rootNode instanceof ShadowRoot
        ? rootNode.activeElement
        : document.activeElement;
      return active === root || (active != null && root.contains(active));
    };

    const handleSelectAllCapture = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "a") return;
      const path = e.composedPath();
      if (!path.includes(root) && !isEditorFocused()) return;
      e.preventDefault();
      e.stopPropagation();
      latestPointerIntentMentionSelector = null;
      editor.update(() => {
        $selectAll();
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onSubmit?.();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCancel?.();
        return;
      }
      if (!CARET_NAV_KEYS.has(e.key)) return;

      const plainHorizontal = (e.key === "ArrowLeft" || e.key === "ArrowRight")
        && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (plainHorizontal) {
        let moved = false;
        editor.update(() => {
          $applyDomSelectionToLexical(editor);
          moved = $moveCaretAcrossMention(e.key === "ArrowRight" ? "next" : "previous");
        });
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          clearMentionEditPlacementState();
          latestPointerIntentMentionSelector = null;
          latestEditorPointerForInput = null;
          shouldSyncDomSelectionOnNextInput = false;
          return;
        }
      }

      // Let the browser move the native caret, then mirror it into Lexical so
      // typing/deletion act on the new position. Lexical's own selectionchange
      // sync is shadow-blind, and a prior click leaves stale pointer coords.
      clearMentionEditPlacementState();
      latestPointerIntentMentionSelector = null;
      latestEditorPointerForInput = null;
      shouldSyncDomSelectionOnNextInput = true;
      const preferDirection = (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "Home")
        ? "previous"
        : "next";
      requestAnimationFrame(() => {
        editor.update(() => {
          $applyDomSelectionToLexical(editor);
          $ensureCaretOffMention(preferDirection);
        });
      });
    };
    const shadowRoot = root.getRootNode();
    const onSelectAllKeyDown = (event: Event) => handleSelectAllCapture(event as KeyboardEvent);
    document.addEventListener("keydown", handleSelectAllCapture, true);
    root.addEventListener("keydown", handleSelectAllCapture, true);
    if (shadowRoot instanceof ShadowRoot) {
      shadowRoot.addEventListener("keydown", onSelectAllKeyDown, true);
    }
    root.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleSelectAllCapture, true);
      root.removeEventListener("keydown", handleSelectAllCapture, true);
      if (shadowRoot instanceof ShadowRoot) {
        shadowRoot.removeEventListener("keydown", onSelectAllKeyDown, true);
      }
      root.removeEventListener("keydown", handleKeyDown);
      root.removeEventListener("beforeinput", handleBeforeInputCapture, true);
      root.removeEventListener("pointerup", handlePointerUpInEditor);
      document.removeEventListener("pointerdown", handleDocumentPointerDownCapture, true);
    };
  }, [editor, onCancel, onSubmit]);
  return null;
}

export const CommentEditor = forwardRef<CommentEditorApi, CommentEditorProps>(function CommentEditor(
  {
    initialText,
    mentions,
    contentParts,
    targets = [],
    placeholder = "Describe the change",
    onChange,
    onSubmit,
    onCancel,
  },
  ref,
) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const latestMentionsRef = useRef(mentions);
  const latestTargetsRef = useRef(targets);
  latestMentionsRef.current = mentions;
  latestTargetsRef.current = targets;

  const initialConfig = useMemo(() => ({
    namespace: "RetuneCommentEditor",
    nodes: [MentionNode],
    onError(error: Error) {
      throw error;
    },
    theme: {
      text: {
        bold: "",
      },
    },
  }), []);

  const readSnapshot = useCallback((): CommentEditorSnapshot => {
    const editor = editorRef.current;
    if (!editor) return { text: "", userText: "", mentionSelectors: [], parts: [] };
    return getSnapshotFromEditorState(editor.getEditorState());
  }, []);

  const readDoc = useCallback((): CommentDoc => {
    return lexicalPartsToDoc(readSnapshot().parts);
  }, [readSnapshot]);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const editor = editorRef.current;
      if (!editor || !text) return;
      editor.focus();
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = selection.anchor.getNode();
          if (
            selection.isCollapsed()
            && selection.anchor.key === selection.focus.key
            && $isTextNode(node)
            && !$isMentionNode(node)
            && replaceCaretAnchorWithText(node, text)
          ) {
            return;
          }
          selection.insertText(text);
        } else {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            paragraph.append($createTextNode(text));
            paragraph.selectEnd();
          }
        }
      });
    },
    insertMentions(mentionsToInsert: CommentMention[]) {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      insertMentionsAtSelection(editor, mentionsToInsert);
    },
    getDoc() {
      return readDoc();
    },
    getText() {
      return docToPlainText(readDoc());
    },
    getUserText() {
      return docToUserText(readDoc());
    },
    getMentions() {
      return readSnapshot().mentionSelectors;
    },
    setText(text: string) {
      const editor = editorRef.current;
      if (!editor) return;
      resetEditorContent(editor, latestMentionsRef.current, text);
    },
    restoreDoc(doc: CommentDoc) {
      const editor = editorRef.current;
      if (!editor) return;
      resetEditorContentFromParts(editor, docToLexicalParts(doc));
    },
    focus() {
      editorRef.current?.focus();
    },
    placeSelectionAtPoint(x: number, y: number) {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      editor.update(() => {
        const rootEl = editor.getRootElement();
        if (rootEl) $placeSelectionAtCoordinates(editor, rootEl, x, y);
      });
    },
    clear() {
      const editor = editorRef.current;
      if (!editor) return;
      resetEditorContent(editor, [], "");
    },
  }), [readDoc, readSnapshot]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PlainTextPlugin
        contentEditable={
          <ContentEditable
            className="retune-comment-editor"
            aria-label={placeholder}
          />
        }
        placeholder={<span className="retune-comment-placeholder" aria-hidden="true">{placeholder}</span>}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <CommentEditorPlugins
        initialText={initialText}
        mentions={mentions}
        contentParts={contentParts}
        targets={targets}
        onChange={onChange}
        editorRef={editorRef}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </LexicalComposer>
  );
});
