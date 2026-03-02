import { useSyncExternalStore, useCallback, useRef } from "react";
import type { CreationTool } from "@/lib/playground/editor-types";
import { ARTBOARD_LAYER_ID } from "@/lib/playground/store";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EditorUIState = {
  selectedIds: string[];
  draggedId: string | null;
  editingElementId: string | null;
  focusedContainerId: string | null;
  creationTool: CreationTool;
  viewMode: "edit" | "preview";
  device: "desktop" | "tablet" | "mobile";
  panelTab: "design" | "animate";
  previewFont: string | null;
  isAdmin: boolean;
  lastSelectedId: string | null;
};

// ── Store internals ────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();

let state: EditorUIState = {
  selectedIds: [ARTBOARD_LAYER_ID],
  draggedId: null,
  editingElementId: null,
  focusedContainerId: null,
  creationTool: "select",
  viewMode: "edit",
  device: "desktop",
  panelTab: "design",
  previewFont: null,
  isAdmin: false,
  lastSelectedId: null,
};

function emitChange() {
  listeners.forEach((cb) => cb());
}

/**
 * Update state without notifying subscribers. Used during React render phase
 * (e.g. sync bridge in YjsEditorProvider) where calling emitChange() would
 * trigger "Cannot update a component while rendering another" warnings.
 * Subscribers will read the updated value via getSnapshot() when they render.
 */
export function _setStateDuringRender(partial: Partial<EditorUIState>) {
  state = { ...state, ...partial };
}

// ── Store object ───────────────────────────────────────────────────────────────

export const editorStateStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },

  getSnapshot(): EditorUIState {
    return state;
  },

  // ── Setters ────────────────────────────────────────────────────────────────

  setSelectedIds(ids: string[]) {
    state = { ...state, selectedIds: ids };
    emitChange();
  },

  setDraggedId(id: string | null) {
    state = { ...state, draggedId: id };
    emitChange();
  },

  setEditingElementId(id: string | null) {
    state = { ...state, editingElementId: id };
    emitChange();
  },

  setFocusedContainerId(id: string | null) {
    state = { ...state, focusedContainerId: id };
    emitChange();
  },

  setCreationTool(tool: CreationTool) {
    state = { ...state, creationTool: tool };
    emitChange();
  },

  setViewMode(mode: "edit" | "preview") {
    state = { ...state, viewMode: mode };
    emitChange();
  },

  setDevice(device: "desktop" | "tablet" | "mobile") {
    state = { ...state, device: device };
    emitChange();
  },

  setPanelTab(tab: "design" | "animate") {
    state = { ...state, panelTab: tab };
    emitChange();
  },

  setPreviewFont(font: string | null) {
    state = { ...state, previewFont: font };
    emitChange();
  },

  setIsAdmin(admin: boolean) {
    state = { ...state, isAdmin: admin };
    emitChange();
  },

  setLastSelectedId(id: string | null) {
    state = { ...state, lastSelectedId: id };
    emitChange();
  },

  /**
   * Batch-update multiple fields at once (single emitChange).
   */
  setState(partial: Partial<EditorUIState>) {
    state = { ...state, ...partial };
    emitChange();
  },
};

// ── Convenience setter exports ─────────────────────────────────────────────────

export const setSelectedIds = editorStateStore.setSelectedIds;
export const setDraggedId = editorStateStore.setDraggedId;
export const setEditingElementId = editorStateStore.setEditingElementId;
export const setFocusedContainerId = editorStateStore.setFocusedContainerId;
export const setCreationTool = editorStateStore.setCreationTool;
export const setViewMode = editorStateStore.setViewMode;
export const setDevice = editorStateStore.setDevice;
export const setPanelTab = editorStateStore.setPanelTab;
export const setPreviewFont = editorStateStore.setPreviewFont;
export const setIsAdmin = editorStateStore.setIsAdmin;
export const setLastSelectedId = editorStateStore.setLastSelectedId;
export const setEditorState = editorStateStore.setState;

// ── Hooks ──────────────────────────────────────────────────────────────────────

/** Returns the full UI state snapshot. Re-renders on any field change. */
export function useEditorState(): EditorUIState {
  return useSyncExternalStore(
    editorStateStore.subscribe,
    editorStateStore.getSnapshot,
    editorStateStore.getSnapshot
  );
}

/** Returns only `selectedIds`. Re-renders only when the array reference changes. */
export function useSelectedIds(): string[] {
  const selectedIdsRef = useRef(state.selectedIds);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().selectedIds;
      if (next !== selectedIdsRef.current) {
        selectedIdsRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => selectedIdsRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns `true` if the given element id is currently selected.
 * Only re-renders when this specific element's inclusion status changes.
 */
export function useIsSelected(id: string): boolean {
  const prevRef = useRef<boolean>(state.selectedIds.includes(id));

  const subscribe = useCallback(
    (cb: () => void) => {
      return editorStateStore.subscribe(() => {
        const next = editorStateStore.getSnapshot().selectedIds.includes(id);
        if (next !== prevRef.current) {
          prevRef.current = next;
          cb();
        }
      });
    },
    [id]
  );

  const getSnapshot = useCallback(
    () => prevRef.current,
    []
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `editingElementId`. Only re-renders when it changes. */
export function useEditingElementId(): string | null {
  const prevRef = useRef(state.editingElementId);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().editingElementId;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `draggedId`. Only re-renders when it changes. */
export function useDraggedId(): string | null {
  const prevRef = useRef(state.draggedId);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().draggedId;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `creationTool`. Only re-renders when it changes. */
export function useCreationTool(): CreationTool {
  const prevRef = useRef(state.creationTool);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().creationTool;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `viewMode`. Only re-renders when it changes. */
export function useViewMode(): "edit" | "preview" {
  const prevRef = useRef(state.viewMode);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().viewMode;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `device`. Only re-renders when it changes. */
export function useDevice(): "desktop" | "tablet" | "mobile" {
  const prevRef = useRef(state.device);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().device;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `panelTab`. Only re-renders when it changes. */
export function usePanelTab(): "design" | "animate" {
  const prevRef = useRef(state.panelTab);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().panelTab;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `previewFont`. Only re-renders when it changes. */
export function usePreviewFont(): string | null {
  const prevRef = useRef(state.previewFont);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().previewFont;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `isAdmin`. Only re-renders when it changes. */
export function useIsAdmin(): boolean {
  const prevRef = useRef(state.isAdmin);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().isAdmin;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns `focusedContainerId`. Only re-renders when it changes. */
export function useFocusedContainerId(): string | null {
  const prevRef = useRef(state.focusedContainerId);

  const subscribe = useCallback((cb: () => void) => {
    return editorStateStore.subscribe(() => {
      const next = editorStateStore.getSnapshot().focusedContainerId;
      if (next !== prevRef.current) {
        prevRef.current = next;
        cb();
      }
    });
  }, []);

  const getSnapshot = useCallback(() => prevRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
