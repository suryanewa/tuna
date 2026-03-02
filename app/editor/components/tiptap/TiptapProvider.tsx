"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/react";

interface TiptapContextValue {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
}

const TiptapContext = createContext<TiptapContextValue>({
  editor: null,
  setEditor: () => {},
});

export function TiptapProvider({ children }: { children: ReactNode }) {
  const [editor, setEditorState] = useState<Editor | null>(null);

  const setEditor = useCallback((e: Editor | null) => {
    setEditorState(e);
  }, []);

  return (
    <TiptapContext.Provider value={{ editor, setEditor }}>
      {children}
    </TiptapContext.Provider>
  );
}

export function useTiptapEditor(): Editor | null {
  return useContext(TiptapContext).editor;
}

export function useTiptapContext(): TiptapContextValue {
  return useContext(TiptapContext);
}
