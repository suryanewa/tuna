"use client";

import { useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useTiptapContext } from "./TiptapProvider";
import { createEditorExtensions } from "./tiptap-extensions";
import { cn } from "@/lib/utils";

interface TiptapTextEditorProps {
  /** Initial content: richContent JSON or plain text string */
  initialContent: Record<string, unknown> | string;
  /** Called on blur with the editor's JSON and plain text */
  onSave: (richContent: Record<string, unknown>, plainText: string) => void;
  /** Called to exit editing mode */
  onExit: () => void;
  /** Whether to discard changes (Escape key) */
  className?: string;
}

export function TiptapTextEditor({
  initialContent,
  onSave,
  onExit,
  className,
}: TiptapTextEditorProps) {
  const { setEditor } = useTiptapContext();
  const isExitingRef = useRef(false);

  // Convert plain text to Tiptap-compatible content
  const getInitialContent = () => {
    if (typeof initialContent === "string") {
      // Convert plain text: split by newlines, join with hard breaks
      // For a flat document (content: 'inline*'), content is just text + hardBreak nodes
      //
      // Strip trailing newlines first — split("\n") on a string ending with "\n"
      // produces a trailing empty string, which causes a trailing hardBreak (<br>)
      // that renders as an extra empty line the user can't remove.
      const trimmed = initialContent.replace(/\n+$/, "");
      if (!trimmed) {
        return { type: "doc", content: [] };
      }
      const lines = trimmed.split("\n");
      const content: Record<string, unknown>[] = [];
      lines.forEach((line, i) => {
        if (i > 0) {
          content.push({ type: "hardBreak" });
        }
        if (line) {
          content.push({ type: "text", text: line });
        }
      });
      return { type: "doc", content };
    }
    // Already a Tiptap JSON document
    return initialContent;
  };

  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: getInitialContent(),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        style: "outline: none; cursor: text; white-space: pre-line; font-family: inherit; font-feature-settings: inherit; min-height: 100%; width: 100%;",
      },
      handleClick: (_view, _pos, event) => {
        // Prevent native <a> navigation when clicking links inside the editor.
        // Tiptap's openOnClick:false stops programmatic open but not the browser default.
        const target = event.target as HTMLElement;
        if (target.tagName === "A" || target.closest("a")) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          isExitingRef.current = true;
          onExit();
          return true;
        }
        return false;
      },
    },
    onBlur: ({ editor: e, event }) => {
      if (isExitingRef.current) {
        isExitingRef.current = false;
        return;
      }

      // If focus is moving to the property panel, save but stay in editing mode
      // so inline styling (links, bold, etc.) can be applied to the selection.
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      const isPanel = relatedTarget?.closest("[data-editor-panel]") != null;

      const json = e.getJSON() as Record<string, unknown>;
      const text = e.getText({ blockSeparator: "\n" });
      onSave(json, text);

      if (!isPanel) {
        onExit();
      }
    },
  });

  // Register editor with TiptapProvider context
  useEffect(() => {
    if (editor) {
      setEditor(editor);
    }
    return () => {
      setEditor(null);
    };
  }, [editor, setEditor]);

  // Focus and select all on mount
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        editor.commands.focus();
        editor.commands.selectAll();
      });
    }
  }, [editor]);

  if (!editor) return null;

  return <EditorContent editor={editor} className={cn("min-h-full w-full", className)} />;
}
