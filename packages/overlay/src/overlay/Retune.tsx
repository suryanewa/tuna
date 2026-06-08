"use client";

declare const __RETUNE_VERSION__: string;

/**
 * Retune — the main React component users add to their app.
 *
 * Usage:
 *   import { Retune } from "retune";
 *   // In your layout — only renders in development by default:
 *   <Retune />
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type { RetuneConfig, InspectedElement } from "../types";
import { mountOverlay, unmountOverlay } from "./mount";
import { createPicker } from "../selector/picker";
import { PreviewBridge } from "../ui/preview-bridge";
import { PreviewBridgeContext } from "../ui/preview-bridge-context";
import { LivePreviewEngine } from "../engine/live-preview";
import { ChangeTracker } from "../engine/change-tracker";
import { CommentStore, type Comment } from "../engine/comment-store";
import { formatChanges, collapseShorthands, type Fidelity } from "../engine/output";
import { BridgeClient } from "../bridge/ws-client";
import { formatToggleHotkeyShortcut, inspectElement, matchesToggleHotkey } from "../ui/helpers";
import { getSelector, getSelectorCandidates, getAncestorScopes, getSharedSelector, scoreNamePattern, isHashedClass, setReactProp, type SelectorCandidate, type AncestorScope } from "../selector/identifier";
import { detectChildrenType } from "../drag/detect";
import { getPseudoStateStyles, getStyleSources, getScopedStyles, type ForcedState, type StyleSource } from "../inspector/styles";
import { setManifestTokens } from "../variables";
import { PropertyPanel } from "./PropertyPanel";
import { ComponentSection, MANIFEST_PROMPT as MANIFEST_PROMPT_TEXT, MANIFEST_COMPONENTS_PROMPT } from "../ui/ComponentSection";
import { PanelBanner } from "../ui/PanelBanner";
import { ElementTree, type ReparentEntry } from "./ElementTree";
import { SettingsPanel } from "./SettingsPanel";
import { IconCursorClick } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCursorClick";
import { IconSquareBehindSquare6 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconSquareBehindSquare6";
import { IconStepBack } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconStepBack";
import { IconCrossMedium } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCrossMedium";
import { IconBroom } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconBroom";
import { IconCheckCircle2 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCheckCircle2";
import { IconSettingsGear2 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconSettingsGear2";
import { IconCursor1 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCursor1";
import { Tooltip } from "../ui/tooltip";
import { TooltipPortalContext } from "../ui/tooltip-portal-context";
import { BoxModelOverlay, type BoxModelProperty } from "../ui/box-model-overlay";

const DEFAULT_CONFIG: Required<RetuneConfig> = {
  port: 9223,
  hotkey: "alt+d",
  fidelity: "standard",
  position: "bottom-right",
  force: false,
};

// Singleton bridge stored on `window` so it survives both React StrictMode
// double-mounts AND Next.js HMR module re-evaluations. Without this, each
// HMR update creates a new BridgeClient while the old one's reconnect timer
// keeps firing, causing an infinite connect/disconnect fight on the server
// (which only accepts one client at a time).
const BRIDGE_KEY = "__retune_bridge" as const;
function getOrCreateBridge(port: number): BridgeClient {
  const existing = (window as any)[BRIDGE_KEY] as BridgeClient | undefined;
  if (existing) {
    return existing;
  }
  const bridge = new BridgeClient(port);
  (window as any)[BRIDGE_KEY] = bridge;
  return bridge;
}

const PANEL_ANIMATION_MS = 150;

function AnimatedPanel({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const [state, setState] = useState<"hidden" | "entering" | "visible" | "exiting">("hidden");
  const prevVisibleRef = useRef(false);
  const childrenRef = useRef<React.ReactNode>(children);

  // Keep a snapshot of children while visible so exit animation shows content
  if (visible) childrenRef.current = children;

  if (visible && !prevVisibleRef.current) {
    prevVisibleRef.current = true;
    setState("entering");
  } else if (!visible && prevVisibleRef.current) {
    prevVisibleRef.current = false;
    setState("exiting");
  }

  useEffect(() => {
    if (state === "entering") {
      const timer = setTimeout(() => setState("visible"), PANEL_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
    if (state === "exiting") {
      const timer = setTimeout(() => setState("hidden"), PANEL_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
  }, [state]);

  if (state === "hidden") return null;

  const animClass = state === "entering" ? "entering" : state === "exiting" ? "exiting" : "";
  return <div className={`retune-panel-anim ${animClass}`}>{childrenRef.current}</div>;
}

const MIN_VIEWPORT_WIDTH = 768;

/** A pre-computed scope level in the target rail. */
interface ScopeLevel {
  label: string;           // Display name: class name or "This instance"
  selector: string | null; // Compound CSS selector, null = element-specific path
  count: number;           // querySelectorAll match count
  kind?: "class" | "ancestor" | "element"; // default "class" for backward compat
}


/** Abbreviation lookup for common CSS class name stems */
const CLASS_ABBREVIATIONS: Record<string, string> = {
  btn: "Button", nav: "Navigation", col: "Column", img: "Image",
  sm: "Small", md: "Medium", lg: "Large", xs: "Extra Small", xl: "Extra Large",
  hdr: "Header", ftr: "Footer", cta: "Call to Action", desc: "Description",
  msg: "Message", info: "Information", bg: "Background", txt: "Text",
  pg: "Page", sec: "Section", el: "Element", opt: "Option",
  val: "Value", err: "Error", warn: "Warning", num: "Number",
  prev: "Previous", curr: "Current", temp: "Temporary",
};

/** Humanize a single class name segment: split on hyphens, title-case, expand abbreviations */
function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .map(word => CLASS_ABBREVIATIONS[word] || (word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/** Humanize a scope level label.
 *  BEM modifiers (--): strip block prefix, show modifier only.
 *  BEM elements (__): strip block prefix, show element only.
 *  Contextual: strip previous level's class prefix if it matches.
 *  Default: humanize full class name. */
function humanizeScopeLabel(className: string, previousClassName?: string): string {
  // BEM modifier: "message-row--unread" → "Unread"
  if (className.includes("--")) {
    const modifier = className.split("--").pop()!;
    return humanizeSegment(modifier);
  }
  // BEM element: "sidebar__item" → "Sidebar Item"
  if (className.includes("__")) {
    const element = className.split("__").pop()!;
    return humanizeSegment(element);
  }
  // Contextual prefix stripping: "btn-primary" after "btn" → "Primary"
  if (previousClassName && className.startsWith(previousClassName + "-")) {
    const suffix = className.slice(previousClassName.length + 1);
    return humanizeSegment(suffix);
  }
  // Default: humanize full name
  return humanizeSegment(className);
}

/** Strategy 1: Build a compound selector from ALL non-hashed classes on the element.
 *  If it matches > 1, these are "all instances" of this element type. */
function buildCompoundFingerprint(element: Element): ScopeLevel | null {
  const el = element as HTMLElement;
  if (!el.classList || el.classList.length === 0) return null;

  const classes: string[] = [];
  for (const cls of el.classList) {
    if (!isHashedClass(cls)) classes.push(cls);
  }
  if (classes.length === 0) return null;

  const selector = classes.sort().map(c => `.${CSS.escape(c)}`).join('');
  let count: number;
  try { count = document.querySelectorAll(selector).length; } catch { count = 0; }
  if (count <= 1) return null; // same as "This instance", skip

  return { label: `All instances`, selector, count };
}

/** Strategy 2: Walk up the DOM tree for a semantic ancestor and build
 *  a parent-scoped selector like ".parent tag" for classless elements. */
function buildParentScopeLevel(element: Element): ScopeLevel | null {
  const tag = element.tagName.toLowerCase();
  let current = element.parentElement;

  while (current && current !== document.body) {
    for (const cls of current.classList) {
      if (isHashedClass(cls)) continue;
      const { score } = scoreNamePattern(cls);
      if (score >= 0.65) continue; // skip utility classes

      const selector = `.${CSS.escape(cls)} ${tag}`;
      let count: number;
      try { count = document.querySelectorAll(selector).length; } catch { count = 0; }
      if (count > 1 && count <= 20) {
        return { label: "All instances", selector, count };
      }
    }
    current = current.parentElement;
  }

  return null;
}

/** Build scope levels from candidates (sorted broadest-first).
 *  Each level accumulates classes into a compound selector.
 *  Falls back to parent-scoped selectors when no semantic classes exist.
 *  Ancestor scopes are inserted between class scopes and "This instance". */
/** Extract class→{propName, value} from all manifest class_maps */
function getManifestClassInfo(manifest: Record<string, any> | null): Map<string, { propName: string; value: string; componentName: string }> {
  const map = new Map<string, { propName: string; value: string; componentName: string }>();
  if (!manifest?.components) return map;
  for (const [compName, comp] of Object.entries<any>(manifest.components)) {
    if (!comp?.props) continue;
    for (const [propName, propDef] of Object.entries<any>(comp.props)) {
      if (!propDef?.class_map) continue;
      for (const [value, className] of Object.entries<string>(propDef.class_map)) {
        map.set(className, { propName, value, componentName: compName });
      }
    }
  }
  return map;
}

function buildScopeLevels(candidates: SelectorCandidate[], element: Element, ancestorScopes: AncestorScope[] = [], manifest?: Record<string, any> | null): ScopeLevel[] {
  // Boost manifest class_map classes to semantic
  const manifestClasses = getManifestClassInfo(manifest ?? null);
  const meaningful = candidates.filter(c => c.verdict === "semantic" || manifestClasses.has(c.selector.replace(/^\./, '')));
  if (meaningful.length === 0) {
    // Strategy 1: compound class fingerprint (utility-class elements)
    const fingerprint = buildCompoundFingerprint(element);
    if (fingerprint) {
      const levels: ScopeLevel[] = [fingerprint];
      appendAncestorLevels(levels, ancestorScopes);
      levels.push({ label: "This instance", selector: null, count: 1, kind: "element" });
      return levels;
    }
    // Strategy 2: parent-scoped tag selector (classless elements)
    const parentLevel = buildParentScopeLevel(element);
    if (parentLevel) {
      const levels: ScopeLevel[] = [parentLevel];
      appendAncestorLevels(levels, ancestorScopes);
      levels.push({ label: "This instance", selector: null, count: 1, kind: "element" });
      return levels;
    }
    if (ancestorScopes.length > 0) {
      const levels: ScopeLevel[] = [];
      appendAncestorLevels(levels, ancestorScopes);
      levels.push({ label: "This instance", selector: null, count: 1, kind: "element" });
      return levels;
    }
    return [{ label: "This instance", selector: null, count: 1, kind: "element" }];
  }
  const levels: ScopeLevel[] = [];
  const parts: string[] = [];
  for (const candidate of meaningful) {
    const className = candidate.selector.replace(/^\./, '');
    const prevClassName = parts.length > 0 ? parts[parts.length - 1] : undefined;
    parts.push(className);
    const compound = parts.slice().sort().map(c => `.${CSS.escape(c)}`).join('');
    let count: number;
    try { count = document.querySelectorAll(compound).length; } catch { count = 0; }
    // Use manifest prop value for label when available (e.g., "tag-blue" → "Blue" from color prop)
    const manifestInfo = manifestClasses.get(className);
    const label = manifestInfo
      ? humanizeSegment(manifestInfo.value)
      : humanizeScopeLabel(className, prevClassName);
    levels.push({ label, selector: compound, count, kind: "class" });
  }
  appendAncestorLevels(levels, ancestorScopes);
  levels.push({ label: "This instance", selector: null, count: 1, kind: "element" });
  return levels;
}

/** Append ancestor scope levels, filtering out those that are redundant with existing levels */
function appendAncestorLevels(levels: ScopeLevel[], ancestorScopes: AncestorScope[]): void {
  // Get the narrowest class-level count for filtering
  const narrowestClassCount = levels.length > 0 ? levels[levels.length - 1].count : Infinity;

  for (const scope of ancestorScopes) {
    // Skip if same count as narrowest class scope (redundant)
    if (scope.count >= narrowestClassCount) continue;
    // Skip if count is 1 (same as "This instance")
    if (scope.count <= 1) continue;
    // Skip if a level with same count already exists
    if (levels.some(l => l.count === scope.count && l.selector === scope.fullSelector)) continue;

    levels.push({
      label: scope.label,
      selector: scope.fullSelector,
      count: scope.count,
      kind: "ancestor",
    });
  }
}

export function Retune(props: RetuneConfig = {}) {
  // Detect dev mode: Node process.env (Next.js, CRA) or import.meta.env (Vite, Astro)
  const isDev = (typeof process !== "undefined" && process.env?.NODE_ENV === "development")
    || (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV === true);
  if (!isDev && !props.force) return null;

  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= MIN_VIEWPORT_WIDTH : true
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MIN_VIEWPORT_WIDTH}px)`);
    const handler = (e: MediaQueryListEvent) => setWide(e.matches);
    setWide(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!wide) return null;

  return <RetuneInner {...props} />;
}

// ── Comment Icon (custom) ──

function IconComment({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 13.866 13.866 17 10 17H4C3.44772 17 3 16.5523 3 16V10Z" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

// ── Comment Marker (JS-driven hover expansion) ──

function useCommentPosition(c: Comment): { x: number; y: number } {
  // Position stored as viewport coords at click time.
  // On scroll, re-query element and use its current rect + anchorOffset.
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
    // Capture phase catches scroll on any element (nested containers)
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [c.selector, c.anchorOffset, c.type]);

  return pos;
}

function CommentMarker({ comment: c, index, isPopoverOpen, isAreaResize, onAreaResize, onAreaResizeLive, onOpen }: {
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

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const onEnter = () => {
      if (popoverOpenRef2.current) return;
      const preview = previewRef.current;
      if (!preview) return;

      const measurer = document.createElement("span");
      measurer.style.cssText = `position:absolute;visibility:hidden;font-size:12px;line-height:1.4;font-family:inherit;white-space:nowrap;`;
      measurer.textContent = c.text;
      marker.appendChild(measurer);
      const textW = measurer.offsetWidth;
      measurer.remove();
      const targetW = Math.min(textW + 24, 200);
      const targetH = preview.offsetHeight + 10;

      const markerLeft = parseFloat(marker.style.left) || 0;
      const maxLeft = window.innerWidth - targetW - 12;
      const clampedLeft = Math.min(markerLeft, maxLeft);
      const offsetX = markerLeft - clampedLeft + 4;

      marker.style.width = targetW + "px";
      marker.style.height = targetH + "px";
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
  }, [c.text]);

  // Collapse marker when popover opens
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

  // Area resize drag on the marker itself
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
        marker.style.left = e.clientX + "px";
        marker.style.top = e.clientY + "px";
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
  }, [isAreaResize, onAreaResize, onOpen]);

  return (
    <div
      ref={markerRef}
      className={`retune-comment-marker interactive${isPopoverOpen ? " popover-open" : ""}${isAreaResize ? " area-resize" : ""}`}
      style={{ left: pos.x, top: pos.y, cursor: isAreaResize ? "nwse-resize" : undefined }}
      onPointerUp={isAreaResize ? undefined : (e) => { e.stopPropagation(); onOpen(); }}
    >
      <span className="retune-comment-marker-num">{index + 1}</span>
      <span ref={previewRef} className="retune-comment-marker-preview">{c.text}</span>
    </div>
  );
}

// ── Area Outline with resize handles ──

function AreaOutline({ comment: c, interactive, liveBR, onResize }: {
  comment: Comment;
  interactive: boolean;
  liveBR?: { x: number; y: number };
  onResize: (newArea: { x: number; y: number; width: number; height: number }) => void;
}) {
  const area = c.area!;
  const [dragging, setDragging] = useState<{
    handle: "tl" | "br";
    startX: number; startY: number;
    origArea: typeof area;
  } | null>(null);
  const [liveArea, setLiveArea] = useState(area);

  useEffect(() => { setLiveArea(area); }, [area.x, area.y, area.width, area.height]);

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
          left: liveArea.x, top: liveArea.y, width: liveArea.width, height: liveArea.height,
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

// ── Retune Logo (with bloom hover animation from retune-site) ──

function RetuneLogo({ size = 20 }: { size?: number }) {
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const g = gRef.current;
    const btn = g?.closest(".retune-toolbar-collapse-btn");
    if (!g || !btn) return;

    const seq: string[][] = [
      ["sq1"], ["sq2"], ["sq3"], ["sq4"], ["sq5"], ["sq6"],
      ["sq7"], ["sq8"], ["sq9"], ["sq10"], ["sq11"], ["sq12"],
      ["sq13L", "sq13R"], ["sq14L", "sq14R"],
    ];

    const stagger = 45;
    const flash = 300;
    const pause = 200;
    const cycleTime = seq.length * stagger + flash + pause;
    let hovering = false;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const isP3 = window.matchMedia("(color-gamut: p3)").matches;

    function randomColor() {
      const h = Math.random() * 360;
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const l = isDark ? 0.7 + Math.random() * 0.15 : 0.6 + Math.random() * 0.1;
      const c = isP3 ? 0.3 + Math.random() * 0.1 : 0.2 + Math.random() * 0.08;
      return isP3 ? `oklch(${l} ${c} ${h})` : `hsl(${h}, 100%, ${isDark ? 50 + Math.random() * 25 : 50 + Math.random() * 15}%)`;
    }

    function clearAll() { timers.forEach(clearTimeout); timers = []; }

    function resetRects() {
      g!.querySelectorAll("rect").forEach((el) => {
        el.style.transition = "none";
        el.style.fill = "";
        el.removeAttribute("filter");
      });
    }

    function runCycle() {
      if (!hovering) return;
      const color = randomColor();
      seq.forEach((ids, i) => {
        timers.push(setTimeout(() => {
          if (!hovering) return;
          ids.forEach((id) => {
            const el = g!.querySelector(`#${id}`) as SVGRectElement | null;
            if (!el) return;
            el.style.transition = "none";
            el.style.fill = color;
            el.setAttribute("filter", "url(#retune-bloom)");
            el.getBoundingClientRect();
            el.style.transition = `fill ${flash}ms ease-out`;
            el.style.fill = "";
            timers.push(setTimeout(() => el.removeAttribute("filter"), 80));
          });
        }, i * stagger));
      });
      timers.push(setTimeout(runCycle, cycleTime));
    }

    function onEnter() { hovering = true; runCycle(); }
    function onLeave() { hovering = false; clearAll(); resetRects(); }

    btn.addEventListener("mouseenter", onEnter);
    btn.addEventListener("mouseleave", onLeave);
    return () => {
      btn.removeEventListener("mouseenter", onEnter);
      btn.removeEventListener("mouseleave", onLeave);
      clearAll();
    };
  }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <defs>
        <filter id="retune-bloom" x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="wideBlur"/>
          <feColorMatrix in="wideBlur" type="matrix" result="wideGlow"
            values="1.8 0 0 0 0  0 1.8 0 0 0  0 0 1.8 0 0  0 0 0 0.6 0"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="tightBlur"/>
          <feColorMatrix in="tightBlur" type="matrix" result="tightGlow"
            values="2 0 0 0 0.1  0 2 0 0 0.1  0 0 2 0 0.1  0 0 0 0.9 0"/>
          <feColorMatrix in="SourceGraphic" type="matrix" result="hotCore"
            values="1 0 0 0 0.4  0 1 0 0 0.4  0 0 1 0 0.4  0 0 0 1 0"/>
          <feMerge>
            <feMergeNode in="wideGlow"/>
            <feMergeNode in="tightGlow"/>
            <feMergeNode in="hotCore"/>
          </feMerge>
        </filter>
      </defs>
      <g ref={gRef}>
        <rect id="sq1" x="3" y="15" width="2" height="2" fill="currentColor"/>
        <rect id="sq2" x="3" y="13" width="2" height="2" fill="currentColor"/>
        <rect id="sq3" x="3" y="11" width="2" height="2" fill="currentColor"/>
        <rect id="sq4" x="3" y="9" width="2" height="2" fill="currentColor"/>
        <rect id="sq5" x="3" y="7" width="2" height="2" fill="currentColor"/>
        <rect id="sq6" x="3" y="5" width="2" height="2" fill="currentColor"/>
        <rect id="sq7" x="5" y="3" width="2" height="2" fill="currentColor"/>
        <rect id="sq8" x="7" y="3" width="2" height="2" fill="currentColor"/>
        <rect id="sq9" x="9" y="3" width="2" height="2" fill="currentColor"/>
        <rect id="sq10" x="11" y="5" width="2" height="2" fill="currentColor"/>
        <rect id="sq11" x="11" y="7" width="2" height="2" fill="currentColor"/>
        <rect id="sq12" x="11" y="15" width="2" height="2" fill="currentColor"/>
        <rect id="sq13L" x="9" y="13" width="2" height="2" fill="currentColor"/>
        <rect id="sq13R" x="13" y="13" width="2" height="2" fill="currentColor"/>
        <rect id="sq14L" x="7" y="11" width="2" height="2" fill="currentColor"/>
        <rect id="sq14R" x="15" y="11" width="2" height="2" fill="currentColor"/>
      </g>
    </svg>
  );
}

