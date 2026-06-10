import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
  COMMAND_PRIORITY_CRITICAL,
  DELETE_CHARACTER_COMMAND,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from "lexical";
import type { CommentElementTarget } from "../../engine/comment-store";
import { parseCommentTextIntoParts, type CommentContentPart } from "./comment-draft";
import { $createMentionNode, $isMentionNode, MentionNode } from "./mention-node";

let latestCommentEditorPointerInside = true;
let latestPointerIntentMentionSelector: string | null = null;
let suppressMentionDeleteUntilFreshInput = false;

const OUTSIDE_POINTER_MENTION_HIT_SLOP_PX = 24;

export type CommentMention = {
  name: string;
  color: string;
  selector: string;
};

export type CommentEditorSnapshot = {
  text: string;
  userText: string;
  mentionSelectors: string[];
};

export type CommentEditorApi = {
  insertText: (text: string) => void;
  insertMentions: (mentions: CommentMention[]) => void;
  getText: () => string;
  getUserText: () => string;
  getMentions: () => string[];
  setText: (text: string) => void;
  /** Restore full editor content including inline mention positions. */
  restoreContent: (text: string, targets: CommentElementTarget[]) => void;
  focus: () => void;
  clear: () => void;
};

type CommentEditorProps = {
  initialText: string;
  mentions: CommentMention[];
  /** Parsed stored comment text with inline mention positions (edit mode). */
  contentParts?: CommentContentPart[];
  placeholder?: string;
  onChange?: (snapshot: CommentEditorSnapshot) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
};

function getSnapshotFromEditorState(editorState: EditorState): CommentEditorSnapshot {
  let snapshot: CommentEditorSnapshot = { text: "", userText: "", mentionSelectors: [] };
  editorState.read(() => {
    const root = $getRoot();
    const mentionSelectors: string[] = [];
    const userTextParts: string[] = [];
    for (const node of root.getAllTextNodes()) {
      if ($isMentionNode(node)) {
        mentionSelectors.push(node.getSelector());
      } else {
        userTextParts.push(node.getTextContent());
      }
    }
    snapshot = {
      text: root.getTextContent().replace(/\u00a0/g, " ").replace(/\u200b/g, "").trim(),
      userText: userTextParts.join("").replace(/\u00a0/g, " ").replace(/\u200b/g, "").trim(),
      mentionSelectors,
    };
  });
  return snapshot;
}

function createContentNodes(mentions: CommentMention[], text: string): LexicalNode[] {
  const nodes: LexicalNode[] = [];
  for (const mention of mentions) {
    nodes.push($createMentionNode(mention.name, mention.color, mention.selector));
    nodes.push($createTextNode(" "));
  }
  if (text) {
    nodes.push($createTextNode(text));
  }
  return nodes;
}

function createContentNodesFromParts(parts: CommentContentPart[]): LexicalNode[] {
  const nodes: LexicalNode[] = [];
  for (const part of parts) {
    if (part.type === "mention") {
      nodes.push($createMentionNode(part.mention.name, part.mention.color, part.mention.selector));
    } else if (part.text) {
      nodes.push($createTextNode(part.text));
    }
  }
  // A trailing mention token (contentEditable=false) leaves the caret with no
  // editable anchor, which misplaces focus and crashes selection on click.
  // Mirror the draft seed path and always end in an editable text node.
  const lastNode = nodes[nodes.length - 1];
  if (!lastNode || $isMentionNode(lastNode)) {
    nodes.push($createTextNode(" "));
  }
  return nodes;
}

function isWhitespaceOnlyTextNode(node: LexicalNode | null | undefined) {
  return $isTextNode(node) && !$isMentionNode(node) && node.getTextContent().trim() === "";
}

function normalizeMentionSpacing() {
  const root = $getRoot();
  for (const node of root.getAllTextNodes()) {
    if (!$isMentionNode(node)) continue;
    const next = node.getNextSibling();
    if (!isWhitespaceOnlyTextNode(next)) continue;

    if (!$isTextNode(next)) continue;
    next.setTextContent(" ");

    let cursor = next.getNextSibling();
    while (isWhitespaceOnlyTextNode(cursor)) {
      if (!$isTextNode(cursor)) break;
      const extraSpacer = cursor;
      cursor = extraSpacer.getNextSibling();
      extraSpacer.remove();
    }
  }
}

