"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DragHandle16 } from "@/components/icons/editor-16";

interface SectionWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Section container with border-bottom separator
 */
export function SectionWrapper({ children, className }: SectionWrapperProps) {
  return (
    <div
      className={cn("border-b border-stone-200 dark:border-stone-800 select-none", className)}
    >
      {children}
    </div>
  );
}

/**
 * Section body with standard 12px bottom padding
 */
export function SectionBody({ children, className }: SectionWrapperProps) {
  return <div className={cn("pb-3", className)}>{children}</div>;
}

interface SectionRowProps extends SectionWrapperProps {
  /** When true, uses 8px right padding (for rows with trailing icon button). Default 40px right padding. */
  hasTrailingAction?: boolean;
}

/**
 * Standard row container with 16px left, 4px vertical padding
 * Right padding: 40px default, 8px when hasTrailingAction is true
 */
export function SectionRow({ children, className, hasTrailingAction = false }: SectionRowProps) {
  return (
    <div className={cn("pl-4 py-1", hasTrailingAction ? "pr-2" : "pr-10", className)}>
      {children}
    </div>
  );
}

// ============================================================================
// Sortable variants (drag-to-reorder)
// ============================================================================

interface SortableContextValue {
  startDrag: (index: number) => void;
  updateDrag: (clientY: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  setDragRefs: (ac: AbortController, style: HTMLStyleElement) => void;
  itemCount: number;
}

const SortableCtx = React.createContext<SortableContextValue | null>(null);

interface CachedRect {
  top: number;
  bottom: number;
  midY: number;
}

interface DragState {
  dragIndex: number;
  dropIndex: number;
  rects: CachedRect[];
  containerTop: number;
  dragElement: HTMLElement | null;
  handles: HTMLElement[];
  abortController: AbortController | null;
  cursorStyle: HTMLStyleElement | null;
}

interface SortableBodyProps<T> {
  values: T[];
  onReorder: (newOrder: T[]) => void;
  children: React.ReactNode;
  className?: string;
}

export function SortableBody<T>({
  values,
  onReorder,
  children,
  className,
}: SortableBodyProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const indicatorRef = React.useRef<HTMLDivElement>(null);
  const valuesRef = React.useRef(values);
  valuesRef.current = values;
  const onReorderRef = React.useRef(onReorder);
  onReorderRef.current = onReorder;
  const dragRef = React.useRef<DragState | null>(null);

  const startDrag = React.useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rows = container.querySelectorAll<HTMLElement>("[data-sortable-index]");
    const containerRect = container.getBoundingClientRect();
    const rects: CachedRect[] = Array.from(rows).map((row) => {
      const rect = row.getBoundingClientRect();
      const top = rect.top - containerRect.top;
      const bottom = rect.bottom - containerRect.top;
      return { top, bottom, midY: (top + bottom) / 2 };
    });

    const dragElement = rows[index] ?? null;
    if (dragElement) {
      dragElement.classList.add("bg-blue-200", "dark:bg-blue-950/50");
    }

    const handles = Array.from(
      container.querySelectorAll<HTMLElement>("[data-drag-handle]")
    );
    handles.forEach((handle, i) => {
      if (i === index) {
        handle.style.opacity = "1";
      } else {
        handle.style.visibility = "hidden";
      }
    });

    dragRef.current = { dragIndex: index, dropIndex: index, rects, containerTop: containerRect.top, dragElement, handles, abortController: null, cursorStyle: null };
  }, []);

  const updateDrag = React.useCallback((clientY: number) => {
    const drag = dragRef.current;
    const indicator = indicatorRef.current;
    if (!drag || !indicator) return;

    const relativeY = clientY - drag.containerTop;

    let dropIndex = drag.rects.length;
    let indicatorTop = 0;

    for (let i = 0; i < drag.rects.length; i++) {
      if (relativeY < drag.rects[i].midY) {
        dropIndex = i;
        indicatorTop = drag.rects[i].top;
        break;
      }
    }

    if (dropIndex === drag.rects.length && drag.rects.length > 0) {
      indicatorTop = drag.rects[drag.rects.length - 1].bottom;
    }

    drag.dropIndex = dropIndex;

    const shouldShow =
      dropIndex !== drag.dragIndex && dropIndex !== drag.dragIndex + 1;

    if (shouldShow) {
      indicator.style.display = "block";
      indicator.style.top = `${indicatorTop}px`;
    } else {
      indicator.style.display = "none";
    }
  }, []);

  const endDrag = React.useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;

    drag?.abortController?.abort();
    drag?.cursorStyle?.remove();

    if (drag?.dragElement) {
      drag.dragElement.classList.remove("bg-blue-200", "dark:bg-blue-950/50");
    }
    drag?.handles.forEach((handle) => {
      handle.style.opacity = "";
      handle.style.visibility = "";
    });
    if (indicatorRef.current) {
      indicatorRef.current.style.display = "none";
    }

    if (
      drag &&
      drag.dropIndex !== drag.dragIndex &&
      drag.dropIndex !== drag.dragIndex + 1
    ) {
      const arr = [...valuesRef.current];
      const [removed] = arr.splice(drag.dragIndex, 1);
      const insertAt =
        drag.dropIndex > drag.dragIndex
          ? drag.dropIndex - 1
          : drag.dropIndex;
      arr.splice(insertAt, 0, removed);
      onReorderRef.current(arr);
    }
  }, []);

  const cancelDrag = React.useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;

    drag?.abortController?.abort();
    drag?.cursorStyle?.remove();

    if (drag?.dragElement) {
      drag.dragElement.classList.remove("bg-blue-200", "dark:bg-blue-950/50");
    }
    drag?.handles.forEach((handle) => {
      handle.style.opacity = "";
      handle.style.visibility = "";
    });
    if (indicatorRef.current) {
      indicatorRef.current.style.display = "none";
    }
  }, []);

  const setDragRefs = React.useCallback((ac: AbortController, style: HTMLStyleElement) => {
    if (dragRef.current) {
      dragRef.current.abortController = ac;
      dragRef.current.cursorStyle = style;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      const drag = dragRef.current;
      if (drag) {
        drag.abortController?.abort();
        drag.cursorStyle?.remove();
        dragRef.current = null;
      }
    };
  }, []);

  const ctx = React.useMemo<SortableContextValue>(
    () => ({ startDrag, updateDrag, endDrag, cancelDrag, setDragRefs, itemCount: values.length }),
    [startDrag, updateDrag, endDrag, cancelDrag, setDragRefs, values.length]
  );

  return (
    <SortableCtx.Provider value={ctx}>
      <div ref={containerRef} className={cn("pb-3 relative", className)}>
        {children}
        <div
          ref={indicatorRef}
          className="absolute left-0 right-0 h-0.5 bg-primary pointer-events-none z-20"
          style={{ display: "none", top: 0 }}
        />
      </div>
    </SortableCtx.Provider>
  );
}

