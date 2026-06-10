import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { CommentElementTarget } from "../../engine/comment-store";
import type { SelectEventMeta } from "../../selector/picker";
import type { SelectionChromeLayout } from "../../selector/selection-chrome-layout";
import type { InspectedElement } from "../../types";
import { inspectElement } from "../../ui/helpers";
import {
  applyTargetsToDraft,
  buildCommentTargetFromInspected,
  buildElementCommentDraft,
  buildSelectionCommentDraft,
  getDraftElementTargets,
  scanContainedElements,
  supportsLiveMentionEditing,
  type CommentDraft,
} from "./comment-draft";

type PickerHandle = {
  clearSelection: () => void;
  hideScopeHighlights: () => void;
  restoreSelection: (elements: Element[], primary?: Element) => void;
  setChromeLayout: (layout: SelectionChromeLayout | null) => void;
  setCommentDraftActive: (active: boolean) => void;
  setCommentMode: (enabled: boolean) => void;
  setPropertyEditMode: (enabled: boolean) => void;
  showSelectionOutline: (elements: Element[], primary?: Element) => void;
};

type UseCommentModeArgs = {
  active: boolean;
  mode: "select" | "draw" | "edit" | "comment";
  setMode: (mode: "select" | "draw" | "edit" | "comment") => void;
  setEditPanelOpen: (open: boolean) => void;
  setSelectedElement: (element: InspectedElement | null) => void;
  setSelectedElements: (elements: InspectedElement[]) => void;
  selectedElementRef: MutableRefObject<InspectedElement | null>;
  selectedElementsRef: MutableRefObject<InspectedElement[]>;
  pickerRef: MutableRefObject<PickerHandle | null>;
  overlayRootRef: MutableRefObject<{ root: ShadowRoot } | null>;
  enrichCommentDraft?: (draft: CommentDraft) => CommentDraft;
};