// ── Comment Popover ──

function CommentPopover({
  position,
  initialText,
  onSubmit,
  onCancel,
  onDelete,
  onTextChange,
}: {
  position: { x: number; y: number };
  initialText: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onTextChange?: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = !!onDelete;

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  const popoverElRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      autoResize();
      // Kill entrance animation after it completes so it doesn't replay on class changes
      if (popoverElRef.current) popoverElRef.current.style.animation = "none";
    }, 200);
  }, [autoResize]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  // Position: offset from marker, clamped to viewport
  const popoverWidth = 280;
  const popoverHeight = 140; // approximate
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = position.x + 16;
  let top = position.y - 8;

  // Flip left if overflowing right edge
  if (left + popoverWidth > vw - 12) {
    left = position.x - popoverWidth - 16;
  }
  // Clamp left
  if (left < 12) left = 12;

  // Flip up if overflowing bottom edge
  if (top + popoverHeight > vh - 12) {
    top = position.y - popoverHeight - 8;
  }
  // Clamp top
  if (top < 12) top = 12;

  const style: React.CSSProperties = {
    position: "fixed",
    left,
    top,
    zIndex: 2147483647,
  };

  return (
    <div
      ref={popoverElRef}
      className="retune-comment-popover"
      style={style}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onClickCapture={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={inputRef}
        className="retune-comment-textarea"
        value={text}
        onChange={(e) => { setText(e.target.value); onTextChange?.(e.target.value); autoResize(); }}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment..."
        rows={3}
      />
      <div className="retune-comment-actions">
        {isEdit && (
          <button className="retune-comment-delete-btn" onPointerUp={onDelete}>
            Delete
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="retune-comment-cancel-btn" onPointerUp={onCancel}>
          Cancel
        </button>
        <button
          className="retune-comment-submit-btn"
          onPointerUp={handleSubmit}
          disabled={!text.trim()}
        >
          {isEdit ? "Save" : "Comment"}
        </button>
      </div>
    </div>
  );
}

function RetuneInner(props: RetuneConfig) {
  const config = { ...DEFAULT_CONFIG, ...props };

  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<"edit" | "comment">("edit");
  const [selectedElement, setSelectedElement] = useState<InspectedElement | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [fidelity, setFidelityState] = useState<Fidelity>(() => {
    try {
      const saved = localStorage.getItem("retune-fidelity");
      if (saved === "minimal" || saved === "standard" || saved === "full") return saved;
    } catch {}
    return config.fidelity;
  });
  const setFidelity = useCallback((f: Fidelity) => {
    setFidelityState(f);
    try { localStorage.setItem("retune-fidelity", f); } catch {}
  }, []);
  const fidelityRef = useRef(fidelity);
  fidelityRef.current = fidelity;
  const [copied, setCopied] = useState(false);
  const [hoveredBoxModel, setHoveredBoxModel] = useState<BoxModelProperty>(null);
  const [changeRevision, setChangeRevision] = useState(0);
  const [resetRevision, setResetRevision] = useState(0);
  // Properties owned by CSS rules matching the active scope selector (undefined = show all)
  const [ownedProperties, setOwnedProperties] = useState<Set<string> | undefined>(undefined);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ current: string; latest: string } | null>(null);
  const manifestLoadedRef = useRef(false);
  const manifestCheckedRef = useRef(false);
  const manifestDataRef = useRef<Record<string, any> | null>(null);
  const [manifest, setManifest] = useState<Record<string, any> | null>(null);
  const [manifestBannerDismissed, setManifestBannerDismissed] = useState(false);

  // Sync ref → state on every render (handles StrictMode where setManifest may target stale instance)
  if (manifestDataRef.current && !manifest) {
    setManifest(manifestDataRef.current);
  }

  const tryLoadManifest = useCallback(async () => {
    if (manifestLoadedRef.current) return;
    manifestLoadedRef.current = true; // Prevent concurrent fetches
    try {
      const res = await fetch("/retune.manifest.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.components || data.tokens)) {
          manifestDataRef.current = data;
          setManifest(data);
          if (data.tokens) setManifestTokens(data);
        } else {
          manifestLoadedRef.current = false; // Allow retry
        }
      } else {
        manifestLoadedRef.current = false;
      }
    } catch {
      manifestLoadedRef.current = false;
    }
    manifestCheckedRef.current = true;
  }, []);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panelTab, setPanelTab] = useState<"elements" | "design">("design");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsExiting, setSettingsExiting] = useState(false);
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("retune-theme");
      if (saved === "system" || saved === "light" || saved === "dark") return saved;
    } catch {}
    return "system";
  });
  const handleThemeChange = useCallback((t: "system" | "light" | "dark") => {
    setTheme(t);
    try { localStorage.setItem("retune-theme", t); } catch {}
  }, []);

  // Toggle dark class on host element based on theme
  useEffect(() => {
    if (!portalTarget) return;
    const root = portalTarget.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : null;
    if (!host) return;
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    host.classList.toggle("dark", isDark);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => host.classList.toggle("dark", e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme, portalTarget]);
  const [side, setSide] = useState<"right" | "left">(() => {
    try {
      const saved = localStorage.getItem("retune-panel-side");
      if (saved === "left" || saved === "right") return saved;
    } catch {}
    return config.position.includes("right") ? "right" : "left";
  });
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabPillRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; dragging: boolean; lastX: number; lastT: number; velocity: number } | null>(null);
  const [toolbarDragging, setToolbarDragging] = useState(false);
  const [sessionHidden, setSessionHidden] = useState(false);
  const [reparentEntries, setReparentEntries] = useState<ReparentEntry[]>([]);

  // Reparent DOM state for undo/reset and MutationObserver safety
  type ReparentDOMEntry = {
    element: Element;
    oldParent: Element;
    oldNextSibling: Element | null; // for restoring exact position on undo
    newParent: Element;
    observer: MutationObserver;
  };
  const reparentDOMRef = useRef<ReparentDOMEntry[]>([]);
  const reparentBatchSizeRef = useRef<number[]>([]); // tracks how many DOM entries per reparent operation

  const tabPillFirstRender = useRef(true);

  // Selector candidates for the selected element (class-based selectors with match counts)
  const [selectorCandidates, setSelectorCandidates] = useState<SelectorCandidate[]>([]);
  // Scope rail: pre-computed levels from broadest to "This instance"
  const [scopeLevels, setScopeLevels] = useState<ScopeLevel[]>([]);
  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const activeLevelIndexRef = useRef(0);
  activeLevelIndexRef.current = activeLevelIndex;
  const scopeLevelsRef = useRef<ScopeLevel[]>([]);
  scopeLevelsRef.current = scopeLevels;
  // Derived activeSelector — all existing code reading this still works unchanged
  const activeSelector = scopeLevels[activeLevelIndex]?.selector ?? null;
  const activeSelectorRef = useRef<string | null>(null);
  activeSelectorRef.current = activeSelector;

  // Style sources: which CSS selector sets each property
  const [styleSources, setStyleSources] = useState<Record<string, StyleSource>>({});

  // Forced pseudo-state (:hover, :focus, :active)
  const [forcedState, setForcedState] = useState<ForcedState>(null);
  const forcedStateRef = useRef<ForcedState>(null);
  forcedStateRef.current = forcedState;

  const mountRef = useRef<ReturnType<typeof mountOverlay> | null>(null);
  const pickerRef = useRef<ReturnType<typeof createPicker> | null>(null);
  const previewRef = useRef<LivePreviewEngine | null>(null);
  const trackerRef = useRef<ChangeTracker | null>(null);
  const commentStoreRef = useRef(new CommentStore());
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [areaResizeLive, setAreaResizeLive] = useState<{ id: number; br: { x: number; y: number } } | null>(null);
  const [commentDraft, setCommentDraft] = useState<{
    position: { x: number; y: number };
    type: "element" | "area";
    selector?: string;
    anchorOffset?: { x: number; y: number };
    area?: { x: number; y: number; width: number; height: number };
    areaScroll?: { x: number; y: number };
    elementInfo?: Comment["elementInfo"];
  } | null>(null);
  const previewBridgeRef = useRef(new PreviewBridge());
  const bridgeRef = useRef<BridgeClient | null>(null);
  const selectedElementRef = useRef<InspectedElement | null>(null);
  selectedElementRef.current = selectedElement;
  const syncTrackerStateRef = useRef<() => void>(() => {});
  const refreshSelectedElementRef = useRef<() => void>(() => {});

  // Initialize on mount
  useEffect(() => {
    const mount = mountOverlay();
    mountRef.current = mount;
    setPortalTarget(mount.container);

    const preview = new LivePreviewEngine();
    previewRef.current = preview;

    const tracker = new ChangeTracker();
    trackerRef.current = tracker;

    const bridge = getOrCreateBridge(config.port);
    bridgeRef.current = bridge;

    bridge.onRequest(async (method, params) => {
      // Use refs (not closure variables) so the handler always operates on the
      // current tracker/preview — even if the setup effect re-runs due to HMR.
      const t = trackerRef.current!;
      const p = previewRef.current!;
      switch (method) {
        case "getSelection": {
          const sel = selectedElementRef.current;
          if (!sel) return null;
          // Strip non-serializable fields (DOM element, DOMRect, React props with circular refs)
          const { element, rect, reactProps, ...serializable } = sel;
          return {
            ...serializable,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          };
        }
        case "getPendingChanges":
          return t.getPendingChanges();
        case "getCollapsedChanges":
          return t.getPendingChanges().map((c) => ({
            ...c,
            changes: collapseShorthands(c.changes),
          }));
        case "getEnrichedChanges": {
          const { scanDesignTokens } = await import("../inspector/tokens");
          const { enrichPropertyChanges } = await import("../engine/candidates");
          const tokenMap = scanDesignTokens();
          return t.getPendingChanges().map((c) => ({
            ...c,
            changes: enrichPropertyChanges(collapseShorthands(c.changes), tokenMap, c.selector),
          }));
        }
        case "getFormattedChanges":
          return formatChanges(t.getPendingChanges(), params?.fidelity || fidelityRef.current, commentStoreRef.current.getAll(), manifestDataRef.current);
        case "getComments":
          return commentStoreRef.current.getAll();
        case "clearComments":
          commentStoreRef.current.clear();
          setComments([]);
          setCommentCount(0);
          return;
        case "reloadManifest": {
          // Agent wrote the manifest — re-fetch and load it
          manifestLoadedRef.current = false;
          await tryLoadManifest();
          return { loaded: !!manifestDataRef.current };
        }
        case "clearChanges": {
          // MCP clear = agent already applied changes to source.
          // Don't restore DOM mutations — just clear the stacks and tracking data.
          deleteStackRef.current = [];
          deleteRedoStackRef.current = [];
          textStackRef.current = [];
          textRedoStackRef.current = [];
          // Remove CSS order/translate values — React will reconcile to new source order
          reorderStackRef.current = [];
          reorderRedoStackRef.current = [];
          reorderOriginRef.current = new WeakMap();
          for (const [, originals] of reorderOriginalOrderRef.current) {
            for (const [child, originalOrder] of originals) {
              const el = child as HTMLElement;
              if (originalOrder) {
                el.style.order = originalOrder;
              } else {
                el.style.removeProperty("order");
              }
            }
          }
          reorderOriginalOrderRef.current.clear();
          for (const [, rects] of reorderOriginalRectsRef.current) {
            for (const [child] of rects) {
              const el = child as HTMLElement;
              el.style.removeProperty("translate");
              el.style.removeProperty("transition");
              if (el.getAttribute("style")?.trim() === "") el.removeAttribute("style");
            }
          }
          reorderOriginalRectsRef.current.clear();
          reorderModeRef.current = new WeakMap();
          // Clean up forced pseudo-state inline styles
          if (forcedStateRef.current) {
            const f = forcedStylesRef.current;
            const domEl = selectedElementRef.current?.element as HTMLElement | undefined;
            if (domEl?.style && f.props.length > 0) {
              for (const p of f.props) {
                const k = p.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
                domEl.style.removeProperty(k);
              }
              if (domEl.getAttribute('style')?.trim() === '') {
                domEl.removeAttribute('style');
              }
            }
            forcedStylesRef.current = { selector: "", props: [] };
            setForcedState(null);
            forcedStateRef.current = null;
          }
          p.clearAll();
          t.clear();
          // Clear comments
          commentStoreRef.current.clear();
          setComments([]);
          setCommentCount(0);
          // Deselect — DOM nodes may have been restructured by React reconciliation
          // after the source code change, making the old selection reference unreliable
          setSelectedElement(null);
          selectedElementRef.current = null;
          pickerRef.current?.clearSelection();
          syncTrackerStateRef.current();
          setChangeRevision((r) => r + 1);
          return { ok: true };
        }
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    });

    bridge.onUpdate((info) => setUpdateInfo(info));
    bridge.connect();

    // Restore persisted changes from previous session
    if (tracker.restore()) {
      preview.attach();
      const pendingReparentEntries: ReparentEntry[] = [];
      for (const change of tracker.getPendingChanges()) {
        for (const c of change.changes) {
          if (c.property === "__delete") {
            // Re-apply deletion: find element by selector, remove it
            try {
              const el = document.querySelector(change.selector);
              if (el) {
                const parent = el.parentNode;
                if (parent) {
                  deleteStackRef.current.push({ element: el, parent, nextSibling: el.nextSibling });
                  el.remove();
                }
              }
            } catch {}
          } else if (c.property === "__reorder") {
            // Re-apply reorder using the same logic as handleTreeReorder
            try {
              const el = document.querySelector(change.selector) as HTMLElement;
              if (el?.parentElement) {
                const parent = el.parentElement;
                const children = Array.from(parent.children) as HTMLElement[];
                const domIndex = children.indexOf(el);
                const targetIndex = parseInt(c.to);
                if (!isNaN(targetIndex) && domIndex !== targetIndex) {
                  const parentDisplay = getComputedStyle(parent).display;
                  const isFlex = parentDisplay === "flex" || parentDisplay === "inline-flex";
                  const isGrid = parentDisplay === "grid" || parentDisplay === "inline-grid";
                  const mode = (isFlex || isGrid) ? "order" as const : "translate" as const;

                  if (!reorderModeRef.current.has(parent)) {
                    reorderModeRef.current.set(parent, mode);
                  }

                  if (mode === "order") {
                    ensureExplicitOrder(parent);
                    const visualOrder = getVisualOrder(parent);
                    const fromIdx = visualOrder.indexOf(el);
                    if (fromIdx !== -1) {
                      const [moved] = visualOrder.splice(fromIdx, 1);
                      // targetIndex is the FINAL visual position (not pre-removal), so no -1 adjustment
                      visualOrder.splice(Math.min(targetIndex, visualOrder.length), 0, moved);
                      const undoEntry: ReorderUndoEntry = children.map(ch => ({
                        element: ch, prevOrder: ch.style.order, prevTranslate: "",
                      }));
                      for (let i = 0; i < visualOrder.length; i++) {
                        visualOrder[i].style.order = String(i);
                      }
                      reorderStackRef.current.push(undoEntry);
                    }
                  } else {
                    ensureOriginalRects(parent);
                    if (!reorderVisualOrderRef.current.has(parent)) {
                      reorderVisualOrderRef.current.set(parent, [...children]);
                    }
                    const desired = reorderVisualOrderRef.current.get(parent)!;
                    const fromIdx = desired.indexOf(el);
                    if (fromIdx !== -1) {
                      const undoEntry: ReorderUndoEntry = children.map(ch => ({
                        element: ch, prevOrder: "", prevTranslate: (ch as HTMLElement).style.translate || "",
                      }));
                      const [moved] = desired.splice(fromIdx, 1);
                      // targetIndex is the FINAL visual position (not pre-removal), so no -1 adjustment
                      desired.splice(Math.min(targetIndex, desired.length), 0, moved);
                      applyTranslateOrder(parent);
                      reorderStackRef.current.push(undoEntry);
                    }
                  }
                }
              }
            } catch {}
          } else if (c.property === "__text") {
            // Re-apply text edit: find element by selector, set text content
            try {
              const el = document.querySelector(change.selector) as HTMLElement;
              if (el) {
                const originalHTML = el.innerHTML;
                // Only safe to set textContent if element has no child elements
                // (otherwise it would destroy the children)
                const hasChildElements = el.querySelector("*") !== null;
                if (!hasChildElements) {
                  // Convert \n back to <br> for line breaks
                  el.innerHTML = c.to.replace(/\n/g, "<br>");
                  textStackRef.current.push({ element: el, originalHTML, newHTML: el.innerHTML });
                }
              }
            } catch {}
          } else if (c.property === "__reparent") {
            // Re-apply reparent: move element to new parent
            try {
              const el = document.querySelector(change.selector);
              if (!el) continue;
              const toAtIdx = c.to.lastIndexOf("@");
              if (toAtIdx === -1) continue;
              const newParentSelector = c.to.slice(0, toAtIdx);
              const insertIndex = parseInt(c.to.slice(toAtIdx + 1), 10);
              const newParent = document.querySelector(newParentSelector);
              if (!newParent || el.parentElement === newParent) continue;

              const oldParent = el.parentElement;
              if (!oldParent) continue;
              const oldNextSibling = el.nextElementSibling;

              // Perform DOM move
              const newChildren = Array.from(newParent.children);
              const refChild = insertIndex < newChildren.length ? newChildren[insertIndex] : null;
              if (refChild) {
                newParent.insertBefore(el, refChild);
              } else {
                newParent.appendChild(el);
              }

              // Set up MutationObserver safety net (same as handleTreeReparent)
              const movedEl = el;
              const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                  if (m.type !== "childList") continue;
                  if (m.target === oldParent) {
                    for (const added of m.addedNodes) {
                      if (!(added instanceof Element)) continue;
                      if (added !== movedEl && added.tagName === movedEl.tagName &&
                          added.className === movedEl.className && added.textContent === movedEl.textContent) {
                        try { oldParent.removeChild(added); } catch {}
                      }
                    }
                  }
                  if (m.target === newParent) {
                    for (const removed of m.removedNodes) {
                      if (removed === movedEl && !movedEl.parentElement) {
                        try {
                          const cur = Array.from(newParent.children);
                          const ref = insertIndex < cur.length ? cur[insertIndex] : null;
                          if (ref) { newParent.insertBefore(movedEl, ref); } else { newParent.appendChild(movedEl); }
                        } catch {}
                      }
                    }
                  }
                }
              });
              observer.observe(oldParent, { childList: true });
              observer.observe(newParent, { childList: true });

              reparentDOMRef.current.push({ element: el, oldParent, oldNextSibling, newParent, observer });
              // Defer reparent entry state update to after this loop
              pendingReparentEntries.push({ element: el, newParent, insertIndex });
            } catch {}
          } else {
            preview.applyChange(change.selector, c.property, c.to);
          }
        }
      }
      if (pendingReparentEntries.length > 0) {
        setReparentEntries(pendingReparentEntries);
      }
      const restored = tracker.getPendingChanges();
      setChangeCount(restored.filter(c => !c.changes.some(p => p.property === "__bulkOf")).length);
      setCanUndo(tracker.canUndo);
      setCanRedo(tracker.canRedo);
    }

    // Restore persisted comments
    const cStore = commentStoreRef.current;
    if (cStore.restore()) {
      setComments(cStore.getAll());
      setCommentCount(cStore.count);
    }

    const picker = createPicker(mount.root, {
      onHover: () => {},
      shouldBlockClick: () => shouldBlockForPopoverRef.current(),
      onSelect: (element) => {
        // In comment mode, create a comment instead of selecting for editing
        if (modeRef.current === "comment") {
          // Skip if area drag just ended or popover is already open
          if (areaDragJustEndedRef.current || popoverOpenRef.current) return;
          const cursor = lastClickRef.current;
          const selector = getQuickSelector(element);
          const componentName = getQuickComponentName(element);
          // Build a selector path for context (up to 3 ancestors)
          const selectorPath: string[] = [selector];
          let ancestor = element.parentElement;
          for (let i = 0; i < 3 && ancestor && ancestor !== document.body; i++) {
            selectorPath.unshift(getQuickSelector(ancestor));
            ancestor = ancestor.parentElement;
          }
          const fullSelector = selectorPath.join(" > ");
          const rect = element.getBoundingClientRect();
          const draft = {
            position: { x: cursor.x, y: cursor.y },
            type: "element" as const,
            selector: fullSelector,
            anchorOffset: { x: cursor.x - rect.left, y: cursor.y - rect.top },
            elementInfo: {
              tagName: element.tagName.toLowerCase(),
              componentName,
              componentPath: [],
              classes: Array.from(element.classList),
              textContent: (element.textContent || "").slice(0, 80).trim() || null,
            },
          };
          popoverOpenRef.current = true; popoverTextRef.current = ""; popoverInitialTextRef.current = "";
          setCommentDraft(draft);
          // Hide selection UI (handles, badge) — we only need hover in comment mode
          pickerRef.current?.clearSelection();
          return;
        }
        const inspected = inspectElement(element);
        // Clear forced pseudo-state when selecting a new element
        if (forcedStateRef.current) {
          clearForcedInlineStyles();
        }
        // Compute style sources and selector candidates
        setStyleSources(getStyleSources(element));
        const candidates = getSelectorCandidates(element);
        setSelectorCandidates(candidates);
        // Build scope levels with ancestor scopes and default to the narrowest class level
        const ancestors = getAncestorScopes(element);
        const levels = buildScopeLevels(candidates, element, ancestors, manifestDataRef.current);
        setScopeLevels(levels);
        scopeLevelsRef.current = levels;
        const defaultIndex = levels.length >= 2 ? levels.length - 2 : 0;
        setActiveLevelIndex(defaultIndex);
        activeLevelIndexRef.current = defaultIndex;
        const newActiveSelector = levels[defaultIndex]?.selector ?? null;
        activeSelectorRef.current = newActiveSelector;

        // Show scope highlights for the default level on initial selection
        const defaultLevel = levels[defaultIndex];
        if (defaultLevel?.selector && pickerRef.current) {
          pickerRef.current.showScopeHighlights(defaultLevel.selector, element);
        }

        // Apply scoped styles if a class selector is the default (skip for parent-scoped selectors)
        const isParentScoped = newActiveSelector && newActiveSelector.includes(' ');
        if (newActiveSelector && !isParentScoped) {
          const scoped = getScopedStyles(element, newActiveSelector);
          inspected.computedStyles = scoped.styles;
          setOwnedProperties(scoped.ownedProperties);
        } else {
          setOwnedProperties(undefined);
        }

        // Overlay preview changes so re-selecting a previously edited element
        // shows the current (edited) values, not the original stylesheet values.
        // Skip pseudo-state changes — we're in default view on element selection.
        if (preview) {
          for (const change of preview.getChanges()) {
            if (/:(hover|focus|active)$/.test(change.selector)) continue;
            const baseSel = change.selector;
            try {
              if (element.matches(baseSel)) {
                inspected.computedStyles[change.property] = change.value;
              }
            } catch { /* invalid selector */ }
          }
        }

        setSelectedElement(inspected);
        if (!manifestLoadedRef.current && inspected.reactProps) tryLoadManifest();
        setSettingsOpen(false);
        setSettingsVisible(false);
        setSettingsExiting(false);
        // Eagerly update the ref so the MCP bridge handler sees the value
        // immediately, without waiting for React to re-render.
        selectedElementRef.current = inspected;
        tracker.track(
          inspected.selector,
          inspected.tagName,
          inspected.textContent,
          inspected.classes,
          inspected.reactComponents,
          inspected.computedStyles,
          inspected.sourceFile,
          inspected.stylingApproach,
          inspected.inlineStyles,
          inspected.elementId,
          inspected.accessibleName,
          inspected.parentContext,
          inspected.childSummary,
          inspected.domPath,
          inspected.nearbySiblings,
          inspected.position,
          inspected.reactProps,
        );

        // Track all scope level selectors so migration works correctly
        for (const level of levels) {
          if (level.selector) {
            tracker.track(
              level.selector,
              inspected.tagName,
              inspected.textContent,
              inspected.classes,
              inspected.reactComponents,
              inspected.computedStyles,
              inspected.sourceFile,
              inspected.stylingApproach,
              inspected.inlineStyles,
              inspected.elementId,
              inspected.accessibleName,
              inspected.parentContext,
              inspected.childSummary,
              inspected.domPath,
              inspected.nearbySiblings,
              inspected.position,
            );
          }
        }
      },
      onDoubleClick: (element: Element) => {
        // Enter inline text editing mode
        const el = element as HTMLElement;
        if (!el.textContent?.trim()) return; // no text to edit
        // Skip elements that are Retune's own UI
        if (el.closest("[data-retune-host]") || el.hasAttribute("data-retune-host")) return;

        // Suspend picker so hover highlights don't show during editing
        pickerRef.current?.suspend();

        // Store original text for undo
        const originalText = el.textContent;
        const originalHTML = el.innerHTML;

        // Make editable
        el.contentEditable = "true";
        el.style.outline = "none";
        el.style.cursor = "text";
        el.focus();

        // Place cursor at click position (don't select all — let user click to place cursor)
        // The double-click will naturally select a word, which is the expected behavior

        const cleanup = () => {
          el.contentEditable = "false";
          el.style.removeProperty("outline");
          el.style.removeProperty("cursor");
          el.removeEventListener("keydown", onKeyDown);
          el.removeEventListener("blur", onBlur);
          // Resume picker and restore selection highlight
          pickerRef.current?.resume();
          pickerRef.current?.refreshSelection();
        };

        const save = () => {
          // Remove edit-mode styles BEFORE reading text (so they don't leak into tracker)
          el.style.removeProperty("outline");
          el.style.removeProperty("cursor");
          if (el.getAttribute("style")?.trim() === "") el.removeAttribute("style");

          // Convert innerHTML to text preserving line breaks
          // contentEditable inserts <br>, <div>, or <p> for line breaks depending on browser
          const newText = el.innerHTML
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/div><div>/gi, "\n")
            .replace(/<\/p><p>/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim();

          if (newText !== originalText) {
            const editSelector = getSelector(el);
            const tracker = trackerRef.current;
            if (tracker) {
              const inspected = selectedElementRef.current;
              tracker.track(
                editSelector, el.tagName.toLowerCase(), originalText, Array.from(el.classList),
                inspected?.reactComponents ?? [], { "__text": originalText || "" }, inspected?.sourceFile ?? null,
                inspected?.stylingApproach ?? undefined, null, el.id || null,
                null, null, null,
                inspected?.domPath ?? "", null, { x: 0, y: 0, width: 0, height: 0 },
              );
              tracker.ensureOriginalValue(editSelector, "__text", originalText || "");
              tracker.breakCoalescing();
              tracker.recordChange(editSelector, "__text", newText);
              tracker.persist();
            }
            // Store for undo (use innerHTML for faithful restore)
            textStackRef.current.push({ element: el, originalHTML, newHTML: el.innerHTML });
            textRedoStackRef.current = [];
            syncTrackerStateRef.current();
            setChangeRevision((r) => r + 1);
          }
          cleanup();
        };

        const cancel = () => {
          el.innerHTML = originalHTML;
          cleanup();
        };

        const onKeyDown = (e: KeyboardEvent) => {
          e.stopPropagation(); // Prevent Retune hotkeys from firing during edit
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Enter") {
            // Insert <br> instead of letting browser create <div> wrappers
            e.preventDefault();
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();
              const br = document.createElement("br");
              range.insertNode(br);
              // Move cursor after the <br>
              range.setStartAfter(br);
              range.setEndAfter(br);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        };

        const onBlur = () => {
          // Delay to allow click-outside to register
          setTimeout(save, 100);
        };

        el.addEventListener("keydown", onKeyDown);
        el.addEventListener("blur", onBlur);
      },
      onResizePreview: (element: Element, property: "width" | "height", value: string) => {
        const preview = previewRef.current;
        if (!preview) return;
        const selector = activeSelectorRef.current ?? getSelector(element);
        preview.applyChange(selector, property, value);
        // Push to PreviewBridge for real-time panel input updates
        const bridge = previewBridgeRef.current;
        if (!bridge.active) bridge.start();
        bridge.set(property, value);
      },
      onResize: (element: Element, property: "width" | "height", value: string) => {
        const tracker = trackerRef.current;
        const preview = previewRef.current;
        if (!tracker || !preview) return;
        const selector = activeSelectorRef.current ?? getSelector(element);
        const inspected = selectedElementRef.current;
        if (inspected) {
          tracker.track(
            selector, inspected.tagName, inspected.textContent, inspected.classes,
            inspected.reactComponents, inspected.computedStyles, inspected.sourceFile,
            inspected.stylingApproach, inspected.inlineStyles, inspected.elementId,
            inspected.accessibleName, inspected.parentContext, inspected.childSummary,
            inspected.domPath, inspected.nearbySiblings, inspected.position, inspected.reactProps,
          );
        }
        tracker.recordChange(selector, property, value);
        preview.applyChange(selector, property, value);
        previewBridgeRef.current.end();
        syncTrackerStateRef.current();
        refreshSelectedElementRef.current();
        setChangeRevision((r) => r + 1);
      },
      onRepositionPreview: (element: Element, property: "top" | "left" | "right" | "bottom", value: string) => {
        const preview = previewRef.current;
        if (!preview) return;
        const selector = activeSelectorRef.current ?? getSelector(element);
        preview.applyChange(selector, property, value);
        const bridge = previewBridgeRef.current;
        if (!bridge.active) bridge.start();
        bridge.set(property, value);
      },
      onReposition: (element: Element, property: "top" | "left" | "right" | "bottom", value: string) => {
        const tracker = trackerRef.current;
        const preview = previewRef.current;
        if (!tracker || !preview) return;
        const selector = activeSelectorRef.current ?? getSelector(element);
        const inspected = selectedElementRef.current;
        if (inspected) {
          tracker.track(
            selector, inspected.tagName, inspected.textContent, inspected.classes,
            inspected.reactComponents, inspected.computedStyles, inspected.sourceFile,
            inspected.stylingApproach, inspected.inlineStyles, inspected.elementId,
            inspected.accessibleName, inspected.parentContext, inspected.childSummary,
            inspected.domPath, inspected.nearbySiblings, inspected.position, inspected.reactProps,
          );
        }
        tracker.recordChange(selector, property, value);
        preview.applyChange(selector, property, value);
        previewBridgeRef.current.end();
        syncTrackerStateRef.current();
        refreshSelectedElementRef.current();
        setChangeRevision((r) => r + 1);
      },
      onCanvasReorder: (element: Element, fromIndex: number, toIndex: number) => {
        handleTreeReorder(element, fromIndex, toIndex);
      },
      onCanvasReparent: (element: Element, newParent: Element, insertIndex: number) => {
        handleTreeReparent(element, newParent, insertIndex);
      },
      onCancel: () => {
        deactivateOverlay();
      },
    });
    pickerRef.current = picker;

    return () => {
      picker.destroy();
      preview.destroy();
      // Do NOT disconnect the singleton bridge here — React StrictMode
      // will immediately re-mount and re-register the handler. The bridge
      // must stay alive so the MCP server keeps its connection.
      unmountOverlay(mount.host);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Force pseudo-state: apply hover/focus/active CSS rules directly to the element
  // so getComputedStyle reflects those styles for the panel to display
  const forcedStylesRef = useRef<{ selector: string; props: string[] }>({ selector: "", props: [] });

  /** Remove all forced inline styles from the DOM element and reset tracking. */
  const clearForcedInlineStyles = useCallback(() => {
    const el = selectedElementRef.current?.element as HTMLElement | undefined;
    const prev = forcedStylesRef.current;
    if (el?.style && prev.props.length > 0) {
      for (const prop of prev.props) {
        const kebab = prop.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
        el.style.removeProperty(kebab);
      }
      if (el.getAttribute('style')?.trim() === '') {
        el.removeAttribute('style');
      }
    }
    forcedStylesRef.current = { selector: "", props: [] };
    setForcedState(null);
    forcedStateRef.current = null;
  }, []);

  // Load manifest eagerly on mount so it's ready before user interacts
  useEffect(() => { tryLoadManifest(); }, [tryLoadManifest]);

  const activateOverlay = useCallback(() => {
    setActive(true);
    pickerRef.current?.activate();
    previewRef.current?.attach();
  }, []);

  const deactivateOverlay = useCallback(() => {
    if (forcedStateRef.current) clearForcedInlineStyles();
    setActive(false);
    setSelectedElement(null);
    selectedElementRef.current = null;
    setSettingsOpen(false);
    setSettingsVisible(false);
    setSettingsExiting(false);
    pickerRef.current?.deactivate();
  }, [clearForcedInlineStyles]);

  const toggleOverlay = useCallback(() => {
    setActive((prev) => {
      if (prev) {
        if (forcedStateRef.current) clearForcedInlineStyles();
        setSelectedElement(null);
        selectedElementRef.current = null;
        setSettingsOpen(false);
        setSettingsVisible(false);
        setSettingsExiting(false);
        pickerRef.current?.deactivate();
      } else {
        pickerRef.current?.activate();
        previewRef.current?.attach();
      }
      return !prev;
    });
  }, [clearForcedInlineStyles]);

  const syncTrackerState = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    // Exclude bulk instances from change count (they're consolidated in the output)
    const pending = tracker.getPendingChanges();
    const primaryCount = pending.filter(c => !c.changes.some(p => p.property === "__bulkOf")).length;
    setChangeCount(primaryCount);
    setCanUndo(tracker.canUndo);
    setCanRedo(tracker.canRedo);
    tracker.persist();
  }, []);
  syncTrackerStateRef.current = syncTrackerState;

  const syncCommentState = useCallback(() => {
    const store = commentStoreRef.current;
    setComments(store.getAll());
    setCommentCount(store.count);
  }, []);

  // Quick element info helpers for comment mode (lightweight, no full inspection)
  const getQuickSelector = useCallback((el: Element): string => {
    if (el.id) return "#" + CSS.escape(el.id);
    let base: string;
    const cls = Array.from(el.classList).filter(c => !c.startsWith("_") && !/^[a-z]{1,3}[A-Za-z0-9_]{8,}$/.test(c));
    if (cls.length > 0) {
      base = "." + cls.map(c => CSS.escape(c)).join(".");
    } else {
      base = el.tagName.toLowerCase();
    }
    // Add :nth-child if siblings share the same selector
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(s => {
        if (s === el) return true;
        if (s.id || el.id) return false;
        if (cls.length > 0) return cls.every(c => s.classList.contains(c));
        return s.tagName === el.tagName;
      });
      if (siblings.length > 1) {
        const idx = Array.from(parent.children).indexOf(el) + 1;
        base += `:nth-child(${idx})`;
      }
    }
    return base;
  }, []);

  const getQuickComponentName = useCallback((el: Element): string | null => {
    const key = Object.keys(el).find(k => k.startsWith("__reactFiber$"));
    if (!key) return null;
    let fiber = (el as any)[key]?.return;
    while (fiber) {
      if (typeof fiber.type === "function" || typeof fiber.type === "object") {
        const n = fiber.type?.displayName || fiber.type?.name;
        if (n && n.length > 2 && !n.startsWith("_") && !/^(Fragment|Suspense|StrictMode|Provider|Consumer|Context)/.test(n)) return n;
      }
      fiber = fiber.return;
    }
    return null;
  }, []);

  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Sync comment mode to picker
  useEffect(() => {
    if (!active) return;
    pickerRef.current?.setCommentMode(mode === "comment");
  }, [mode, active]);

  // Comment mode: handle clicks and drags to create comments
  const lastClickRef = useRef({ x: 0, y: 0 });
  const areaDragJustEndedRef = useRef(false);
  useEffect(() => {
    const trackClick = (e: MouseEvent) => { lastClickRef.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener("click", trackClick, true);
    return () => document.removeEventListener("click", trackClick, true);
  }, []);

  const commentDragRef = useRef<{
    startX: number; startY: number; dragging: boolean;
    areaEl: HTMLDivElement | null;
  } | null>(null);
  const popoverOpenRef = useRef(false);
  const popoverTextRef = useRef("");
  const popoverInitialTextRef = useRef("");
  const shakePopover = useCallback(() => {
    const el = mountRef.current?.root.querySelector(".retune-comment-popover") as HTMLElement | null;
    if (!el) return;
    if (el.classList.contains("shaking")) return;
    el.classList.add("shaking");
    const onEnd = () => {
      el.classList.remove("shaking");
      el.removeEventListener("animationend", onEnd);
    };
    el.addEventListener("animationend", onEnd);
  }, []);
  /** Returns true if the popover has unsaved changes and should block. Triggers shake if blocking. */
  const shouldBlockForPopover = useCallback(() => {
    if (!popoverOpenRef.current) return false;
    if (areaDragJustEndedRef.current) return true;
    const isDirty = popoverTextRef.current !== popoverInitialTextRef.current;
    if (isDirty) {
      shakePopover();
      return true;
    }
    // No changes — dismiss and let the action pass through
    popoverOpenRef.current = false;
    popoverTextRef.current = "";
    popoverInitialTextRef.current = "";
    setCommentDraft(null);
    setActiveCommentId(null);
    return false;
  }, [shakePopover]);
  const shouldBlockForPopoverRef = useRef(shouldBlockForPopover);
  shouldBlockForPopoverRef.current = shouldBlockForPopover;

  // Mode shortcuts: V for edit, C for comment (when toolbar is active)
  useEffect(() => {
    if (!active) return;
    const handleModeKey = (e: KeyboardEvent) => {
      // Skip if typing in an input/textarea (check composedPath for shadow DOM)
      const actualTarget = e.composedPath()[0] as HTMLElement | undefined;
      const tag = actualTarget?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || actualTarget?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (shouldBlockForPopoverRef.current()) return;
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        setMode("edit");
        setCommentDraft(null);
        setActiveCommentId(null);
        popoverOpenRef.current = false;
        pickerRef.current?.setCommentMode(false);
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setMode("comment");
        setSelectedElement(null);
        pickerRef.current?.setCommentMode(true);
      }
    };
    document.addEventListener("keydown", handleModeKey, true);
    return () => document.removeEventListener("keydown", handleModeKey, true);
  }, [active]);

  // Comment mode: area drag selection (element clicks are handled by picker's onSelect)
  useEffect(() => {
    if (!active || mode !== "comment") return;

    const handlePointerDown = (e: PointerEvent) => {
      // Skip if click is inside the overlay (popover, toolbar, markers)
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
          // Query elements within the selected area
          const containedElements: Array<{ tagName: string; selector: string; componentName: string | null; textContent: string | null }> = [];
          const step = 20;
          const seen = new Set<Element>();
          for (let x = area.x + step / 2; x < area.x + area.width; x += step) {
            for (let y = area.y + step / 2; y < area.y + area.height; y += step) {
              const el = document.elementFromPoint(x, y);
              if (el && !seen.has(el) && !el.closest?.("[data-retune-host]")) {
                seen.add(el);
                containedElements.push({
                  tagName: el.tagName.toLowerCase(),
                  selector: getQuickSelector(el),
                  componentName: getQuickComponentName(el),
                  textContent: (el.textContent || "").slice(0, 40).trim() || null,
                });
              }
            }
          }

          popoverOpenRef.current = true; popoverTextRef.current = ""; popoverInitialTextRef.current = "";
          areaDragJustEndedRef.current = true;
          setTimeout(() => { areaDragJustEndedRef.current = false; }, 50);
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
            } as any : undefined,
          });
        }
      } else if (drag.areaEl) {
        drag.areaEl.remove();
      }
    };

    // Escape in comment mode: shake if unsaved changes, dismiss if clean, switch mode if no popover
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (shouldBlockForPopoverRef.current()) return;
      if (popoverOpenRef.current) {
        // Clean popover — dismiss it
        popoverOpenRef.current = false;
        popoverTextRef.current = "";
        popoverInitialTextRef.current = "";
        setCommentDraft(null);
        setActiveCommentId(null);
      } else {
        setMode("edit");
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
  }, [active, mode]);

  // Flag to skip ownedProperties update in refreshSelectedElement when it was just set directly
  const skipOwnedUpdateRef = useRef(false);

  const refreshSelectedElement = useCallback(() => {
    // Compute scoped styles once, use for both ownedProperties and computedStyles
    const el = selectedElementRef.current?.element;
    const scope = activeSelectorRef.current;
    const scopedResult = el && scope ? getScopedStyles(el, scope) : null;
    if (!skipOwnedUpdateRef.current) {
      setOwnedProperties(scopedResult?.ownedProperties);
    }
    skipOwnedUpdateRef.current = false;

    setSelectedElement((prev) => {
      if (!prev?.element) return prev;
      const inspected = inspectElement(prev.element);
      if (scopedResult) {
        inspected.computedStyles = scopedResult.styles;
      }
      // Overlay preview changes so the panel reflects what the user changed.
      // State-aware: only merge changes relevant to the current view.
      const preview = previewRef.current;
      if (preview) {
        const currentState = forcedStateRef.current;
        const forced = forcedStylesRef.current;

        // When a pseudo-state is forced, overlay the stylesheet pseudo values first
        // (these are the "starting point" for the pseudo view)
        if (currentState && prev.element) {
          const pseudoStyles = getPseudoStateStyles(prev.element, currentState);
          for (const [prop, value] of Object.entries(pseudoStyles)) {
            const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            inspected.computedStyles[camelProp] = value;
          }
        }

        for (const change of preview.getChanges()) {
          const pseudoMatch = change.selector.match(/:(hover|focus|active)$/);
          const changePseudo = pseudoMatch ? pseudoMatch[0] : null;
          const baseSel = change.selector.replace(/:(hover|focus|active)$/g, "");

          // Default view: skip pseudo-state changes
          if (!currentState && changePseudo) continue;
          // Pseudo view: skip changes for a different pseudo-state
          if (currentState && changePseudo && changePseudo !== currentState) continue;

          try {
            if (prev.element.matches(baseSel)) {
              inspected.computedStyles[change.property] = change.value;
            }
          } catch { /* invalid selector */ }
        }
      }
      // Eagerly sync the ref for the MCP bridge handler.
      selectedElementRef.current = inspected;
      return inspected;
    });
  }, []);
  refreshSelectedElementRef.current = refreshSelectedElement;

  const handlePropertyChange = useCallback((property: string, value: string) => {
    const el = selectedElementRef.current;
    const preview = previewRef.current;
    const tracker = trackerRef.current;
    if (!el || !preview || !tracker) return;
    const baseSelector = activeSelectorRef.current ?? el.selector;
    const selector = forcedStateRef.current
      ? baseSelector + forcedStateRef.current
      : baseSelector;
    preview.applyChange(selector, property, value);
    // When editing under a forced pseudo-state, also apply as inline style
    // on the DOM element so it visually reflects the change immediately.
    if (forcedStateRef.current) {
      const domEl = el.element as HTMLElement | undefined;
      if (domEl?.style) {
        const kebab = property.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
        domEl.style.setProperty(kebab, value, 'important');
      }
      // Track in forcedStylesRef so cleanup removes it when toggling back
      const forced = forcedStylesRef.current;
      if (forced.selector === baseSelector && !forced.props.includes(property)) {
        forced.props.push(property);
      }
    }
    // Ensure element is tracked (may have been cleared by reset)
    tracker.track(
      selector, el.tagName, el.textContent, el.classes,
      el.reactComponents, el.computedStyles, el.sourceFile,
      el.stylingApproach, el.inlineStyles, el.elementId,
      el.accessibleName, el.parentContext, el.childSummary,
      el.domPath, el.nearbySiblings, el.position,
    );
    tracker.recordChange(selector, property, value);
    syncTrackerStateRef.current();
    refreshSelectedElementRef.current();
    pickerRef.current?.refreshSelection();
    setChangeRevision((r) => r + 1);
  }, []);

  const handleForcedStateChange = useCallback((state: ForcedState) => {
    const preview = previewRef.current;
    const el = selectedElementRef.current;
    if (!preview || !el?.element) return;

    const selector = activeSelectorRef.current ?? el.selector;
    const domEl = el.element as HTMLElement;

    // Remove previously forced inline styles
    clearForcedInlineStyles();

    // Set the new state (after clearing, which resets to null)
    setForcedState(state);
    forcedStateRef.current = state; // sync ref immediately so refreshSelectedElement reads the correct state

    if (state) {
      // Find CSS rules for this pseudo-state and apply them as inline styles.
      // Inline styles with !important guarantee the element visually updates,
      // regardless of stylesheet specificity or cascade issues.
      const pseudoStyles = getPseudoStateStyles(el.element, state);
      const appliedProps: string[] = [];

      // Check for existing user edits on this pseudo selector — preserve them
      const pseudoSelector = selector + state;
      const userEdits = new Map<string, string>();
      for (const change of preview.getChanges()) {
        if (change.selector === pseudoSelector) {
          userEdits.set(change.property, change.value);
        }
      }

      // Apply pseudo styles (prefer user edits over original stylesheet values)
      const applied = new Set<string>();
      for (const [prop, value] of Object.entries(pseudoStyles)) {
        const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const finalValue = userEdits.get(camelProp) ?? value;
        if (domEl.style) {
          domEl.style.setProperty(prop, finalValue, 'important');
        }
        appliedProps.push(camelProp);
        applied.add(camelProp);
      }

      // Also apply user edits for properties not in the original pseudo styles
      for (const [camelProp, value] of userEdits) {
        if (applied.has(camelProp)) continue;
        const kebab = camelProp.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
        if (domEl.style) {
          domEl.style.setProperty(kebab, value, 'important');
        }
        appliedProps.push(camelProp);
      }

      forcedStylesRef.current = { selector, props: appliedProps };
    }

    refreshSelectedElementRef.current();
  }, []);

  const handleApplyToElement = useCallback((el: Element, property: string, value: string) => {
    const preview = previewRef.current;
    if (!preview) return;
    const selector = getSelector(el);
    if (value) {
      preview.applyChange(selector, property, value);
    } else {
      preview.removeChange(selector, property);
    }
  }, []);

  // Token swap: track class changes for AI output
  const handleVariableSwap = useCallback((oldClassName: string, newClassName: string) => {
    const el = selectedElementRef.current;
    const tracker = trackerRef.current;
    if (!el || !tracker) return;
    const selector = activeSelectorRef.current ?? el.selector;
    // Record as a special property change so the AI agent knows to swap classes
    tracker.track(
      selector, el.tagName, el.textContent, el.classes,
      el.reactComponents, el.computedStyles, el.sourceFile,
      el.stylingApproach, el.inlineStyles, el.elementId,
      el.accessibleName, el.parentContext, el.childSummary,
      el.domPath, el.nearbySiblings, el.position,
    );
    tracker.recordChange(selector, `class:${oldClassName}`, newClassName);
    syncTrackerStateRef.current();
    refreshSelectedElementRef.current();
    pickerRef.current?.refreshSelection();
    setChangeRevision((r) => r + 1);
  }, []);

  // Token associate: record value-only token apply in change tracker (persists across refresh)
  const handleVariableAssociate = useCallback((properties: string[], token: { className: string; values: Record<string, string> }) => {
    const tracker = trackerRef.current;
    const el = selectedElementRef.current;
    if (!tracker || !el) return;
    const selector = activeSelectorRef.current ?? el.selector;
    tracker.setVariableAssociation(selector, properties, token);
    // Clear unlinked state — user is picking a new token
    tracker.relinkVariable(selector, properties);
    tracker.persist();
    setChangeRevision((r) => r + 1);
  }, []);

  const handleVariableUnlink = useCallback((properties: string[]) => {
    const tracker = trackerRef.current;
    const el = selectedElementRef.current;
    if (!tracker || !el) return;
    const selector = activeSelectorRef.current ?? el.selector;
    // Record unlink with undo support — keeps the value, breaks the token reference
    tracker.recordUnlink(selector, properties);
    syncTrackerStateRef.current();
    setChangeRevision((r) => r + 1);
  }, []);

  // Get current variable associations for the selected element
  const selectedVariableAssociations = useMemo(() => {
    const tracker = trackerRef.current;
    if (!tracker || !selectedElement) return {};
    const selector = activeSelector ?? selectedElement.selector;
    return { ...(tracker.getVariableAssociations(selector) ?? {}) };
  // changeRevision ensures we re-read after new associations are recorded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElement, activeSelector, changeRevision]);

  // Get unlinked token properties for the selected element
  const selectedUnlinkedVariables = useMemo(() => {
    const tracker = trackerRef.current;
    if (!tracker || !selectedElement) return new Set<string>();
    const selector = activeSelector ?? selectedElement.selector;
    return new Set(tracker.getUnlinkedVariables(selector));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElement, activeSelector, changeRevision]);

  // Get changed properties for the selected element (for change indicator dots)
  const selectedChangedProperties = useMemo(() => {
    const tracker = trackerRef.current;
    if (!tracker || !selectedElement) return new Set<string>();
    const selector = activeSelector ?? selectedElement.selector;
    const result = tracker.getChangedProperties(selector);
    // Also check the forced-state-suffixed selector so edits made under
    // :hover/:focus/:active show their change dots.
    const forced = forcedStateRef.current;
    if (forced) {
      const forcedChanges = tracker.getChangedProperties(`${selector}${forced}`);
      for (const p of forcedChanges) result.add(p);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElement, activeSelector, changeRevision]);

  // Tree: select element programmatically via picker
  const handleTreeSelect = useCallback((el: Element) => {
    const picker = pickerRef.current;
    if (picker) {
      picker.selectElement(el);
    }
  }, []);

  // Tree: hover highlight via picker
  const handleTreeHover = useCallback((el: Element | null) => {
    const picker = pickerRef.current;
    if (picker) {
      picker.highlightElement(el);
    }
  }, []);

  // Tab pill animation
  useEffect(() => {
    const bar = tabBarRef.current;
    const pill = tabPillRef.current;
    if (!bar || !pill) return;

    const buttons = bar.querySelectorAll<HTMLButtonElement>(".retune-tab");
    const idx = panelTab === "elements" ? 0 : 1;
    const btn = buttons[idx];
    if (!btn) return;

    const barRect = bar.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const offsetX = btnRect.left - barRect.left;

    pill.style.width = `${btnRect.width}px`;
    if (tabPillFirstRender.current) {
      pill.style.transition = "none";
      pill.style.transform = `translateX(${offsetX}px)`;
      pill.offsetHeight; // force reflow
      pill.style.transition = "";
      tabPillFirstRender.current = false;
    } else {
      pill.style.transform = `translateX(${offsetX}px)`;
    }
  }, [panelTab, selectedElement]);

  // Toggle toolbar + panel side
  const handleToggleSide = useCallback(() => {
    setSide((s) => {
      const next = s === "right" ? "left" : "right";
      try { localStorage.setItem("retune-panel-side", next); } catch {}
      return next;
    });
  }, []);

  // Drag-to-snap toolbar
  const handleToolbarPointerDown = useCallback((e: React.PointerEvent) => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: 0, dragging: false, lastX: e.clientX, lastT: e.timeStamp, velocity: 0 };
  }, []);

  const handleToolbarPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    const toolbar = toolbarRef.current;
    if (!drag || !toolbar) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    if (!drag.dragging) {
      // Snapshot origin on first drag frame and capture pointer
      const rect = toolbar.getBoundingClientRect();
      drag.originX = rect.left + rect.width / 2;
      drag.dragging = true;
      toolbar.setPointerCapture(e.pointerId);
      setToolbarDragging(true);
    }

    // Track velocity (px/ms) for flick detection
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) {
      drag.velocity = (e.clientX - drag.lastX) / dt;
    }
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;

    // Use translateX for GPU-only animation (no layout thrash)
    const offset = e.clientX - drag.startX;
    toolbar.style.transition = "none";
    toolbar.style.transform = `translateX(${offset}px)`;
  }, []);

  const handleToolbarPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    const toolbar = toolbarRef.current;
    if (!drag || !toolbar) return;
    dragRef.current = null;

    if (!drag.dragging) {
      return;
    }

    // FLIP: record current visual position before class change
    const beforeRect = toolbar.getBoundingClientRect();

    // Flick: if velocity is strong enough, snap to that direction regardless of position
    // Otherwise fall back to position-based threshold (which half of viewport)
    const FLICK_THRESHOLD = 0.4; // px/ms
    const newSide = Math.abs(drag.velocity) > FLICK_THRESHOLD
      ? (drag.velocity < 0 ? "left" : "right")
      : (e.clientX < window.innerWidth / 2 ? "left" : "right");
    setSide(newSide);
    try { localStorage.setItem("retune-panel-side", newSide); } catch {}

    // After React re-renders with new side class, FLIP animate
    requestAnimationFrame(() => {
      // Clear drag transform so CSS class positions it at target
      toolbar.style.transition = "none";
      toolbar.style.transform = "";
      const afterRect = toolbar.getBoundingClientRect();

      // Invert: translate back to where it was
      const dx = beforeRect.left - afterRect.left;
      toolbar.style.transform = `translateX(${dx}px)`;

      // Play: animate to final position (transform: none)
      requestAnimationFrame(() => {
        toolbar.style.transition = "transform 200ms cubic-bezier(0.77, 0, 0.175, 1)";
        toolbar.style.transform = "";

        const cleanup = () => {
          toolbar.removeEventListener("transitionend", cleanup);
          toolbar.style.transition = "";
          setToolbarDragging(false);
        };
        toolbar.addEventListener("transitionend", cleanup, { once: true });
      });
    });
  }, []);

  /** After undo/redo, sync forced inline styles on the DOM element to match the current preview state. */
  const syncForcedInlineStyles = useCallback(() => {
    const state = forcedStateRef.current;
    if (!state) return;
    const el = selectedElementRef.current;
    const preview = previewRef.current;
    if (!el?.element || !preview) return;
    const domEl = el.element as HTMLElement;
    if (!domEl.style) return;

    const selector = activeSelectorRef.current ?? el.selector;
    const pseudoSelector = selector + state;

    // Rebuild inline styles: start with pseudo stylesheet values, overlay user edits
    const pseudoStyles = getPseudoStateStyles(el.element, state);
    const userEdits = new Map<string, string>();
    for (const change of preview.getChanges()) {
      if (change.selector === pseudoSelector) {
        userEdits.set(change.property, change.value);
      }
    }

    // Remove old forced inline styles
    const prev = forcedStylesRef.current;
    for (const prop of prev.props) {
      const kebab = prop.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
      domEl.style.removeProperty(kebab);
    }

    // Re-apply
    const appliedProps: string[] = [];
    const applied = new Set<string>();
    for (const [prop, value] of Object.entries(pseudoStyles)) {
      const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const finalValue = userEdits.get(camelProp) ?? value;
      domEl.style.setProperty(prop, finalValue, 'important');
      appliedProps.push(camelProp);
      applied.add(camelProp);
    }
    for (const [camelProp, value] of userEdits) {
      if (applied.has(camelProp)) continue;
      const kebab = camelProp.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
      domEl.style.setProperty(kebab, value, 'important');
      appliedProps.push(camelProp);
    }
    forcedStylesRef.current = { selector, props: appliedProps };
  }, []);

  // Delete stacks for undo/redo: stores removed elements so they can be re-inserted
  const deleteStackRef = useRef<Array<{ element: Element; parent: Node; nextSibling: Node | null }>>([]);
  const deleteRedoStackRef = useRef<Array<{ element: Element; parent: Node; nextSibling: Node | null }>>([]);

  // Text change stack for undo/redo: stores original HTML so text edits can be reverted
  const textStackRef = useRef<Array<{ element: HTMLElement; originalHTML: string; newHTML: string }>>([]);
  const textRedoStackRef = useRef<Array<{ element: HTMLElement; originalHTML: string; newHTML: string }>>([]);

  // Delete selected element
  const handleDelete = useCallback(() => {
    const el = selectedElementRef.current;
    if (!el?.element) return;

    const tag = el.element.tagName.toLowerCase();
    if (tag === "body" || tag === "html" || tag === "head") return;
    if ((el.element as HTMLElement).hasAttribute("data-retune-host")) return;

    const parent = el.element.parentNode;
    if (!parent) return;

    const tracker = trackerRef.current;
    if (tracker) {
      const selector = activeSelectorRef.current ?? el.selector;
      tracker.track(
        selector, el.tagName, el.textContent, el.classes,
        el.reactComponents, el.computedStyles, el.sourceFile,
        el.stylingApproach, el.inlineStyles, el.elementId,
        el.accessibleName, el.parentContext, el.childSummary,
        el.domPath, el.nearbySiblings, el.position,
      );
      tracker.recordChange(selector, "__delete", "true");
      tracker.persist();
    }

    deleteStackRef.current.push({
      element: el.element,
      parent,
      nextSibling: el.element.nextSibling,
    });
    deleteRedoStackRef.current = []; // new action clears redo

    el.element.remove();

    setSelectedElement(null);
    selectedElementRef.current = null;
    pickerRef.current?.refreshSelection();
    syncTrackerStateRef.current();
    setChangeRevision((r) => r + 1);
  }, []);

  // Undo delete: re-insert the last deleted element
  const undoDelete = useCallback(() => {
    const entry = deleteStackRef.current.pop();
    if (!entry) return;

    if (entry.nextSibling) {
      entry.parent.insertBefore(entry.element, entry.nextSibling);
    } else {
      entry.parent.appendChild(entry.element);
    }

    // Save for redo
    deleteRedoStackRef.current.push(entry);

    syncTrackerStateRef.current();
    setChangeRevision((r) => r + 1);
  }, []);

  /** Revert all bulk tracker entries for a structural property type (__reorder or __reparent) */
  function revertBulkTrackerEntries(tracker: any, property: string) {
    const pending = tracker.getPendingChanges();
    for (const change of pending) {
      if (change.changes.some((c: any) => c.property === "__bulkOf")) {
        tracker.removeProperty(change.selector, property);
        tracker.removeProperty(change.selector, "__bulkOf");
      }
    }
    tracker.persist();
  }

  const handleUndo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    const entries = tracker.popUndo();
    if (!entries) return;

    // If this undo group contains a __delete, re-insert the element instead of CSS undo
    if (entries.some(e => e.property === "__delete")) {
      undoDelete();
      return;
    }

    // If this undo group contains a __reorder, restore previous visual state
    if (entries.some(e => e.property === "__reorder")) {
      const undoEntry = reorderStackRef.current.pop();
      if (undoEntry) {
        const redoEntry: typeof undoEntry = undoEntry.map(s => ({
          element: s.element,
          prevOrder: s.element.style.order,
          prevTranslate: s.element.style.translate,
        }));
        for (const s of undoEntry) {
          if (s.prevOrder) s.element.style.order = s.prevOrder;
          else s.element.style.removeProperty("order");
          s.element.style.removeProperty("transition");
          if (s.prevTranslate) s.element.style.translate = s.prevTranslate;
          else s.element.style.removeProperty("translate");
          if (s.element.getAttribute("style")?.trim() === "") s.element.removeAttribute("style");
        }
        reorderRedoStackRef.current.push(redoEntry);
      }
      // Remove bulk __reorder entries from the tracker
      revertBulkTrackerEntries(tracker, "__reorder");
      syncTrackerStateRef.current();
      refreshSelectedElementRef.current();
      pickerRef.current?.refreshSelection();
      setChangeRevision((r) => r + 1);
      return;
    }

    // If this undo group contains a __reparent, move element(s) back to original parent(s)
    if (entries.some(e => e.property === "__reparent")) {
      const batchSize = reparentBatchSizeRef.current.pop() || 1;
      const undoneElements: Element[] = [];
      for (let i = 0; i < batchSize; i++) {
        const entry = reparentDOMRef.current.pop();
        if (!entry) break;
        entry.observer.disconnect();
        try {
          if (entry.oldNextSibling && entry.oldNextSibling.parentElement === entry.oldParent) {
            entry.oldParent.insertBefore(entry.element, entry.oldNextSibling);
          } else {
            entry.oldParent.appendChild(entry.element);
          }
        } catch {}
        undoneElements.push(entry.element);
      }
      // Remove bulk __reparent entries from the tracker
      revertBulkTrackerEntries(tracker, "__reparent");
      // Update reparent entries for tree visual preview
      setReparentEntries(prev => prev.filter(r => !undoneElements.includes(r.element)));
      syncTrackerStateRef.current();
      refreshSelectedElementRef.current();
      pickerRef.current?.refreshSelection();
      setChangeRevision((r) => r + 1);
      return;
    }

    // If this undo group contains a __text, restore original HTML
    if (entries.some(e => e.property === "__text")) {
      const entry = textStackRef.current.pop();
      if (entry) {
        entry.element.innerHTML = entry.originalHTML;
        textRedoStackRef.current.push(entry);
      }
      syncTrackerStateRef.current();
      setChangeRevision((r) => r + 1);
      return;
    }

    {
      // Apply preview changes only for value entries (skip metadata-only unlink entries)
      const valueEntries = entries.filter(e => !e.action);
      for (const entry of valueEntries) {
        if (entry.value) preview.applyChange(entry.selector, entry.property, entry.value);
        else preview.removeChange(entry.selector, entry.property);
      }
      // Clean up preview rules for properties that reverted to their original values.
      // After popUndo, some properties may have truthy entry.value (the original computed
      // value, e.g. "20px") even though there's no net change — remove those stale rules.
      const pending = tracker.getPendingChanges();
      const activeProps = new Set<string>();
      for (const el of pending) {
        for (const c of el.changes) {
          activeProps.add(`${el.selector}::${c.property}`);
        }
      }
      for (const entry of valueEntries) {
        const key = `${entry.selector}::${entry.property}`;
        if (!activeProps.has(key)) {
          preview.removeChange(entry.selector, entry.property);
        }
      }
      syncForcedInlineStyles();
      syncTrackerStateRef.current();
      refreshSelectedElementRef.current();
      pickerRef.current?.refreshSelection();
      setChangeRevision((r) => r + 1);
    }
  }, [syncForcedInlineStyles, undoDelete]);

  const handleRedo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    const entries = tracker.popRedo();
    if (!entries) return;

    // If this redo group contains a __reorder, re-apply visual state
    if (entries.some(e => e.property === "__reorder")) {
      const redoEntry = reorderRedoStackRef.current.pop();
      if (redoEntry) {
        const undoEntry: typeof redoEntry = redoEntry.map(s => ({
          element: s.element,
          prevOrder: s.element.style.order,
          prevTranslate: s.element.style.translate,
        }));
        for (const s of redoEntry) {
          s.element.style.order = s.prevOrder;
          s.element.style.transition = "";
          s.element.style.translate = s.prevTranslate;
        }
        reorderStackRef.current.push(undoEntry);
      }
      syncTrackerStateRef.current();
      refreshSelectedElementRef.current();
      pickerRef.current?.refreshSelection();
      setChangeRevision((r) => r + 1);
      return;
    }

    // If this redo group contains a __text, re-apply edited text
    if (entries.some(e => e.property === "__text")) {
      const entry = textRedoStackRef.current.pop();
      if (entry) {
        entry.element.innerHTML = entry.newHTML;
        textStackRef.current.push(entry);
      }
      syncTrackerStateRef.current();
      setChangeRevision((r) => r + 1);
      return;
    }

    // If this redo group contains a __delete, re-remove the element
    if (entries.some(e => e.property === "__delete")) {
      const entry = deleteRedoStackRef.current.pop();
      if (entry) {
        // Update position reference before removing (may have shifted)
        deleteStackRef.current.push({
          element: entry.element,
          parent: entry.element.parentNode!,
          nextSibling: entry.element.nextSibling,
        });
        entry.element.remove();
        setSelectedElement(null);
        selectedElementRef.current = null;
        pickerRef.current?.refreshSelection();
      }
      syncTrackerStateRef.current();
      setChangeRevision((r) => r + 1);
      return;
    }

    // Apply preview changes only for value entries (skip metadata-only unlink entries)
    for (const entry of entries) {
      if (!entry.action) {
        preview.applyChange(entry.selector, entry.property, entry.value);
      }
    }
    syncForcedInlineStyles();
    syncTrackerStateRef.current();
    refreshSelectedElementRef.current();
    pickerRef.current?.refreshSelection();
    setChangeRevision((r) => r + 1);
  }, [syncForcedInlineStyles]);

  // Per-property reset: revert a single property to its original value
  const handlePropertyReset = useCallback((property: string) => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    const el = selectedElementRef.current;
    if (!tracker || !preview || !el) return;
    const selector = activeSelectorRef.current ?? el.selector;

    const result = tracker.resetProperty(selector, property);
    if (!result) return;

    // Update preview
    if (result.to) {
      preview.applyChange(selector, property, result.to);
    } else {
      preview.removeChange(selector, property);
    }
    // Clean up stale preview rule if property reverted to original
    const pending = tracker.getPendingChanges();
    const activeProps = new Set<string>();
    for (const c of pending) {
      for (const p of c.changes) {
        activeProps.add(`${c.selector}::${p.property}`);
      }
    }
    if (!activeProps.has(`${selector}::${property}`)) {
      preview.removeChange(selector, property);
    }

    syncForcedInlineStyles();
    syncTrackerStateRef.current();
    refreshSelectedElementRef.current();
    pickerRef.current?.refreshSelection();
    setChangeRevision((r) => r + 1);
  }, [syncForcedInlineStyles]);


  // Reorder preview — CSS `order` for flex/grid, `translate` for block layout
  type ReorderUndoEntry = Array<{ element: HTMLElement; prevOrder: string; prevTranslate: string }>;
  const reorderStackRef = useRef<ReorderUndoEntry[]>([]);
  const reorderRedoStackRef = useRef<ReorderUndoEntry[]>([]);
  // Track original selector per element so multiple arrow presses produce one net change
  const reorderOriginRef = useRef(new WeakMap<Element, { selector: string; originalIndex: number }>());
  // Track containers with explicit order values so we can clean up on clear
  const reorderOriginalOrderRef = useRef(new Map<Element, Map<Element, string>>());
  // Track layout mode per container for translate-based reorder
  const reorderModeRef = useRef(new WeakMap<Element, "order" | "translate">());
  // Track original rects for translate-based reorder (snapshotted before any transforms)
  const reorderOriginalRectsRef = useRef(new Map<Element, Map<Element, DOMRect>>());
  // Track desired visual order for translate-based reorder
  const reorderVisualOrderRef = useRef(new Map<Element, HTMLElement[]>());
  // MutationObserver to auto-clear translates when React reconciles (e.g., after HMR)
  const reorderObserverRef = useRef<MutationObserver | null>(null);

  /** Get the visual order of children (sorted by CSS order for flex/grid, DOM order for block) */
  function getVisualOrder(parent: Element): HTMLElement[] {
    const children = Array.from(parent.children) as HTMLElement[];
    const mode = reorderModeRef.current.get(parent);
    if (mode === "translate") {
      const desired = reorderVisualOrderRef.current.get(parent);
      if (desired) return [...desired];
    }
    return [...children].sort((a, b) => {
      const orderA = parseInt(a.style.order) || 0;
      const orderB = parseInt(b.style.order) || 0;
      if (orderA !== orderB) return orderA - orderB;
      return children.indexOf(a) - children.indexOf(b);
    });
  }

  // Build visual order map for the element tree (reflects reorder state)
  const visualOrderMap = useMemo(() => {
    const map = new Map<Element, Element[]>();
    for (const parent of reorderOriginalOrderRef.current.keys()) {
      if (parent.isConnected) map.set(parent, getVisualOrder(parent));
    }
    for (const parent of reorderVisualOrderRef.current.keys()) {
      if (parent.isConnected && !map.has(parent)) map.set(parent, getVisualOrder(parent));
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeRevision]);

  /** Assign explicit order values to all children if not already done (flex/grid only) */
  function ensureExplicitOrder(parent: Element) {
    if (reorderOriginalOrderRef.current.has(parent)) return;
    const children = Array.from(parent.children) as HTMLElement[];
    const originals = new Map<Element, string>();
    for (const child of children) {
      originals.set(child, child.style.order || "");
    }
    reorderOriginalOrderRef.current.set(parent, originals);
    children.forEach((c, i) => { c.style.order = String(i); });
  }

  /** Snapshot original rects and visual order for translate-based reorder (block layout) */
  function ensureOriginalRects(parent: Element) {
    if (reorderOriginalRectsRef.current.has(parent)) return;
    const children = Array.from(parent.children) as HTMLElement[];
    const rects = new Map<Element, DOMRect>();
    for (const child of children) {
      rects.set(child, child.getBoundingClientRect());
    }
    reorderOriginalRectsRef.current.set(parent, rects);
    reorderVisualOrderRef.current.set(parent, [...children]);

    // Watch for React reconciliation (HMR, state changes) — auto-clear translates
    // if children are added/removed/reordered by React
    if (!reorderObserverRef.current) {
      reorderObserverRef.current = new MutationObserver((mutations) => {
        for (const m of mutations) {
          const target = m.target as Element;
          if (m.type === "childList" && reorderOriginalRectsRef.current.has(target)) {
            // React changed this parent's children — clear all translates
            const rects = reorderOriginalRectsRef.current.get(target);
            if (rects) {
              for (const [child] of rects) {
                const el = child as HTMLElement;
                el.style.removeProperty("translate");
                if (el.getAttribute("style")?.trim() === "") el.removeAttribute("style");
              }
            }
            reorderOriginalRectsRef.current.delete(target);
            reorderVisualOrderRef.current.delete(target);
            reorderModeRef.current.delete(target);
          }
        }
      });
    }
    reorderObserverRef.current.observe(parent, { childList: true });
  }

  /** Recompute all translates to match desired visual order, accounting for different heights */
  function applyTranslateOrder(parent: Element) {
    const rects = reorderOriginalRectsRef.current.get(parent);
    const desiredOrder = reorderVisualOrderRef.current.get(parent);
    if (!rects || !desiredOrder) return;

    // Compute the average gap between consecutive original elements
    const originalChildren = Array.from(parent.children) as HTMLElement[];
    let totalGap = 0;
    let gapCount = 0;
    for (let i = 0; i < originalChildren.length - 1; i++) {
      const curr = rects.get(originalChildren[i])!;
      const next = rects.get(originalChildren[i + 1])!;
      totalGap += next.top - curr.bottom;
      gapCount++;
    }
    const gap = gapCount > 0 ? totalGap / gapCount : 0;

    // Stack elements in desired order using actual heights + gap
    let currentTop = rects.get(originalChildren[0])!.top; // start at original first position
    for (let i = 0; i < desiredOrder.length; i++) {
      const child = desiredOrder[i];
      const originalTop = rects.get(child)!.top;
      const translateY = currentTop - originalTop;
      if (Math.abs(translateY) < 0.5) {
        child.style.removeProperty("translate");
      } else {
        child.style.translate = `0 ${translateY}px`;
      }
      currentTop += rects.get(child)!.height + gap;
    }
  }

  /**
   * After reordering children in one parent, propagate the same visual order
   * to all other structurally similar parents (if the active scope says so).
   *
   * Uses CSS `order` for flex/grid parents and translate for block parents.
   * Returns the list of additional parents modified (for undo tracking).
   */
  function applyBulkReorder(
    primaryParent: Element,
    newVisualOrder: HTMLElement[],
  ): ReorderUndoEntry[] {
    // Check if active scope has count > 1
    const activeLevel = scopeLevelsRef.current[activeLevelIndexRef.current];
    if (!activeLevel?.selector || activeLevel.count <= 1) return [];

    // Get the parent's shared selector
    const parentShared = getSharedSelector(primaryParent);
    if (!parentShared || parentShared.count <= 1) return [];

    // Find all matching parents
    let otherParents: Element[];
    try {
      otherParents = Array.from(document.querySelectorAll(parentShared.selector))
        .filter(p => p !== primaryParent && p.isConnected);
    } catch { return []; }

    if (otherParents.length === 0) return [];

    // Guard: check if the primary parent's children are data-driven (array type)
    if (detectChildrenType(primaryParent) === "array") return [];

    // Build a class-based child order map from the primary parent's new visual order
    // e.g., [".message-row__labels", ".message-row__top", ".message-row__subject", ".message-row__preview"]
    const childSelectors = newVisualOrder.map(child => {
      const classes = Array.from(child.classList).filter(c => !isHashedClass(c));
      if (classes.length > 0) return `.${classes[0]}`;
      return child.tagName.toLowerCase();
    });

    // Check children are distinguishable (not all the same selector)
    const uniqueSelectors = new Set(childSelectors);
    if (uniqueSelectors.size < childSelectors.length * 0.5) return []; // too many duplicates

    const bulkUndoEntries: ReorderUndoEntry[] = [];

    for (const otherParent of otherParents) {
      const otherChildren = Array.from(otherParent.children) as HTMLElement[];
      if (otherChildren.length < 2) continue;

      // Structural fingerprint check: do children match reasonably?
      const otherChildSelectors = otherChildren.map(child => {
        const classes = Array.from(child.classList).filter(c => !isHashedClass(c));
        if (classes.length > 0) return `.${classes[0]}`;
        return child.tagName.toLowerCase();
      });

      // Check overlap: at least 70% of BOTH sides' children should match
      // This prevents propagating between structural variants (e.g., folder items vs label items)
      const primarySet = new Set(childSelectors);
      const otherSet = new Set(otherChildSelectors);
      const matchCount = otherChildSelectors.filter(s => primarySet.has(s)).length;
      const reverseMatchCount = childSelectors.filter(s => otherSet.has(s)).length;
      if (matchCount < otherChildSelectors.length * 0.7 || reverseMatchCount < childSelectors.length * 0.7) continue;

      // Determine mode for this parent
      const display = getComputedStyle(otherParent).display;
      const isFlex = display === "flex" || display === "inline-flex";
      const isGrid = display === "grid" || display === "inline-grid";
      const mode = (isFlex || isGrid) ? "order" : "translate";

      // Save undo state
      const undoEntry: ReorderUndoEntry = otherChildren.map(c => ({
        element: c,
        prevOrder: c.style.order,
        prevTranslate: c.style.translate || "",
      }));
      bulkUndoEntries.push(undoEntry);

      // Record in change tracker for persistence — find each child whose position changed
      const tracker = trackerRef.current;
      if (tracker) {
        for (let i = 0; i < otherChildren.length; i++) {
          const child = otherChildren[i];
          const cls = Array.from(child.classList).filter(cl => !isHashedClass(cl));
          const childSel = cls.length > 0 ? `.${cls[0]}` : child.tagName.toLowerCase();
          const targetIdx = childSelectors.indexOf(childSel);
          if (targetIdx !== -1 && targetIdx !== i) {
            const bulkSelector = getSelector(child);
            tracker.track(
              bulkSelector, child.tagName.toLowerCase(),
              child.textContent?.slice(0, 40) || null,
              Array.from(child.classList), [],
              { "__reorder": String(i) }, null,
              undefined, null, child.id || null,
              null, null, null, "", null, { x: 0, y: 0, width: 0, height: 0 },
            );
            tracker.ensureOriginalValue(bulkSelector, "__reorder", String(i));
            tracker.recordChangeSilent(bulkSelector, "__reorder", String(targetIdx));
            // Mark as bulk instance so output formatter consolidates
            tracker.ensureOriginalValue(bulkSelector, "__bulkOf", "");
            tracker.recordChangeSilent(bulkSelector, "__bulkOf", "reorder");
            break; // one entry per parent is enough for restoration
          }
        }
        tracker.persist();
      }

      if (mode === "order") {
        // Build target order from child selectors
        // For each child in the primary's new order, find matching child in this parent
        let orderIdx = 0;
        const assigned = new Set<HTMLElement>();
        for (const selector of childSelectors) {
          const match = otherChildren.find(c => {
            if (assigned.has(c)) return false;
            const classes = Array.from(c.classList).filter(cl => !isHashedClass(cl));
            const childSel = classes.length > 0 ? `.${classes[0]}` : c.tagName.toLowerCase();
            return childSel === selector;
          });
          if (match) {
            match.style.order = String(orderIdx);
            assigned.add(match);
          }
          orderIdx++;
        }
        // Assign remaining children (not matched) after the matched ones
        for (const child of otherChildren) {
          if (!assigned.has(child)) {
            child.style.order = String(orderIdx++);
          }
        }

        // Track mode for undo
        if (!reorderModeRef.current.has(otherParent)) {
          reorderModeRef.current.set(otherParent, "order");
        }
        if (!reorderOriginalOrderRef.current.has(otherParent)) {
          const originals = new Map<Element, string>();
          for (const child of otherChildren) {
            originals.set(child, undoEntry.find(u => u.element === child)?.prevOrder || "");
          }
          reorderOriginalOrderRef.current.set(otherParent, originals);
        }
      } else {
        // Translate mode: use ensureOriginalRects (snapshots once) + build desired order
        ensureOriginalRects(otherParent);

        // Build desired order by matching child selectors
        const desiredOrder: HTMLElement[] = [];
        const assigned = new Set<HTMLElement>();
        for (const selector of childSelectors) {
          const match = otherChildren.find(c => {
            if (assigned.has(c)) return false;
            const classes = Array.from(c.classList).filter(cl => !isHashedClass(cl));
            const childSel = classes.length > 0 ? `.${classes[0]}` : c.tagName.toLowerCase();
            return childSel === selector;
          });
          if (match) {
            desiredOrder.push(match);
            assigned.add(match);
          }
        }
        // Append unmatched children at the end
        for (const child of otherChildren) {
          if (!assigned.has(child)) desiredOrder.push(child);
        }

        // Store desired order and apply translates using the shared infrastructure
        reorderVisualOrderRef.current.set(otherParent, desiredOrder);
        if (!reorderModeRef.current.has(otherParent)) {
          reorderModeRef.current.set(otherParent, "translate");
        }
        applyTranslateOrder(otherParent);
      }
    }

    return bulkUndoEntries;
  }

  /**
   * After reparenting an element in one instance, propagate the same structural
   * move to all other matching instances (if the active scope says so).
   *
   * For each other instance: find the matching child (by class), find the matching
   * new parent (by class relative to the instance root), and perform the DOM move.
   */
  function applyBulkReparent(
    primaryElement: HTMLElement,
    primaryOldParent: Element,
    primaryNewParent: Element,
    insertIndex: number,
  ): void {
    // Check if active scope has count > 1
    const activeLevel = scopeLevelsRef.current[activeLevelIndexRef.current];
    if (!activeLevel?.selector || activeLevel.count <= 1) return;

    // Get the element's first semantic class for matching across instances
    const elementClasses = Array.from(primaryElement.classList).filter(c => !isHashedClass(c));
    if (elementClasses.length === 0) return;
    const elementClassName = elementClasses[0];

    // Get the old parent's shared selector to find matching parent instances
    const oldParentShared = getSharedSelector(primaryOldParent);
    if (!oldParentShared || oldParentShared.count <= 1) return;

    // Guard: data-driven children shouldn't bulk reparent
    if (detectChildrenType(primaryOldParent) === "array") return;

    // Get the new parent's first semantic class for matching
    const newParentClasses = Array.from(primaryNewParent.classList).filter(c => !isHashedClass(c));
    if (newParentClasses.length === 0) return;
    const newParentClassName = newParentClasses[0];

    // Find the "instance root" — the nearest shared ancestor above the old parent
    // This is the repeating unit (e.g., .message-row) that contains both old and new parents
    const oldParentParent = primaryOldParent.parentElement;
    if (!oldParentParent) return;
    const instanceRootShared = getSharedSelector(oldParentParent);
    const instanceRootSelector = instanceRootShared?.selector;

    // Find all instance roots (excluding the primary)
    let otherInstanceRoots: Element[];
    if (instanceRootSelector && instanceRootShared!.count > 1) {
      try {
        otherInstanceRoots = Array.from(document.querySelectorAll(instanceRootSelector))
          .filter(r => r !== oldParentParent && r.isConnected);
      } catch { return; }
    } else {
      // Fallback: find other old parents and use their parentElement as instance root
      try {
        otherInstanceRoots = Array.from(document.querySelectorAll(oldParentShared.selector))
          .filter(p => p !== primaryOldParent && p.isConnected)
          .map(p => p.parentElement!)
          .filter(Boolean);
      } catch { return; }
    }

    for (const instanceRoot of otherInstanceRoots) {
      // Find matching old parent within this instance
      const matchingOldParent = instanceRoot.querySelector(oldParentShared.selector);
      if (!matchingOldParent) continue;

      // Find the matching child as a direct child of the old parent
      const matchingChild = Array.from(matchingOldParent.children).find(c =>
        c.classList.contains(elementClassName)
      ) as HTMLElement | undefined;
      if (!matchingChild) continue;

      // Find the matching new parent — could be the instance root itself or a descendant
      const newParentEscaped = `.${CSS.escape(newParentClassName)}`;
      const matchingNewParent = instanceRoot.matches(newParentEscaped)
        ? instanceRoot
        : instanceRoot.querySelector(newParentEscaped);
      if (!matchingNewParent || matchingNewParent === matchingOldParent) continue;

      // Record in change tracker for persistence across refresh
      const tracker = trackerRef.current;
      if (tracker) {
        const bulkSelector = getSelector(matchingChild);
        const bulkOldParentSelector = getSelector(matchingOldParent);
        const bulkNewParentSelector = getSelector(matchingNewParent);
        const bulkOldIndex = Array.from(matchingOldParent.children).indexOf(matchingChild);
        tracker.track(
          bulkSelector, matchingChild.tagName.toLowerCase(), matchingChild.textContent?.slice(0, 40) || null,
          Array.from(matchingChild.classList), [], { "__reparent": `${bulkOldParentSelector}@${bulkOldIndex}` },
          null, undefined, null, matchingChild.id || null,
          null, null, null, "", null, { x: 0, y: 0, width: 0, height: 0 },
        );
        tracker.ensureOriginalValue(bulkSelector, "__reparent", `${bulkOldParentSelector}@${bulkOldIndex}`);
        tracker.recordChangeSilent(bulkSelector, "__reparent", `${bulkNewParentSelector}@${insertIndex}`);
        // Mark as bulk instance so output formatter consolidates
        tracker.ensureOriginalValue(bulkSelector, "__bulkOf", "");
        tracker.recordChangeSilent(bulkSelector, "__bulkOf", "reparent");
      }

      // Perform the DOM move
      const oldNextSibling = matchingChild.nextElementSibling;
      const newChildren = Array.from(matchingNewParent.children);
      const refChild = insertIndex < newChildren.length ? newChildren[insertIndex] : null;
      if (refChild) {
        matchingNewParent.insertBefore(matchingChild, refChild);
      } else {
        matchingNewParent.appendChild(matchingChild);
      }

      // MutationObserver safety net (same pattern as primary)
      const movedEl = matchingChild;
      const capturedOldParent = matchingOldParent;
      const capturedNewParent = matchingNewParent;
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type !== "childList") continue;
          if (m.target === capturedOldParent) {
            for (const added of m.addedNodes) {
              if (!(added instanceof Element)) continue;
              if (added !== movedEl &&
                  added.tagName === movedEl.tagName &&
                  added.className === movedEl.className &&
                  added.textContent === movedEl.textContent) {
                try { capturedOldParent.removeChild(added); } catch {}
              }
            }
          }
          if (m.target === capturedNewParent) {
            for (const removed of m.removedNodes) {
              if (removed === movedEl && !movedEl.parentElement) {
                try {
                  const cur = Array.from(capturedNewParent.children);
                  const ref = insertIndex < cur.length ? cur[insertIndex] : null;
                  if (ref) capturedNewParent.insertBefore(movedEl, ref);
                  else capturedNewParent.appendChild(movedEl);
                } catch {}
              }
            }
          }
        }
      });
      observer.observe(matchingOldParent, { childList: true });
      observer.observe(matchingNewParent, { childList: true });

      // Store for undo
      reparentDOMRef.current.push({
        element: matchingChild, oldParent: matchingOldParent,
        oldNextSibling, newParent: matchingNewParent, observer,
      });

      // Update tree visual preview
      setReparentEntries(prev => [
        ...prev.filter(r => r.element !== matchingChild),
        { element: matchingChild, newParent: matchingNewParent, insertIndex },
      ]);
    }
  }

  /**
   * Walk up from an element to find the nearest ancestor that has siblings to reorder with.
   * Returns the proxy element (the ancestor that will be reordered) and its parent,
   * or null if no reorderable ancestor is found.
   */
  function findReorderProxy(start: HTMLElement): { proxy: HTMLElement; parent: HTMLElement } | null {
    let current: HTMLElement | null = start;
    while (current) {
      const p: HTMLElement | null = current.parentElement;
      if (!p) return null;
      const siblings = Array.from(p.children);
      if (siblings.length >= 2) {
        return { proxy: current, parent: p };
      }
      current = p;
    }
    return null;
  }

  /** Move selected element (or its reorder proxy) up or down among siblings */
  const handleReorderByKey = useCallback((direction: "up" | "down") => {
    const el = selectedElementRef.current?.element as HTMLElement;
    if (!el?.parentElement) return;

    // Find the reorderable element — either the selected element itself or an ancestor
    const context = findReorderProxy(el);
    if (!context) return;
    const { proxy, parent } = context;
    const children = Array.from(parent.children) as HTMLElement[];

    // Determine reorder mode based on parent layout
    const parentDisplay = getComputedStyle(parent).display;
    const isFlex = parentDisplay === "flex" || parentDisplay === "inline-flex";
    const isGrid = parentDisplay === "grid" || parentDisplay === "inline-grid";
    const mode = (isFlex || isGrid) ? "order" as const : "translate" as const;

    // Initialize on first reorder
    if (!reorderModeRef.current.has(parent)) {
      reorderModeRef.current.set(parent, mode);
    }

    if (mode === "order") {
      ensureExplicitOrder(parent);
    } else {
      ensureOriginalRects(parent);
    }

    // Find proxy's visual position
    const visualOrder = getVisualOrder(parent);
    const visualIndex = visualOrder.indexOf(proxy);
    if (visualIndex === -1) return;

    const newVisualIndex = direction === "up" ? visualIndex - 1 : visualIndex + 1;
    if (newVisualIndex < 0 || newVisualIndex >= visualOrder.length) return;

    const neighbor = visualOrder[newVisualIndex];

    // Record the change using DOM index (stable)
    const domIndex = children.indexOf(proxy);
    const tracker = trackerRef.current;
    if (tracker) {
      const origin = reorderOriginRef.current.get(proxy);
      const proxySelector = origin?.selector ?? getSelector(proxy);
      const originalIndex = origin?.originalIndex ?? domIndex;
      if (!origin) {
        reorderOriginRef.current.set(proxy, { selector: proxySelector, originalIndex: domIndex });
      }

      const inspected = selectedElementRef.current;
      tracker.track(
        proxySelector, proxy.tagName.toLowerCase(), proxy.textContent?.slice(0, 40) || null,
        Array.from(proxy.classList),
        inspected?.reactComponents ?? [], { "__reorder": String(originalIndex) }, inspected?.sourceFile ?? null,
        inspected?.stylingApproach ?? undefined, null, proxy.id || null,
        null, null, null,
        inspected?.domPath ?? "", null, { x: 0, y: 0, width: 0, height: 0 },
      );
      tracker.ensureOriginalValue(proxySelector, "__reorder", String(originalIndex));
      tracker.breakCoalescing();
      tracker.recordChange(proxySelector, "__reorder", String(newVisualIndex));
      tracker.persist();
    }

    // Save previous values for undo
    const undoEntry: ReorderUndoEntry = [
      { element: proxy, prevOrder: proxy.style.order, prevTranslate: proxy.style.translate },
      { element: neighbor, prevOrder: neighbor.style.order, prevTranslate: neighbor.style.translate },
    ];
    reorderStackRef.current.push(undoEntry);
    reorderRedoStackRef.current = [];

    let newVisualOrder: HTMLElement[];
    if (mode === "order") {
      // Swap CSS order values
      const temp = proxy.style.order;
      proxy.style.order = neighbor.style.order;
      neighbor.style.order = temp;
      newVisualOrder = getVisualOrder(parent);
    } else {
      // Swap in the desired visual order array, then recompute all translates
      const desired = reorderVisualOrderRef.current.get(parent);
      if (desired) {
        const idx = desired.indexOf(proxy);
        const neighborIdx = desired.indexOf(neighbor);
        if (idx !== -1 && neighborIdx !== -1) {
          [desired[idx], desired[neighborIdx]] = [desired[neighborIdx], desired[idx]];
          applyTranslateOrder(parent);
        }
        newVisualOrder = [...desired];
      } else {
        newVisualOrder = children;
      }
    }

    // Propagate to all matching parents if scope says so
    const bulkUndo = applyBulkReorder(parent, newVisualOrder);
    if (bulkUndo.length > 0) {
      for (const entry of bulkUndo) {
        undoEntry.push(...entry);
      }
    }

    // Blur to prevent :focus-visible outline on focusable elements (buttons, inputs)
    if (proxy instanceof HTMLElement) proxy.blur();

    syncTrackerStateRef.current();
    refreshSelectedElementRef.current();
    pickerRef.current?.refreshSelection();
    setChangeRevision((r) => r + 1);
  }, []);

  // Tree drag-to-reorder: arbitrary from/to index jumps
  const handleTreeReorder = useCallback((element: Element, fromIndex: number, toIndex: number) => {
    const parent = element.parentElement;
    if (!parent) return;
    const children = Array.from(parent.children) as HTMLElement[];
    const el = element as HTMLElement;

    // Determine reorder mode
    const parentDisplay = getComputedStyle(parent).display;
    const isFlex = parentDisplay === "flex" || parentDisplay === "inline-flex";
    const isGrid = parentDisplay === "grid" || parentDisplay === "inline-grid";
    const mode = (isFlex || isGrid) ? "order" as const : "translate" as const;

    if (!reorderModeRef.current.has(parent)) {
      reorderModeRef.current.set(parent, mode);
    }

    if (mode === "order") {
      ensureExplicitOrder(parent);
    } else {
      ensureOriginalRects(parent);
    }

    // Track via __reorder pseudo-property
    const domIndex = children.indexOf(el);
    const tracker = trackerRef.current;
    if (tracker) {
      const origin = reorderOriginRef.current.get(el);
      const proxySelector = origin?.selector ?? getSelector(el);
      const originalIndex = origin?.originalIndex ?? domIndex;
      if (!origin) {
        reorderOriginRef.current.set(el, { selector: proxySelector, originalIndex: domIndex });
      }

      const inspected = selectedElementRef.current;
      tracker.track(
        proxySelector, el.tagName.toLowerCase(), el.textContent?.slice(0, 40) || null,
        Array.from(el.classList),
        inspected?.reactComponents ?? [], { "__reorder": String(originalIndex) }, inspected?.sourceFile ?? null,
        inspected?.stylingApproach ?? undefined, null, el.id || null,
        null, null, null,
        inspected?.domPath ?? "", null, { x: 0, y: 0, width: 0, height: 0 },
      );
      tracker.ensureOriginalValue(proxySelector, "__reorder", String(originalIndex));
      tracker.breakCoalescing();
      tracker.recordChange(proxySelector, "__reorder", String(toIndex));
      tracker.persist();
    }

    // Save ALL children's state for undo (multi-position jump affects intermediate elements)
    const undoEntry: ReorderUndoEntry = children.map(c => ({
      element: c,
      prevOrder: c.style.order,
      prevTranslate: c.style.translate,
    }));
    reorderStackRef.current.push(undoEntry);
    reorderRedoStackRef.current = [];

    let newVisualOrder: HTMLElement[];
    if (mode === "order") {
      // Splice visual order array and reassign all order values
      const visualOrder = getVisualOrder(parent);
      const [moved] = visualOrder.splice(fromIndex, 1);
      visualOrder.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);
      for (let i = 0; i < visualOrder.length; i++) {
        visualOrder[i].style.order = String(i);
      }
      newVisualOrder = visualOrder;
    } else {
      // Splice in desired order array and recompute translates
      const desired = reorderVisualOrderRef.current.get(parent);
      if (desired) {
        const [moved] = desired.splice(fromIndex, 1);
        desired.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);
        applyTranslateOrder(parent);
        newVisualOrder = [...desired];
      } else {
        newVisualOrder = children;
      }
    }

    // Propagate to all matching parents if scope says so
    const bulkUndo = applyBulkReorder(parent, newVisualOrder);
    if (bulkUndo.length > 0) {
      // Merge bulk undo entries into the existing undo entry
      for (const entry of bulkUndo) {
        undoEntry.push(...entry);
      }
    }

    if (el instanceof HTMLElement) el.blur();

    syncTrackerStateRef.current();
    refreshSelectedElementRef.current();
    pickerRef.current?.refreshSelection();
    setChangeRevision((r) => r + 1);
  }, []);

  // Tree drag-to-reparent: actual DOM move with MutationObserver safety net
  const handleTreeReparent = useCallback((element: Element, newParent: Element, insertIndex: number) => {
    const tracker = trackerRef.current;
    if (!tracker) return;

    const el = element as HTMLElement;
    const oldParent = el.parentElement;
    if (!oldParent || oldParent === newParent) return;

    // Track how many reparent entries exist before this operation (for bulk undo)
    const reparentCountBefore = reparentDOMRef.current.length;

    const elementSelector = getSelector(el);
    const oldParentSelector = getSelector(oldParent);
    const newParentSelector = getSelector(newParent);

    // Store original DOM state for undo/reset
    const oldNextSibling = el.nextElementSibling;
    const oldSiblings = Array.from(oldParent.children);
    const oldIndex = oldSiblings.indexOf(el);

    // Track in change tracker
    const fromValue = `${oldParentSelector}@${oldIndex}`;
    const toValue = `${newParentSelector}@${insertIndex}`;

    const inspected = selectedElementRef.current;
    tracker.track(
      elementSelector, el.tagName.toLowerCase(), el.textContent?.slice(0, 40) || null,
      Array.from(el.classList),
      inspected?.reactComponents ?? [], { "__reparent": fromValue }, inspected?.sourceFile ?? null,
      inspected?.stylingApproach ?? undefined, null, el.id || null,
      null, null, null,
      inspected?.domPath ?? "", null, { x: 0, y: 0, width: 0, height: 0 },
    );
    tracker.ensureOriginalValue(elementSelector, "__reparent", fromValue);
    tracker.breakCoalescing();
    tracker.recordChange(elementSelector, "__reparent", toValue);
    tracker.persist();

    // ── Perform actual DOM move ──
    const newChildren = Array.from(newParent.children);
    const refChild = insertIndex < newChildren.length ? newChildren[insertIndex] : null;
    if (refChild) {
      newParent.insertBefore(el, refChild);
    } else {
      newParent.appendChild(el);
    }

    // ── MutationObserver safety net ──
    // Watch old parent: if React recreates the element (duplicate), remove the duplicate
    // Watch new parent: if React removes our moved element, re-insert it
    const movedEl = el;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== "childList") continue;

        // Check old parent for duplicates — React recreated the "missing" child
        if (m.target === oldParent) {
          for (const added of m.addedNodes) {
            if (!(added instanceof Element)) continue;
            // Detect duplicate: same tag, same classes, same text content
            if (added !== movedEl &&
                added.tagName === movedEl.tagName &&
                added.className === movedEl.className &&
                added.textContent === movedEl.textContent) {
              // This is a React-created duplicate — remove it
              try { oldParent.removeChild(added); } catch {}
            }
          }
        }

        // Check new parent: if React removed our moved element, re-insert it
        if (m.target === newParent) {
          for (const removed of m.removedNodes) {
            if (removed === movedEl && !movedEl.parentElement) {
              // React removed our element — put it back
              try {
                const currentChildren = Array.from(newParent.children);
                const ref = insertIndex < currentChildren.length ? currentChildren[insertIndex] : null;
                if (ref) {
                  newParent.insertBefore(movedEl, ref);
                } else {
                  newParent.appendChild(movedEl);
                }
              } catch {}
            }
          }
        }
      }
    });
    observer.observe(oldParent, { childList: true });
    observer.observe(newParent, { childList: true });

    // Store for undo/reset
    reparentDOMRef.current.push({ element: el, oldParent, oldNextSibling, newParent, observer });

    // Update tree visual preview
    setReparentEntries(prev => [...prev.filter(r => r.element !== element), { element, newParent, insertIndex }]);

    // Propagate to matching instances if scope says so
    applyBulkReparent(el, oldParent, newParent, insertIndex);

    // Store how many reparent entries this operation created (for bulk undo)
    const reparentCountAfter = reparentDOMRef.current.length;
    reparentBatchSizeRef.current.push(reparentCountAfter - reparentCountBefore);

    syncTrackerStateRef.current();
    refreshSelectedElementRef.current();
    pickerRef.current?.refreshSelection();
    setChangeRevision((r) => r + 1);
  }, []);

  // Hotkey listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (matchesToggleHotkey(e, config.hotkey)) {
        e.preventDefault();
        toggleOverlay();
      }
      if (active && (e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (active && (e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      // Arrow key reorder for flow elements in containers
      // Up/Down for vertical layouts, Left/Right for horizontal (flex-direction: row)
      // Uses reorder proxy: if selected element has no siblings, walks up to find a reorderable ancestor
      if (active && selectedElementRef.current && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const path = e.composedPath();
        const target = path[0] as HTMLElement;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

        const el = selectedElementRef.current.element as HTMLElement;
        const context = findReorderProxy(el);
        if (!context) return;
        const { parent } = context;

        // Determine layout mode and axis based on proxy's parent
        const parentDisplay = getComputedStyle(parent).display;
        const isFlex = parentDisplay === "flex" || parentDisplay === "inline-flex";
        const isGrid = parentDisplay === "grid" || parentDisplay === "inline-grid";

        const isHorizontalKey = e.key === "ArrowLeft" || e.key === "ArrowRight";
        const isVerticalKey = e.key === "ArrowUp" || e.key === "ArrowDown";
        const parentDirection = getComputedStyle(parent).flexDirection;
        const isHorizontalLayout = isFlex && (parentDirection === "row" || parentDirection === "row-reverse");

        // Block layout: only vertical reorder (Up/Down)
        if (!isFlex && !isGrid && isHorizontalKey) return;
        // Flex/grid: skip if axis doesn't match
        if (isHorizontalKey && !isHorizontalLayout) return;
        if (isVerticalKey && isHorizontalLayout) return;

        e.preventDefault();
        e.stopPropagation();
        const goBack = e.key === "ArrowUp" || e.key === "ArrowLeft";
        handleReorderByKey(goBack ? "up" : "down");
      }

      // Element navigation: Shift+Enter=parent, Enter=child, Tab=next sibling, Shift+Tab=prev sibling
      if (active && selectedElementRef.current && (e.key === "Enter" || e.key === "Tab")) {
        const path = e.composedPath();
        const target = path[0] as HTMLElement;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

        const el = selectedElementRef.current.element;
        const picker = pickerRef.current;
        if (!picker) return;

        if (e.key === "Enter" && e.shiftKey) {
          // Shift+Enter: select parent
          const parent = el.parentElement;
          if (parent && parent !== document.body) {
            e.preventDefault();
            e.stopPropagation();
            picker.selectElement(parent);
          }
        } else if (e.key === "Enter" && !e.shiftKey) {
          // Enter: select first visible child
          const children = Array.from(el.children).filter(c =>
            !c.hasAttribute("data-retune-host") &&
            c.tagName !== "SCRIPT" && c.tagName !== "STYLE" && c.tagName !== "LINK"
          );
          if (children.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            picker.selectElement(children[0]);
          }
        } else if (e.key === "Tab") {
          // Tab / Shift+Tab: cycle siblings
          const parent = el.parentElement;
          if (!parent) return;
          const siblings = Array.from(parent.children).filter(c =>
            !c.hasAttribute("data-retune-host") &&
            c.tagName !== "SCRIPT" && c.tagName !== "STYLE" && c.tagName !== "LINK"
          );
          if (siblings.length < 2) return;
          const idx = siblings.indexOf(el);
          if (idx === -1) return;
          const next = e.shiftKey
            ? siblings[(idx - 1 + siblings.length) % siblings.length]
            : siblings[(idx + 1) % siblings.length];
          e.preventDefault();
          e.stopPropagation();
          picker.selectElement(next);
        }
        return;
      }

      // Delete selected element
      if (active && selectedElementRef.current && (e.key === "Delete" || e.key === "Backspace")) {
        // Don't intercept if focus is in a text input inside Retune's shadow root
        const path = e.composedPath();
        const target = path[0] as HTMLElement;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
        e.stopPropagation();
        handleDelete();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [active, config.hotkey, toggleOverlay, handleUndo, handleRedo, handleDelete, handleReorderByKey]);

  const handleReset = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    // Re-insert all deleted elements
    while (deleteStackRef.current.length > 0) {
      const entry = deleteStackRef.current.pop()!;
      try {
        if (entry.nextSibling) {
          entry.parent.insertBefore(entry.element, entry.nextSibling);
        } else {
          entry.parent.appendChild(entry.element);
        }
      } catch {
        // DOM references may be stale after hot reload — skip silently
      }
    }
    deleteRedoStackRef.current = [];
    // Restore all text edits
    while (textStackRef.current.length > 0) {
      const entry = textStackRef.current.pop()!;
      try { entry.element.innerHTML = entry.originalHTML; } catch {}
    }
    textRedoStackRef.current = [];
    // Revert all reorders — restore original CSS order/translate values
    reorderStackRef.current = [];
    reorderRedoStackRef.current = [];
    for (const [, originals] of reorderOriginalOrderRef.current) {
      for (const [child, originalOrder] of originals) {
        const el = child as HTMLElement;
        if (originalOrder) {
          el.style.order = originalOrder;
        } else {
          el.style.removeProperty("order");
        }
      }
    }
    reorderOriginalOrderRef.current.clear();
    // Clean up translate-based reorder
    for (const [, rects] of reorderOriginalRectsRef.current) {
      for (const [child] of rects) {
        const el = child as HTMLElement;
        el.style.removeProperty("translate");
        el.style.removeProperty("transition");
        if (el.getAttribute("style")?.trim() === "") el.removeAttribute("style");
      }
    }
    reorderOriginalRectsRef.current.clear();
    reorderVisualOrderRef.current.clear();
    reorderModeRef.current = new WeakMap();
    reorderObserverRef.current?.disconnect();
    reorderOriginRef.current = new WeakMap();
    // Restore reparented elements to their original parents
    for (const entry of reparentDOMRef.current) {
      entry.observer.disconnect();
      try {
        if (entry.oldNextSibling && entry.oldNextSibling.parentElement === entry.oldParent) {
          entry.oldParent.insertBefore(entry.element, entry.oldNextSibling);
        } else {
          entry.oldParent.appendChild(entry.element);
        }
      } catch {}
    }
    reparentDOMRef.current = [];
    setReparentEntries([]);
    // Clean up forced pseudo-state inline styles before clearing
    if (forcedStateRef.current) clearForcedInlineStyles();
    preview.clearAll();
    tracker.clear();
    // Clear comments
    commentStoreRef.current.clear();
    syncCommentState();
    // Reset compound selector state
    // Reset to default scope level (narrowest class level)
    const levels = scopeLevelsRef.current;
    const defaultIdx = levels.length >= 2 ? levels.length - 2 : 0;
    setActiveLevelIndex(defaultIdx);
    activeLevelIndexRef.current = defaultIdx;
    syncTrackerState();
    setChangeRevision((r) => r + 1);
    setResetRevision((r) => r + 1);
    // Re-track the currently selected element so future changes are recorded
    const el = selectedElementRef.current;
    if (el) {
      tracker.track(
        el.selector, el.tagName, el.textContent, el.classes,
        el.reactComponents, el.computedStyles, el.sourceFile,
        el.stylingApproach, el.inlineStyles, el.elementId,
        el.accessibleName, el.parentContext, el.childSummary,
        el.domPath, el.nearbySiblings, el.position,
      );
    }
    // Defer selection refresh so element positions settle after order/translate removal
    requestAnimationFrame(() => {
      refreshSelectedElement();
      pickerRef.current?.refreshSelection();
    });
  }, [syncTrackerState, refreshSelectedElement, clearForcedInlineStyles]);

  /** Migrate preview + tracker changes between selectors, including pseudo-state variants. */
  const migrateSelector = useCallback((fromSelector: string, toSelector: string) => {
    const preview = previewRef.current;
    const tracker = trackerRef.current;
    if (!preview || !tracker || fromSelector === toSelector) return;

    preview.migrateChanges(fromSelector, toSelector);
    tracker.migrateChanges(fromSelector, toSelector);

    const pseudoStates: ForcedState[] = [":hover", ":focus", ":active"];
    for (const ps of pseudoStates) {
      preview.migrateChanges(fromSelector + ps, toSelector + ps);
      tracker.migrateChanges(fromSelector + ps, toSelector + ps);
    }

    if (forcedStylesRef.current.selector === fromSelector) {
      forcedStylesRef.current.selector = toSelector;
    }

    syncTrackerState();
    setChangeRevision((r) => r + 1);
  }, [syncTrackerState]);

  /** Select a scope level from the target rail. */
  const handleScopeLevelChange = useCallback((index: number) => {
    const tracker = trackerRef.current;
    const el = selectedElementRef.current;
    const levels = scopeLevelsRef.current;
    if (!tracker || !el || index < 0 || index >= levels.length) return;

    const oldIndex = activeLevelIndexRef.current;
    // Clicking the active pill deselects it — move to the previous level
    if (index === oldIndex && index > 0) {
      index = index - 1;
    } else if (index === oldIndex) {
      return;
    }

    const oldSelector = levels[oldIndex]?.selector ?? el.selector;
    const newSelector = levels[index]?.selector ?? el.selector;

    // Track the new selector BEFORE migration
    tracker.track(
      newSelector, el.tagName, el.textContent, el.classes,
      el.reactComponents, el.computedStyles, el.sourceFile,
      el.stylingApproach, el.inlineStyles, el.elementId,
      el.accessibleName, el.parentContext, el.childSummary,
      el.domPath, el.nearbySiblings, el.position,
    );

    migrateSelector(oldSelector, newSelector);

    activeLevelIndexRef.current = index;
    setActiveLevelIndex(index);

    // Eagerly update activeSelectorRef so refreshSelectedElement reads the new scope
    activeSelectorRef.current = newSelector;

    // Update ownedProperties immediately (can't wait for render since activeSelector is derived)
    const isParentScoped = newSelector && newSelector.includes(' ');
    if (newSelector && el.element && !isParentScoped) {
      const scoped = getScopedStyles(el.element, newSelector);
      setOwnedProperties(scoped.ownedProperties);
    } else {
      setOwnedProperties(undefined);
    }

    // Skip the ownedProperties update in refreshSelectedElement — we just set it with the correct scope
    skipOwnedUpdateRef.current = true;
    if (forcedStateRef.current) syncForcedInlineStyles();
    refreshSelectedElement();

    // Show scope highlights for the newly active level
    const newLevel = levels[index];
    if (newLevel?.selector && pickerRef.current) {
      pickerRef.current.showScopeHighlights(
        newLevel.selector,
        el.element ?? null,
      );
    } else {
      pickerRef.current?.hideScopeHighlights();
    }
  }, [migrateSelector, syncForcedInlineStyles, refreshSelectedElement]);

  /** Show/hide dotted outlines on all elements matching a scope level's selector.
   *  On pointer leave (index=null), revert to showing the active scope's highlights. */
  const handleScopeLevelHover = useCallback((index: number | null) => {
    const picker = pickerRef.current;
    if (!picker) return;

    if (index === null) {
      // Revert to active scope highlights instead of hiding
      const levels = scopeLevelsRef.current;
      const activeLevel = levels[activeLevelIndexRef.current];
      if (activeLevel?.selector) {
        picker.showScopeHighlights(
          activeLevel.selector,
          selectedElementRef.current?.element ?? null,
        );
      } else {
        picker.hideScopeHighlights();
      }
      return;
    }

    const levels = scopeLevelsRef.current;
    const level = levels[index];
    if (!level || level.selector === null) {
      picker.hideScopeHighlights();
      return;
    }

    picker.showScopeHighlights(
      level.selector,
      selectedElementRef.current?.element ?? null,
    );
  }, []);

  const handleCopy = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    navigator.clipboard.writeText(formatChanges(tracker.getPendingChanges(), fidelity, commentStoreRef.current.getAll(), manifestDataRef.current));
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 3000);
  }, [fidelity]);

  const handleClose = useCallback(() => {
    deactivateOverlay();
  }, [deactivateOverlay]);

  // Expose global API for external agents (MCP, Claude Code, Cursor, etc.)
  useEffect(() => {
    const api = {
      getChanges: () => trackerRef.current?.getPendingChanges() ?? [],
      getFormattedChanges: (f?: Fidelity) =>
        formatChanges(trackerRef.current?.getPendingChanges() ?? [], f ?? fidelityRef.current, commentStoreRef.current.getAll(), manifestDataRef.current),
      clearChanges: () => {
        const tracker = trackerRef.current;
        const preview = previewRef.current;
        if (!tracker || !preview) return;
        // Clean up forced pseudo-state inline styles
        if (forcedStateRef.current) {
          const f = forcedStylesRef.current;
          const domEl = selectedElementRef.current?.element as HTMLElement | undefined;
          if (domEl?.style && f.props.length > 0) {
            for (const p of f.props) {
              const k = p.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
              domEl.style.removeProperty(k);
            }
            if (domEl.getAttribute('style')?.trim() === '') {
              domEl.removeAttribute('style');
            }
          }
          forcedStylesRef.current = { selector: "", props: [] };
          setForcedState(null);
          forcedStateRef.current = null;
        }
        preview.clearAll();
        tracker.clear();
        syncTrackerStateRef.current();
        setChangeRevision((r) => r + 1);
        const el = selectedElementRef.current;
        if (el) {
          tracker.track(
            el.selector, el.tagName, el.textContent, el.classes,
            el.reactComponents, el.computedStyles, el.sourceFile,
            el.stylingApproach, el.inlineStyles, el.elementId,
            el.accessibleName, el.parentContext, el.childSummary,
            el.domPath, el.nearbySiblings, el.position,
          );
        }
        refreshSelectedElementRef.current();
      },
    };
    (window as any).__retune = api;
    return () => { delete (window as any).__retune; };
  }, []);

  // Keep hotkey listener alive even when hidden so toggle hotkeys can bring it back
  useEffect(() => {
    if (!sessionHidden) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (matchesToggleHotkey(e, config.hotkey)) {
        e.preventDefault();
        setSessionHidden(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sessionHidden, config.hotkey]);

  if (!portalTarget) return null;

  if (sessionHidden) return null;

  return createPortal(
    <PreviewBridgeContext.Provider value={previewBridgeRef.current}>
    <TooltipPortalContext.Provider value={portalTarget}>
      {/* Floating toolbar */}
      <div
        ref={toolbarRef}
        className={`retune-toolbar bottom ${side} ${active ? "expanded" : "collapsed"}`}
        onPointerDown={handleToolbarPointerDown}
        onPointerMove={handleToolbarPointerMove}
        onPointerUp={handleToolbarPointerUp}
      >
        {/* Collapsed: single activate button */}
        <Tooltip content="Toggle edit mode" shortcut={formatToggleHotkeyShortcut(config.hotkey)} side="top">
          <button
            className="retune-toolbar-collapse-btn"
            onClick={activateOverlay}
          >
            <RetuneLogo size={20} />
            {!active && changeCount > 0 && <span className="retune-changes-dot" />}
          </button>
        </Tooltip>

        {/* Expanded: count + separator + mode + actions */}
        <div className="retune-toolbar-expanded">
          {(changeCount > 0 || commentCount > 0) && (
            <div className="retune-edit-count">{changeCount + commentCount}</div>
          )}
          {(changeCount > 0 || commentCount > 0) && (
            <div className="retune-toolbar-divider" />
          )}
          <Tooltip content="Edit mode" shortcut="V" side="top">
            <button
              className={`retune-toolbar-btn${mode === "edit" ? " active" : ""}`}
              onClick={() => { setMode("edit"); setCommentDraft(null); setActiveCommentId(null); popoverOpenRef.current = false; }}
            >
              <IconCursor1 size={20} />
            </button>
          </Tooltip>
          <Tooltip content="Comment mode" shortcut="C" side="top">
            <button
              className={`retune-toolbar-btn${mode === "comment" ? " active" : ""}`}
              onClick={() => { setMode("comment"); setSelectedElement(null); }}
            >
              <IconComment size={20} />
            </button>
          </Tooltip>
          <Tooltip content="Copy changes" shortcut="⌘C" side="top">
            <button
              className={`retune-toolbar-btn${changeCount === 0 && commentCount === 0 ? " disabled" : ""}`}
              onClick={handleCopy}
              disabled={changeCount === 0 && commentCount === 0}
            >
              <span className="retune-icon-swap">
                <span className={`retune-icon-swap-icon ${copied ? "out" : "in"}`}>
                  <IconSquareBehindSquare6 size={20} />
                </span>
                <span className={`retune-icon-swap-icon ${copied ? "in" : "out"}`}>
                  <IconCheckCircle2 size={20} />
                </span>
              </span>
            </button>
          </Tooltip>
          <Tooltip content="Reset all" side="top">
            <button
              className={`retune-toolbar-btn${changeCount === 0 && commentCount === 0 ? " disabled" : ""}`}
              onClick={handleReset}
              disabled={changeCount === 0 && commentCount === 0}
            >
              <IconBroom size={20} />
            </button>
          </Tooltip>
          <Tooltip content="Settings" side="top">
            <button
              className="retune-toolbar-btn"
              onClick={() => {
                if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
                if (!settingsOpen) {
                  setSettingsOpen(true);
                  setSettingsVisible(true);
                  setSettingsExiting(false);
                } else {
                  setSettingsOpen(false);
                  setSettingsExiting(true);
                  settingsTimerRef.current = setTimeout(() => {
                    setSettingsVisible(false);
                    setSettingsExiting(false);
                  }, 250);
                }
              }}
            >
              <IconSettingsGear2 size={20} />
            </button>
          </Tooltip>
          <Tooltip content="Close" shortcut="Esc" side="top">
            <button
              className="retune-toolbar-btn"
              onClick={handleClose}
            >
              <IconCrossMedium size={20} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Design panel */}
      <AnimatedPanel visible={!!(active && selectedElement && !settingsOpen && !toolbarDragging && mode === "edit")}>
        <div className={`retune-panel ${side}`}>
          <div className="retune-tab-bar" ref={tabBarRef}>
            <div className="retune-tab-pill" ref={tabPillRef} />
            <button className={`retune-tab${panelTab === "elements" ? " active" : ""}`} onClick={() => setPanelTab("elements")}>Elements</button>
            <button className={`retune-tab${panelTab === "design" ? " active" : ""}`} onClick={() => setPanelTab("design")}>Design</button>
            <span
              onClick={() => { if (updateInfo && updateDismissed) { setUpdateDismissed(false); } }}
              style={{ marginLeft: "auto", fontSize: "11px", lineHeight: "16px", color: "var(--retune-text-tertiary)", letterSpacing: "-0.005em", paddingRight: "8px", display: "flex", alignItems: "center", gap: "4px", cursor: updateInfo ? "pointer" : "default" }}
            >
              {updateInfo && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--retune-blue)", flexShrink: 0 }} />}
              v{updateInfo?.current || (typeof __RETUNE_VERSION__ === "string" ? __RETUNE_VERSION__ : "")}
            </span>
          </div>
          <div className="retune-panel-body">
            <PanelBanner
              visible={!!updateInfo && !updateDismissed}
              title={`Retune v${updateInfo?.latest || ""} is available`}
              body=""
              copyLabel="Copy update instructions"
              copiedLabel="Paste in your AI agent to update"
              copyText="Update Retune to the latest version by running `npm install retune@latest` and `npx retune setup`. After updating, I'll need to restart Claude Code so the new MCP server and skill take effect."
              revertAfter={3000}
              onDismiss={() => setUpdateDismissed(true)}
            />
            {panelTab === "elements" && (
              <ElementTree
                selectedElement={selectedElement?.element ?? null}
                onSelect={handleTreeSelect}
                onHover={handleTreeHover}
                visualOrderMap={visualOrderMap}
                reparentEntries={reparentEntries}
                onTreeReorder={handleTreeReorder}
                onTreeReparent={handleTreeReparent}
              />
            )}
            {panelTab === "design" && selectedElement && (
              <>
              {/* Manifest banner — no manifest: shows on any element */}
              <PanelBanner
                visible={manifestCheckedRef.current && !manifestLoadedRef.current && !manifestBannerDismissed}
                title="Unlock your design system"
                body="Apply your project's actual tokens, color palettes, and component variants directly."
                copyLabel="Copy instructions"
                copiedLabel="Paste in your AI agent"
                copyText={MANIFEST_PROMPT_TEXT}
                onDismiss={() => setManifestBannerDismissed(true)}
                onCopy={() => {
                  const delays = [10000, 30000, 60000, 120000, 180000, 300000];
                  for (const d of delays) {
                    setTimeout(() => { if (!manifestLoadedRef.current) tryLoadManifest(); }, d);
                  }
                }}
              />
              {/* Manifest banner — partial (tokens but no components key): shows when component selected */}
              <PanelBanner
                visible={!!selectedElement.reactProps && !!manifest && !("components" in manifest) && !manifestBannerDismissed}
                title="Know your components"
                body="See every variant, size, and state your components support and switch between them."
                copyLabel="Copy instructions"
                copiedLabel="Paste in your AI agent"
                copyText={MANIFEST_COMPONENTS_PROMPT}
                onDismiss={() => setManifestBannerDismissed(true)}
                onCopy={() => {
                  const delays = [10000, 30000, 60000, 120000, 180000, 300000];
                  for (const d of delays) {
                    setTimeout(() => { if (!manifestLoadedRef.current) tryLoadManifest(); }, d);
                  }
                }}
              />
              <ComponentSection
                selectedElement={selectedElement}
                manifest={manifest}
                resetRevision={resetRevision}
                onRefresh={() => refreshSelectedElementRef.current()}
                onPropChange={(propName, newValue) => {
                  const tracker = trackerRef.current;
                  if (!tracker) return;
                  const el = selectedElement;
                  // Ensure element is tracked with reactProps so prop changes can be recorded
                  tracker.track(
                    el.selector, el.tagName, el.textContent, el.classes,
                    el.reactComponents, el.computedStyles, el.sourceFile,
                    el.stylingApproach, el.inlineStyles, el.elementId,
                    el.accessibleName, el.parentContext, el.childSummary,
                    el.domPath, el.nearbySiblings, el.position,
                    el.reactProps,
                  );
                  tracker.recordPropChange(el.selector, propName, newValue);
                  syncTrackerState();
                  setChangeRevision(r => r + 1);
                  // Recompute scope levels if class_map changed element classes
                  const comp = manifest?.components?.[el.reactComponents[0]];
                  if (comp?.props?.[propName]?.class_map) {
                    const candidates = getSelectorCandidates(el.element);
                    setSelectorCandidates(candidates);
                    const ancestors = getAncestorScopes(el.element);
                    const levels = buildScopeLevels(candidates, el.element, ancestors, manifestDataRef.current);
                    setScopeLevels(levels);
                    scopeLevelsRef.current = levels;
                  }
                }}
                changedProps={(() => {
                  const tracker = trackerRef.current;
                  if (!tracker || !selectedElement) return undefined;
                  const changed = new Set<string>();
                  const entry = tracker.getPendingChanges().find(c => c.selector === selectedElement.selector);
                  if (entry?.propChanges) {
                    for (const pc of entry.propChanges) changed.add(pc.prop);
                  }
                  return changed.size > 0 ? changed : undefined;
                })()}
                onPropReset={(propName) => {
                  const tracker = trackerRef.current;
                  if (!tracker) return;
                  tracker.resetProp(selectedElement.selector, propName);
                  syncTrackerState();
                  setChangeRevision(r => r + 1);
                  // Recompute scope levels if class_map changed
                  const comp = manifest?.components?.[selectedElement.reactComponents[0]];
                  if (comp?.props?.[propName]?.class_map) {
                    const candidates = getSelectorCandidates(selectedElement.element);
                    setSelectorCandidates(candidates);
                    const ancestors = getAncestorScopes(selectedElement.element);
                    const levels = buildScopeLevels(candidates, selectedElement.element, ancestors, manifestDataRef.current);
                    setScopeLevels(levels);
                    scopeLevelsRef.current = levels;
                  }
                }}
              />
              <PropertyPanel
                key={selectedElement.selector}
                element={selectedElement}
                position={side}
                onPropertyChange={handlePropertyChange}
                onAttributeChange={(attr, oldValue, newValue) => {
                  const tracker = trackerRef.current;
                  if (!tracker || !selectedElement) return;
                  const el = selectedElement;
                  tracker.track(
                    el.selector, el.tagName, el.textContent, el.classes,
                    el.reactComponents, el.computedStyles, el.sourceFile,
                    el.stylingApproach, el.inlineStyles, el.elementId,
                    el.accessibleName, el.parentContext, el.childSummary,
                    el.domPath, el.nearbySiblings, el.position,
                  );
                  tracker.recordAttributeChange(el.selector, attr, oldValue, newValue);
                  syncTrackerState();
                  setChangeRevision(r => r + 1);
                }}
                onPropertyHover={setHoveredBoxModel}
                onApplyToElement={handleApplyToElement}
                onVariableSwap={handleVariableSwap}
                onVariableAssociate={handleVariableAssociate}
                onVariableUnlink={handleVariableUnlink}
                variableAssociations={selectedVariableAssociations}
                unlinkedVariables={selectedUnlinkedVariables}
                changedProperties={selectedChangedProperties}
                onPropertyReset={handlePropertyReset}
                selectorCandidates={selectorCandidates}
                activeSelector={activeSelector}
                scopeLevels={scopeLevels}
                activeLevelIndex={activeLevelIndex}
                onScopeLevelChange={handleScopeLevelChange}
                onScopeLevelHover={handleScopeLevelHover}
                ownedProperties={ownedProperties}
                styleSources={styleSources}
                forcedState={forcedState}
                onForcedStateChange={handleForcedStateChange}
                onPinLinesChange={(authored) => pickerRef.current?.updatePinLines(authored)}
              />
              </>
            )}
          </div>
        </div>
      </AnimatedPanel>

      {/* Settings panel — overlays on top of design panel */}
      {active && settingsVisible && !toolbarDragging && (
        <SettingsPanel
          side={side}
          theme={theme}
          onThemeChange={handleThemeChange}
          fidelity={fidelity}
          onFidelityChange={setFidelity}
          onHide={() => { setSettingsOpen(false); setSettingsVisible(false); setSettingsExiting(false); deactivateOverlay(); setSessionHidden(true); }}
          exiting={settingsExiting}
        />
      )}

      {/* Box model visualization overlay */}
      {active && selectedElement && hoveredBoxModel && (
        <BoxModelOverlay
          element={selectedElement.element}
          hoveredProperty={hoveredBoxModel}
          revision={changeRevision}
        />
      )}

      {/* Comment markers (visible in both modes) */}
      {active && comments.map((c, idx) => (
        <CommentMarker key={c.id} comment={c} index={idx} isPopoverOpen={activeCommentId === c.id}
          isAreaResize={c.type === "area" && !!c.area}
          onAreaResizeLive={c.type === "area" && c.area ? (newPos) => {
            setAreaResizeLive({ id: c.id, br: newPos });
          } : undefined}
          onAreaResize={c.type === "area" && c.area ? (newPos) => {
            setAreaResizeLive(null);
            const store = commentStoreRef.current;
            const comment = store.get(c.id);
            if (!comment || !comment.area) return;
            const area = comment.area;
            comment.area = {
              x: area.x,
              y: area.y,
              width: Math.max(20, newPos.x - area.x),
              height: Math.max(20, newPos.y - area.y),
            };
            comment.position = newPos;
            // Re-scan contained elements
            const newArea = comment.area;
            const contained: Array<{ tagName: string; selector: string; componentName: string | null; textContent: string | null }> = [];
            const step = 20;
            const seen = new Set<Element>();
            for (let x = newArea.x + step / 2; x < newArea.x + newArea.width; x += step) {
              for (let y = newArea.y + step / 2; y < newArea.y + newArea.height; y += step) {
                const el = document.elementFromPoint(x, y);
                if (el && !seen.has(el) && !el.closest?.("[data-retune-host]")) {
                  seen.add(el);
                  contained.push({
                    tagName: el.tagName.toLowerCase(),
                    selector: getQuickSelector(el),
                    componentName: getQuickComponentName(el),
                    textContent: (el.textContent || "").slice(0, 40).trim() || null,
                  });
                }
              }
            }
            if (comment.elementInfo) (comment.elementInfo as any).containedElements = contained;
            store.persist();
            syncCommentState();
          } : undefined}
          onOpen={() => {
          popoverOpenRef.current = true; popoverTextRef.current = c.text; popoverInitialTextRef.current = c.text;
          setActiveCommentId(c.id);
          setCommentDraft(null);
        }} />
      ))}

      {/* Area outlines for area comments */}
      {active && comments.filter(c => c.type === "area" && c.area).map(c => (
        <AreaOutline
          key={`area-${c.id}`}
          comment={c}
          interactive={true}
          liveBR={areaResizeLive?.id === c.id ? areaResizeLive.br : undefined}
          onResize={(newArea) => {
            const store = commentStoreRef.current;
            const updated = store.get(c.id);
            if (!updated) return;
            updated.area = newArea;
            // Re-scan contained elements
            const contained: Array<{ tagName: string; selector: string; componentName: string | null; textContent: string | null }> = [];
            const step = 20;
            const seen = new Set<Element>();
            for (let x = newArea.x + step / 2; x < newArea.x + newArea.width; x += step) {
              for (let y = newArea.y + step / 2; y < newArea.y + newArea.height; y += step) {
                const el = document.elementFromPoint(x, y);
                if (el && !seen.has(el) && !el.closest?.("[data-retune-host]")) {
                  seen.add(el);
                  contained.push({
                    tagName: el.tagName.toLowerCase(),
                    selector: getQuickSelector(el),
                    componentName: getQuickComponentName(el),
                    textContent: (el.textContent || "").slice(0, 40).trim() || null,
                  });
                }
              }
            }
            if (updated.elementInfo) {
              (updated.elementInfo as any).containedElements = contained;
            }
            store.persist();
            syncCommentState();
          }}
        />
      ))}

      {/* Draft area outline (visible while popover is open for a new area comment) */}
      {active && commentDraft?.type === "area" && commentDraft.area && (
        <div
          className="retune-comment-area-outline"
          style={{
            left: commentDraft.area.x,
            top: commentDraft.area.y,
            width: commentDraft.area.width,
            height: commentDraft.area.height,
          }}
        />
      )}

      {/* Comment popover for new comment draft */}
      {active && mode === "comment" && commentDraft && !activeCommentId && (
        <CommentPopover
          position={commentDraft.position}
          initialText=""
          onTextChange={(t) => { popoverTextRef.current = t; }}
          onSubmit={(text) => {
            const store = commentStoreRef.current;
            store.add(text, commentDraft.position, commentDraft.type, {
              selector: commentDraft.selector,
              anchorOffset: commentDraft.anchorOffset,
              area: commentDraft.area,
              areaScroll: commentDraft.areaScroll,
              elementInfo: commentDraft.elementInfo,
            });
            syncCommentState();
            popoverOpenRef.current = false;
            setCommentDraft(null);
          }}
          onCancel={() => { popoverOpenRef.current = false; setCommentDraft(null); }}
        />
      )}

      {/* Comment popover for editing existing comment (works in both modes) */}
      {active && activeCommentId && (() => {
        const c = commentStoreRef.current.get(activeCommentId);
        if (!c) return null;
        return (
          <CommentPopover
            position={c.position}
            initialText={c.text}
            onTextChange={(t) => { popoverTextRef.current = t; }}
            onSubmit={(text) => {
              commentStoreRef.current.update(activeCommentId, text);
              syncCommentState();
              popoverOpenRef.current = false;
              setActiveCommentId(null);
            }}
            onCancel={() => { popoverOpenRef.current = false; setActiveCommentId(null); }}
            onDelete={() => {
              commentStoreRef.current.delete(activeCommentId);
              syncCommentState();
              popoverOpenRef.current = false;
              setActiveCommentId(null);
            }}
          />
        );
      })()}
    </TooltipPortalContext.Provider>
    </PreviewBridgeContext.Provider>,
    portalTarget
  );
}
