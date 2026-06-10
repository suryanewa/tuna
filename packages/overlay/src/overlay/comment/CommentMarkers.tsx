import { useEffect, useMemo, useRef, useState } from "react";
import type { Comment } from "../../engine/comment-store";
import { CommentTextPreview, getCommentTextParts, renderCommentTextParts } from "./CommentTextPreview";

export function IconComment({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 13.866 13.866 17 10 17H4C3.44772 17 3 16.5523 3 16V10Z" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function useCommentPosition(c: Comment): { x: number; y: number } {
  const [pos, setPos] = useState(c.position);

  useEffect(() => {
    function onScroll() {
      if (c.type === "element" && c.selector && c.anchorOffset) {
        try {
          const el = document.querySelector(c.selector);
          if (el) {
            const rect = el.getBoundingClientRect();
            setPos({ x: rect.left + c.anchorOffset.x, y: rect.top + c.anchorOffset.y });
            return;
          }
        } catch {}
      }
    }
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [c.selector, c.anchorOffset, c.type]);

  return pos;
}

export function CommentMarker({
  comment: c,
  index,
  isPopoverOpen,
  isAreaResize,
  onAreaResize,
  onAreaResizeLive,
  onOpen,
}: {
  comment: Comment;
  index: number;
  isPopoverOpen: boolean;
  isAreaResize?: boolean;
  onAreaResize?: (newPos: { x: number; y: number }) => void;
  onAreaResizeLive?: (newPos: { x: number; y: number }) => void;
  onOpen: () => void;
}) {
  const markerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLSpanElement>(null);
  const popoverOpenRef2 = useRef(isPopoverOpen);
  popoverOpenRef2.current = isPopoverOpen;
  const pos = useCommentPosition(c);
  const previewParts = useMemo(() => getCommentTextParts(c), [c]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const onEnter = () => {
      if (popoverOpenRef2.current) return;
      const preview = previewRef.current;
      if (!preview) return;

      const measurer = document.createElement("span");
      measurer.style.cssText = "position:absolute;visibility:hidden;font-size:12px;line-height:1.4;font-family:inherit;white-space:nowrap;";
      renderCommentTextParts(measurer, previewParts);
      marker.appendChild(measurer);
      const textW = measurer.offsetWidth;
      measurer.remove();
      const targetW = Math.min(textW + 24, 200);
      const targetH = preview.offsetHeight + 10;

      const markerLeft = parseFloat(marker.style.left) || 0;
      const maxLeft = window.innerWidth - targetW - 12;
      const clampedLeft = Math.min(markerLeft, maxLeft);
      const offsetX = markerLeft - clampedLeft + 4;

      marker.style.width = `${targetW}px`;
      marker.style.height = `${targetH}px`;
      marker.style.transform = `translate(-${offsetX}px, -${targetH}px)`;
      marker.classList.add("expanded");
    };

    const onLeave = () => {
      marker.style.width = "";
      marker.style.height = "";
      marker.style.transform = "";
      marker.classList.remove("expanded");
    };

    marker.addEventListener("mouseenter", onEnter);
    marker.addEventListener("mouseleave", onLeave);
    return () => {
      marker.removeEventListener("mouseenter", onEnter);
      marker.removeEventListener("mouseleave", onLeave);
    };
  }, [previewParts]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (isPopoverOpen) {
      marker.style.width = "";
      marker.style.height = "";
      marker.style.transform = "";
      marker.classList.remove("expanded");
    }
  }, [isPopoverOpen]);

  const dragRef = useRef<{ startX: number; startY: number; dragging: boolean } | null>(null);

  useEffect(() => {
    if (!isAreaResize || !onAreaResize) return;
    const marker = markerRef.current;
    if (!marker) return;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { startX: e.clientX, startY: e.clientY, dragging: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = Math.abs(e.clientX - dragRef.current.startX);
      const dy = Math.abs(e.clientY - dragRef.current.startY);
      if (dx > 3 || dy > 3) dragRef.current.dragging = true;
      if (dragRef.current.dragging) {
        marker.style.left = `${e.clientX}px`;
        marker.style.top = `${e.clientY}px`;
        onAreaResizeLive?.({ x: e.clientX, y: e.clientY });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const wasDragging = dragRef.current.dragging;
      dragRef.current = null;
      if (wasDragging) {
        onAreaResize({ x: e.clientX, y: e.clientY });
      } else {
        onOpen();
      }
    };

    marker.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    return () => {
      marker.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
    };
  }, [isAreaResize, onAreaResize, onAreaResizeLive, onOpen]);

  return (
    <div
      ref={markerRef}
      className={`retune-comment-marker interactive${isPopoverOpen ? " popover-open" : ""}${isAreaResize ? " area-resize" : ""}`}
      style={{ left: pos.x, top: pos.y, cursor: isAreaResize ? "nwse-resize" : undefined }}
      onPointerUp={isAreaResize ? undefined : (e) => { e.stopPropagation(); onOpen(); }}
    >
      <span className="retune-comment-marker-num">{index + 1}</span>
      <span ref={previewRef} className="retune-comment-marker-preview">
        <CommentTextPreview comment={c} />
      </span>
    </div>
  );
}

export function AreaOutline({
  comment: c,
  interactive,
  liveBR,
  onResize,
}: {
  comment: Comment;
  interactive: boolean;
  liveBR?: { x: number; y: number };
  onResize: (newArea: { x: number; y: number; width: number; height: number }) => void;
}) {
  const area = c.area!;
  const [dragging, setDragging] = useState<{
    handle: "tl" | "br";
    startX: number;
    startY: number;
    origArea: typeof area;
  } | null>(null);
  const [liveArea, setLiveArea] = useState(area);

  useEffect(() => {
    setLiveArea(area);
  }, [area.x, area.y, area.width, area.height]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      const orig = dragging.origArea;

      if (dragging.handle === "tl") {
        const newX = orig.x + dx;
        const newY = orig.y + dy;
        setLiveArea({
          x: newX,
          y: newY,
          width: Math.max(20, orig.width - dx),
          height: Math.max(20, orig.height - dy),
        });
      } else {
        setLiveArea({
          x: orig.x,
          y: orig.y,
          width: Math.max(20, orig.width + dx),
          height: Math.max(20, orig.height + dy),
        });
      }
    };

    const onUp = () => {
      setDragging(null);
      onResize(liveArea);
    };

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
    };
  }, [dragging, liveArea, onResize]);

  const handleSize = 12;
  const half = handleSize / 2;

  return (
    <>
      <div
        className="retune-comment-area-outline"
        style={liveBR ? {
          left: liveArea.x,
          top: liveArea.y,
          width: Math.max(20, liveBR.x - liveArea.x),
          height: Math.max(20, liveBR.y - liveArea.y),
        } : {
          left: liveArea.x,
          top: liveArea.y,
          width: liveArea.width,
          height: liveArea.height,
        }}
      />
      {interactive && (
        <>
          <div
            className="retune-area-handle"
            style={{ left: liveArea.x - half, top: liveArea.y - half }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging({ handle: "tl", startX: e.clientX, startY: e.clientY, origArea: { ...liveArea } });
            }}
          />
        </>
      )}
    </>
  );
}
