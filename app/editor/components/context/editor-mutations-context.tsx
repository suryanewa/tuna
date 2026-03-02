import { createContext, useContext } from "react";
import type { EditorMutations } from "./editor-mutations-types";

export const EditorMutationsContext = createContext<EditorMutations | null>(null);

export function useEditorMutations(): EditorMutations {
  const ctx = useContext(EditorMutationsContext);
  if (!ctx) throw new Error("useEditorMutations must be used within EditorMutationsProvider");
  return ctx;
}