function normalizeSpacingAfterMentionRemoval() {
  normalizeMentionSpacing();

  let nodes = rootTextNodes();
  const hasMention = nodes.some((node) => $isMentionNode(node));
  const hasUserText = nodes.some((node) => !$isMentionNode(node) && node.getTextContent().trim() !== "");

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
      if (isWhitespaceOnlyTextNode(node)) node.remove();
    }
  }

  nodes = rootTextNodes();
  let previousWhitespace: TextNode | null = null;
  for (const node of nodes) {
    if (!isWhitespaceOnlyTextNode(node)) {
      previousWhitespace = null;
      continue;
    }
    if (previousWhitespace) {
      node.remove();
      continue;
    }
    node.setTextContent(" ");
    previousWhitespace = node;
  }
}

function rootTextNodes(): TextNode[] {
  return $getRoot().getAllTextNodes();
}

type MentionRect = {
  selector: string;
  left: number;
  distanceX: number;
  distanceY: number;
};

function getMentionRectsNearPoint(root: HTMLElement, x: number, y: number): MentionRect[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-mention-selector]")).flatMap((mention) => {
    const selector = mention.dataset.mentionSelector;
    if (!selector) return [];
    const rect = mention.getBoundingClientRect();
    return [{
      selector,
      left: rect.left,
      distanceX: x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0,
      distanceY: y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0,
    }];
  });
}

function getPointerIntentMentionSelector(root: HTMLElement, x: number, y: number): string | null {
  const mentions = getMentionRectsNearPoint(root, x, y);
  if (mentions.length === 0) return null;

  // Click in the horizontal gap immediately before a mention (same row).
  let following: { selector: string; distance: number } | null = null;
  for (const mention of mentions) {
    if (x > mention.left) continue;
    const distance = Math.hypot(mention.left - x, mention.distanceY);
    if (distance > OUTSIDE_POINTER_MENTION_HIT_SLOP_PX) continue;
    if (!following || distance < following.distance) {
      following = { selector: mention.selector, distance };
    }
  }
  if (following) return following.selector;

  // Click landed on a mention chip — delete that mention.
  for (const mention of mentions) {
    if (mention.distanceX === 0 && mention.distanceY === 0) {
      return mention.selector;
    }
  }

  // Nearest mention within slop (fallback for edge clicks).
  let nearest: { selector: string; distance: number } | null = null;
  for (const mention of mentions) {
    const distance = Math.hypot(mention.distanceX, mention.distanceY);
    if (!nearest || distance < nearest.distance) {
      nearest = { selector: mention.selector, distance };
    }
  }
  return nearest && nearest.distance <= OUTSIDE_POINTER_MENTION_HIT_SLOP_PX
    ? nearest.selector
    : null;
}

function findMentionNodeBySelector(selector: string): MentionNode | null {
  for (const node of rootTextNodes()) {
    if ($isMentionNode(node) && node.getSelector() === selector) return node;
  }
  return null;
}