interface SortableRowProps {
  index: number;
  children: React.ReactNode;
  hasTrailingAction?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SortableRow({
  index,
  children,
  hasTrailingAction = false,
  disabled = false,
  className,
}: SortableRowProps) {
  const ctx = React.useContext(SortableCtx);
  const canSort = !disabled && (ctx?.itemCount ?? 0) > 1;

  return (
    <div data-sortable-index={index} className="relative group">
      {canSort && (
        <div
          data-drag-handle
          className="absolute left-0 bottom-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab touch-none select-none"
          onPointerDown={(e) => {
            if (e.button !== 0 || !e.isPrimary) return;
            e.preventDefault();
            ctx?.startDrag(index);

            const cursorStyle = document.createElement("style");
            cursorStyle.textContent = "* { cursor: grabbing !important; user-select: none !important; }";
            document.head.appendChild(cursorStyle);

            const ac = new AbortController();
            ctx?.setDragRefs(ac, cursorStyle);

            const onMove = (ev: PointerEvent) => {
              ctx?.updateDrag(ev.clientY);
            };
            const onUp = () => {
              ctx?.endDrag();
            };
            const onCancel = () => {
              ctx?.cancelDrag();
            };

            document.addEventListener("pointermove", onMove, { signal: ac.signal });
            document.addEventListener("pointerup", onUp, { signal: ac.signal });
            document.addEventListener("pointercancel", onCancel, { signal: ac.signal });
          }}
        >
          <DragHandle16 />
        </div>
      )}
      <SectionRow hasTrailingAction={hasTrailingAction} className={className}>
        {children}
      </SectionRow>
    </div>
  );
}

SectionWrapper.displayName = "SectionWrapper";
SectionBody.displayName = "SectionBody";
SectionRow.displayName = "SectionRow";
SortableBody.displayName = "SortableBody";
SortableRow.displayName = "SortableRow";