export function useCommentMode({
  active,
  mode,
  setMode,
  setEditPanelOpen,
  setSelectedElement,
  setSelectedElements,
  selectedElementRef,
  selectedElementsRef,
  pickerRef,
  overlayRootRef,
  enrichCommentDraft,
}: UseCommentModeArgs) {
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState<CommentDraft | null>(null);
  const commentDraftRef = useRef(commentDraft);
  commentDraftRef.current = commentDraft;

  const lastClickRef = useRef({ x: 0, y: 0 });
  const areaDragJustEndedRef = useRef(false);
  const commentDragRef = useRef<{
    startX: number;
    startY: number;
    dragging: boolean;
    areaEl: HTMLDivElement | null;
  } | null>(null);
  const popoverOpenRef = useRef(false);
  const popoverTextRef = useRef("");
  const popoverInitialTextRef = useRef("");
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const setPopoverText = useCallback((text: string) => {
    popoverTextRef.current = text;
  }, []);

  const openDraftPopover = useCallback((initialText = "") => {
    popoverOpenRef.current = true;
    popoverTextRef.current = initialText;
    popoverInitialTextRef.current = initialText;
  }, []);

  const openExistingComment = useCallback((id: number, text: string) => {
    openDraftPopover(text);
    setActiveCommentId(id);
    setCommentDraft(null);
  }, [openDraftPopover]);

  const closeExistingComment = useCallback(() => {
    popoverOpenRef.current = false;
    setActiveCommentId(null);
  }, []);

  useEffect(() => {
    if (!active) return;
    pickerRef.current?.setCommentMode(mode === "comment");
  }, [active, mode, pickerRef]);

  useEffect(() => {
    const trackClick = (e: MouseEvent) => {
      lastClickRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("click", trackClick, true);
    return () => document.removeEventListener("click", trackClick, true);
  }, []);

  const getCommentOutlineElements = useCallback((): Element[] => {
    return selectedElementsRef.current.length > 0
      ? selectedElementsRef.current.map((t) => t.element)
      : selectedElementRef.current
        ? [selectedElementRef.current.element]
        : [];
  }, [selectedElementRef, selectedElementsRef]);

  const appendElementsToCommentDraft = useCallback((inspectedTargets: InspectedElement[]) => {
    const draft = commentDraftRef.current;
    if (!draft || !popoverOpenRef.current || !supportsLiveMentionEditing(draft)) return;

    const existing = getDraftElementTargets(draft);
    const drawingTargets = existing.filter((target) => target.tagName === "drawing");
    const knownElements = new Set(selectedElementsRef.current.map((t) => t.element));
    const elementTargets = selectedElementsRef.current.length > 0
      ? selectedElementsRef.current.map(buildCommentTargetFromInspected)
      : existing.filter((target) => target.tagName !== "drawing");
    const knownSelectors = new Set(elementTargets.map((t) => t.selector));
    const novel = inspectedTargets.filter((target) => {
      const built = buildCommentTargetFromInspected(target);
      return !knownElements.has(target.element) && !knownSelectors.has(built.selector);
    });
    if (novel.length === 0) return;

    const multiInspected = [...selectedElementsRef.current, ...novel];
    const newElementTargets = multiInspected.map(buildCommentTargetFromInspected);
    const newTargets = [...newElementTargets, ...drawingTargets];
    setCommentDraft((prev) => {
      if (!prev || !supportsLiveMentionEditing(prev)) return prev;
      return applyTargetsToDraft(prev, newTargets);
    });

    selectedElementsRef.current = multiInspected;
    selectedElementRef.current = selectedElementRef.current ?? multiInspected[0] ?? null;
    setSelectedElement(selectedElementRef.current);
    setSelectedElements(multiInspected);
    pickerRef.current?.showSelectionOutline(
      multiInspected.map((t) => t.element),
      selectedElementRef.current?.element,
    );
  }, [pickerRef, selectedElementRef, selectedElementsRef, setSelectedElement, setSelectedElements]);

  const removeElementsFromCommentDraft = useCallback((elementsToRemove: Element[]) => {
    const draft = commentDraftRef.current;
    if (!draft || !popoverOpenRef.current || !supportsLiveMentionEditing(draft)) return;

    const removeSet = new Set(elementsToRemove);
    const remainingInspected = selectedElementsRef.current.filter((target) => !removeSet.has(target.element));
    const remainingElementTargets = remainingInspected.map(buildCommentTargetFromInspected);
    const drawingTargets = getDraftElementTargets(draft).filter((target) => target.tagName === "drawing");
    const remainingTargets = [...remainingElementTargets, ...drawingTargets];
    setCommentDraft((prev) => {
      if (!prev || !supportsLiveMentionEditing(prev)) return prev;
      return applyTargetsToDraft(prev, remainingTargets);
    });

    selectedElementsRef.current = remainingInspected;
    selectedElementRef.current = remainingInspected[0] ?? null;
    setSelectedElements(remainingInspected);
    setSelectedElement(remainingInspected[0] ?? null);
    pickerRef.current?.showSelectionOutline(
      remainingInspected.map((target) => target.element),
      remainingInspected[0]?.element,
    );
  }, [pickerRef, selectedElementRef, selectedElementsRef, setSelectedElement, setSelectedElements]);

  const syncCommentDraftMentionsFromEditor = useCallback((selectors: string[]) => {
    const draft = commentDraftRef.current;
    if (!draft || !popoverOpenRef.current) return;

    const existing = getDraftElementTargets(draft);
    const selectorSet = new Set(selectors);
    const remainingTargets = existing.filter((target) => selectorSet.has(target.selector));
    if (remainingTargets.length === existing.length) return;

    const remainingInspected = selectedElementsRef.current.filter((target) => selectorSet.has(target.selector));
    setCommentDraft((prev) => {
      if (!prev) return prev;
      return applyTargetsToDraft(prev, remainingTargets);
    });

    selectedElementsRef.current = remainingInspected;
    setSelectedElements(remainingInspected);
    setSelectedElement(remainingInspected[0] ?? null);
    if (remainingInspected.length > 0) {
      pickerRef.current?.showSelectionOutline(
        remainingInspected.map((target) => target.element),
        remainingInspected[0]?.element,
      );
    }
  }, [pickerRef, selectedElementsRef, setSelectedElement, setSelectedElements]);

  const dismissCommentDraft = useCallback(() => {
    popoverOpenRef.current = false;
    popoverTextRef.current = "";
    popoverInitialTextRef.current = "";
    setCommentDraft(null);
    if (modeRef.current === "comment") {
      pickerRef.current?.clearSelection();
    } else if (selectedElementsRef.current.length > 0 || selectedElementRef.current) {
      pickerRef.current?.restoreSelection(
        selectedElementsRef.current.map((t) => t.element),
        selectedElementRef.current?.element,
      );
    } else {
      pickerRef.current?.setCommentDraftActive(false);
    }
  }, [pickerRef, selectedElementRef, selectedElementsRef]);

  const shakePopover = useCallback(() => {
    const el = overlayRootRef.current?.root.querySelector(".retune-comment-popover") as HTMLElement | null;
    if (!el) return;
    if (el.classList.contains("shaking")) return;
    el.classList.add("shaking");
    const onEnd = () => {
      el.classList.remove("shaking");
      el.removeEventListener("animationend", onEnd);
    };
    el.addEventListener("animationend", onEnd);
  }, [overlayRootRef]);

  const shouldBlockForPopover = useCallback(() => {
    if (!popoverOpenRef.current) return false;
    // Element and drawing-tool drafts keep page clicks live so shift/alt-click can
    // add/remove inline mentions while the composer is open.
    if (supportsLiveMentionEditing(commentDraftRef.current)) return false;
    if (areaDragJustEndedRef.current) return true;
    const isDirty = popoverTextRef.current !== popoverInitialTextRef.current;
    if (isDirty) {
      shakePopover();
      return true;
    }
    dismissCommentDraft();
    setActiveCommentId(null);
    return false;
  }, [dismissCommentDraft, shakePopover]);
  const shouldBlockForPopoverRef = useRef(shouldBlockForPopover);
  shouldBlockForPopoverRef.current = shouldBlockForPopover;

  const handleSelectionComment = useCallback(() => {
    const inspected = selectedElementRef.current;
    if (!inspected) return;
    const outlineElements = getCommentOutlineElements();
    const targets = outlineElements.map((el) => inspectElement(el));
    const primary = targets.find((t) => t.element === inspected.element) ?? inspected;
    const rect = primary.element.getBoundingClientRect();
    const cursor = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    let draft = buildSelectionCommentDraft(targets, primary, cursor);
    if (enrichCommentDraft) {
      draft = enrichCommentDraft(draft);
    }
    selectedElementRef.current = primary;
    selectedElementsRef.current = targets;
    setSelectedElement(primary);
    setSelectedElements(targets);
    openDraftPopover();
    setCommentDraft(draft);
    setEditPanelOpen(false);
    pickerRef.current?.setPropertyEditMode(false);
    pickerRef.current?.setChromeLayout(null);
    pickerRef.current?.hideScopeHighlights();
    pickerRef.current?.showSelectionOutline(outlineElements, primary.element);
  }, [
    enrichCommentDraft,
    getCommentOutlineElements,
    openDraftPopover,
    pickerRef,
    selectedElementRef,
    selectedElementsRef,
    setEditPanelOpen,
    setSelectedElement,
    setSelectedElements,
  ]);

  const handleCommentSelect = useCallback((element: Element, meta?: SelectEventMeta): boolean => {
    const selectedEls = meta?.selectedElements ?? [element];
    if (selectedEls.length === 0) {
      if (supportsLiveMentionEditing(commentDraftRef.current) && popoverOpenRef.current) return true;
      return false;
    }

    if (supportsLiveMentionEditing(commentDraftRef.current) && popoverOpenRef.current) {
      if (areaDragJustEndedRef.current) return true;
      if (meta?.altKey) {
        removeElementsFromCommentDraft([element]);
        return true;
      }
      if (meta?.shiftKey) {
        appendElementsToCommentDraft([inspectElement(element)]);
        return true;
      }
      if (modeRef.current !== "comment") return true;
    }

    if (modeRef.current !== "comment") return false;

    if (areaDragJustEndedRef.current) return true;
    const cursor = lastClickRef.current;
    const inspected = inspectElement(element);
    const draft = buildElementCommentDraft(element, cursor, inspected);
    openDraftPopover();
    selectedElementRef.current = inspected;
    selectedElementsRef.current = [inspected];
    setSelectedElement(inspected);
    setSelectedElements([inspected]);
    setEditPanelOpen(false);
    pickerRef.current?.setPropertyEditMode(false);
    pickerRef.current?.setChromeLayout(null);
    setCommentDraft(draft);
    pickerRef.current?.showSelectionOutline([element], element);
    return true;
  }, [
    appendElementsToCommentDraft,
    openDraftPopover,
    pickerRef,
    removeElementsFromCommentDraft,
    selectedElementRef,
    selectedElementsRef,
    setEditPanelOpen,
    setSelectedElement,
    setSelectedElements,
  ]);

  useEffect(() => {
    if (!active || mode !== "comment") return;

    const handlePointerDown = (e: PointerEvent) => {
      const path = e.composedPath();
      for (let i = 0; i < path.length; i++) {
        if (path[i] instanceof HTMLElement && (path[i] as HTMLElement).hasAttribute("data-retune-host")) return;
      }
      if (shouldBlockForPopoverRef.current()) return;
      e.preventDefault();
      const areaEl = document.createElement("div");
      areaEl.style.cssText = `position:fixed;border:1px dashed #0D99FF;pointer-events:none;z-index:2147483640;display:none;`;
      document.body.appendChild(areaEl);
      commentDragRef.current = { startX: e.clientX, startY: e.clientY, dragging: false, areaEl };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const drag = commentDragRef.current;
      if (!drag) return;
      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (dx > 5 || dy > 5) {
        drag.dragging = true;
        if (drag.areaEl) {
          drag.areaEl.style.display = "block";
          drag.areaEl.style.left = Math.min(e.clientX, drag.startX) + "px";
          drag.areaEl.style.top = Math.min(e.clientY, drag.startY) + "px";
          drag.areaEl.style.width = dx + "px";
          drag.areaEl.style.height = dy + "px";
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const drag = commentDragRef.current;
      if (!drag) return;
      commentDragRef.current = null;

      if (drag.dragging && drag.areaEl) {
        const area = {
          x: Math.min(e.clientX, drag.startX),
          y: Math.min(e.clientY, drag.startY),
          width: Math.abs(e.clientX - drag.startX),
          height: Math.abs(e.clientY - drag.startY),
        };
        drag.areaEl.remove();
        if (area.width > 10 && area.height > 10) {
          openDraftPopover();
          areaDragJustEndedRef.current = true;
          setTimeout(() => { areaDragJustEndedRef.current = false; }, 50);
          const containedElements = scanContainedElements(area);
          setCommentDraft({
            position: { x: e.clientX, y: e.clientY },
            type: "area",
            area,
            areaScroll: { x: window.scrollX, y: window.scrollY },
            elementInfo: containedElements.length > 0 ? {
              tagName: "area",
              componentName: containedElements[0].componentName,
              componentPath: [],
              classes: [],
              textContent: null,
              containedElements,
            } : undefined,
          });
        }
      } else if (drag.areaEl) {
        drag.areaEl.remove();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (shouldBlockForPopoverRef.current()) return;
      if (popoverOpenRef.current) {
        dismissCommentDraft();
        setActiveCommentId(null);
      } else {
        setMode("select");
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      if (commentDragRef.current?.areaEl) commentDragRef.current.areaEl.remove();
    };
  }, [active, dismissCommentDraft, mode, openDraftPopover, setMode]);

  const getCurrentDraftElementTargets = useCallback((draft: CommentDraft): CommentElementTarget[] => {
    return getDraftElementTargets(draft);
  }, []);

  return {
    activeCommentId,
    setActiveCommentId,
    commentDraft,
    setCommentDraft,
    popoverOpenRef,
    setPopoverText,
    openDraftPopover,
    openExistingComment,
    closeExistingComment,
    dismissCommentDraft,
    shouldBlockForPopover,
    shouldBlockForPopoverRef,
    handleSelectionComment,
    handleCommentSelect,
    syncCommentDraftMentionsFromEditor,
    getDraftElementTargets: getCurrentDraftElementTargets,
  };
}