function resetEditorContent(editor: LexicalEditor, mentions: CommentMention[], text: string) {
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    const paragraph = $createParagraphNode();
    paragraph.append(...createContentNodes(mentions, text));
    root.append(paragraph);
    paragraph.selectEnd();
  });
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
  editor.update(() => {
    const selection = $getSelection();
    const nodes: LexicalNode[] = [];
    for (const mention of mentions) {
      nodes.push($createTextNode(" "));
      nodes.push($createMentionNode(mention.name, mention.color, mention.selector));
      nodes.push($createTextNode(" "));
    }
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
  onChange,
  editorRef,
  onSubmit,
  onCancel,
}: CommentEditorProps & {
  editorRef: MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();
  const mentionSelectorsRef = useRef<string[]>(mentions.map((mention) => mention.selector));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  editorRef.current = editor;
  const restoreFromParts = !!contentParts;

  useEffect(() => {
    const isWhitespaceTextNode = (node: LexicalNode | null | undefined): node is TextNode =>
      $isTextNode(node) && !$isMentionNode(node) && node.getTextContent().trim() === "";

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
      node.setTextContent(" ");
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
      if (isBackward && text.slice(0, offset).trim() === "") {
        if (findMentionAcrossWhitespaceReadOnly(node, "next")) return true;
        return !!findMentionAcrossWhitespaceReadOnly(node, "previous");
      }
      if (!isBackward && text.slice(offset).trim() === "") {
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
      removedMention.remove();

      const preferred = direction === "previous"
        ? (normalizeSpacer(nextSibling) ?? normalizeSpacer(fallbackTextNode) ?? normalizeSpacer(previousSibling))
        : (normalizeSpacer(previousSibling) ?? normalizeSpacer(fallbackTextNode) ?? normalizeSpacer(nextSibling));

      if ($isTextNode(preferred)) {
        if (preferred === previousSibling) preferred.selectEnd();
        else preferred.selectStart();
      } else {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          paragraph.selectEnd();
        }
      }
      requestAnimationFrame(() => editor.focus());
    };

    const removePointerIntentMention = (isBackward: boolean) => {
      if (!latestPointerIntentMentionSelector) return false;
      const intentMention = findMentionNodeBySelector(latestPointerIntentMentionSelector);
      if (!intentMention) return false;

      if (latestCommentEditorPointerInside) {
        const sel = $getSelection();
        if ($isRangeSelection(sel) && sel.isCollapsed()) {
          const node = sel.anchor.getNode();
          if ($isTextNode(node) && !$isMentionNode(node)) {
            const nextMention = findMentionAcrossWhitespaceReadOnly(node, "next");
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
      const sel = $getSelection();
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
          if (isBackward && text.slice(0, offset).trim() === "") {
            const nextMention = findMentionAcrossWhitespace(node, "next");
            if (nextMention) {
              selectAnchorAfterMentionRemoval(nextMention, "previous", node);
              node.selectStart();
              requestAnimationFrame(() => editor.focus());
              return true;
            }
            const previousMention = findMentionAcrossWhitespace(node, "previous");
            if (previousMention) {
              selectAnchorAfterMentionRemoval(previousMention, "previous", node);
              node.selectStart();
              requestAnimationFrame(() => editor.focus());
              return true;
            }
          }
          if (!isBackward && text.slice(offset).trim() === "") {
            const nextMention = findMentionAcrossWhitespace(node, "next");
            if (nextMention) {
              selectAnchorAfterMentionRemoval(nextMention, "next", node);
              node.selectStart();
              requestAnimationFrame(() => editor.focus());
              return true;
            }
          }
          if (isBackward && offset === 1 && text === " " && $isMentionNode(node.getPreviousSibling())) {
            node.getPreviousSibling()?.remove();
            node.selectStart();
            requestAnimationFrame(() => editor.focus());
            return true;
          }
          if (!isBackward && offset === 0 && text === " " && $isMentionNode(node.getNextSibling())) {
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

  useEffect(() => {
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
          onChangeRef.current?.(getSnapshotFromEditorState(editorState));
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
      if (e.inputType === "insertText" && e.data && !e.isComposing) {
        suppressMentionDeleteUntilFreshInput = false;
        let handled = false;
        editor.update(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel) || !sel.isCollapsed() || sel.anchor.key !== sel.focus.key) return;
          const node = sel.anchor.getNode();
          if (!$isTextNode(node) || $isMentionNode(node)) return;
          const offset = sel.anchor.offset;
          node.spliceText(offset, 0, e.data ?? "", true);
          handled = true;
        });
        if (handled) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
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
      latestPointerIntentMentionSelector = getPointerIntentMentionSelector(root, e.clientX, e.clientY);
    };
    root.addEventListener("beforeinput", handleBeforeInputCapture, true);
    document.addEventListener("pointerdown", handleDocumentPointerDownCapture, true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onSubmit?.();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCancel?.();
      }
    };
    root.addEventListener("keydown", handleKeyDown);
    return () => {
      root.removeEventListener("keydown", handleKeyDown);
      root.removeEventListener("beforeinput", handleBeforeInputCapture, true);
      document.removeEventListener("pointerdown", handleDocumentPointerDownCapture, true);
    };
  }, [editor, onCancel, onSubmit]);
  return null;
}

export const CommentEditor = forwardRef<CommentEditorApi, CommentEditorProps>(function CommentEditor(
  { initialText, mentions, contentParts, placeholder = "Describe the change", onChange, onSubmit, onCancel },
  ref,
) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const latestMentionsRef = useRef(mentions);
  latestMentionsRef.current = mentions;

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
    if (!editor) return { text: "", userText: "", mentionSelectors: [] };
    return getSnapshotFromEditorState(editor.getEditorState());
  }, []);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const editor = editorRef.current;
      if (!editor || !text) return;
      editor.focus();
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
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
    getText() {
      return readSnapshot().text;
    },
    getUserText() {
      return readSnapshot().userText;
    },
    getMentions() {
      return readSnapshot().mentionSelectors;
    },
    setText(text: string) {
      const editor = editorRef.current;
      if (!editor) return;
      resetEditorContent(editor, latestMentionsRef.current, text);
    },
    restoreContent(text: string, targets: CommentElementTarget[]) {
      const editor = editorRef.current;
      if (!editor) return;
      const orderedTargets = targets;
      resetEditorContentFromParts(editor, parseCommentTextIntoParts(text, orderedTargets));
    },
    focus() {
      editorRef.current?.focus();
    },
    clear() {
      const editor = editorRef.current;
      if (!editor) return;
      resetEditorContent(editor, [], "");
    },
  }), [readSnapshot]);

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
        onChange={onChange}
        editorRef={editorRef}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </LexicalComposer>
  );
});
