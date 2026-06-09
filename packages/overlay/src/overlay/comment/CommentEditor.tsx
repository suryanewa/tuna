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
  $isRangeSelection,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import type { CommentElementTarget } from "../../engine/comment-store";
import { parseCommentTextIntoParts, type CommentContentPart } from "./comment-draft";
import { $createMentionNode, $isMentionNode, MentionNode } from "./mention-node";

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
      if (paragraph) {
        paragraph.append(...nodes);
        paragraph.selectEnd();
      }
    }
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
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
    };
    root.addEventListener("keydown", handleKeyDown);
    return () => root.removeEventListener("keydown", handleKeyDown);
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
          if (paragraph) {
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
