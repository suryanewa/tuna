"use client";

/**
 * Retune — the main React component users add to their app.
 *
 * Usage:
 *   import { Retune } from "retune";
 *   // In your layout — only renders in development by default:
 *   <Retune />
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { RetuneConfig, InspectedElement } from "../types";
import { mountOverlay, unmountOverlay } from "./mount";
import { createPicker } from "../selector/picker";
import { LivePreviewEngine } from "../engine/live-preview";
import { ChangeTracker } from "../engine/change-tracker";
import { formatChanges, collapseShorthands, type Fidelity } from "../engine/output";
import { BridgeClient } from "../bridge/ws-client";
import { inspectElement, matchesHotkey } from "../ui/helpers";
import { getSelector, getSharedSelector } from "../selector/identifier";
import { PropertyPanel } from "./PropertyPanel";
import { ElementTree } from "./ElementTree";
import { IconCursorClick } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCursorClick";
import { IconSquareBehindSquare1 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconSquareBehindSquare1";
import { IconStepBack } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconStepBack";
import { IconCrossMedium } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCrossMedium";
import { IconBroom } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconBroom";
import { IconCheckCircle2 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCheckCircle2";
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

export function Retune(props: RetuneConfig = {}) {
  const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";
  if (!isDev && !props.force) return null;

  return <RetuneInner {...props} />;
}

function RetuneInner(props: RetuneConfig) {
  const config = { ...DEFAULT_CONFIG, ...props };

  const [active, setActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<InspectedElement | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [fidelity] = useState<Fidelity>(config.fidelity);
  const fidelityRef = useRef(fidelity);
  fidelityRef.current = fidelity;
  const [copied, setCopied] = useState(false);
  const [hoveredBoxModel, setHoveredBoxModel] = useState<BoxModelProperty>(null);
  const [changeRevision, setChangeRevision] = useState(0);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panelTab, setPanelTab] = useState<"elements" | "design">("design");
  const [side, setSide] = useState<"right" | "left">(config.position.includes("right") ? "right" : "left");
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabPillRef = useRef<HTMLDivElement>(null);
  const tabPillFirstRender = useRef(true);

  // Scope: "element" = this element only, "class" = all matching elements
  type ChangeScope = "element" | "class";
  const [scope, setScope] = useState<ChangeScope>("element");
  const [sharedSelector, setSharedSelector] = useState<{ selector: string; count: number } | null>(null);

  const mountRef = useRef<ReturnType<typeof mountOverlay> | null>(null);
  const pickerRef = useRef<ReturnType<typeof createPicker> | null>(null);
  const previewRef = useRef<LivePreviewEngine | null>(null);
  const trackerRef = useRef<ChangeTracker | null>(null);
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

    const bridge = new BridgeClient(config.port);
    bridgeRef.current = bridge;

    bridge.onRequest(async (method, params) => {
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
          return tracker.getPendingChanges();
        case "getCollapsedChanges":
          return tracker.getPendingChanges().map((c) => ({
            ...c,
            changes: collapseShorthands(c.changes),
          }));
        case "getFormattedChanges":
          return formatChanges(tracker.getPendingChanges(), params?.fidelity || fidelityRef.current);
        case "clearChanges":
          preview.clearAll();
          tracker.clear();
          syncTrackerStateRef.current();
          refreshSelectedElementRef.current();
          return { ok: true };
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    });

    bridge.connect();

    // Restore persisted changes from previous session
    if (tracker.restore()) {
      preview.attach();
      for (const change of tracker.getPendingChanges()) {
        for (const c of change.changes) {
          preview.applyChange(change.selector, c.property, c.to);
        }
      }
      setChangeCount(tracker.getPendingChanges().length);
      setCanUndo(tracker.canUndo);
      setCanRedo(tracker.canRedo);
    }

    const picker = createPicker(mount.root, {
      onHover: () => {},
      onSelect: (element) => {
        const inspected = inspectElement(element);
        setSelectedElement(inspected);
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
        );

        // Compute shared selector and set smart default scope
        const shared = getSharedSelector(element);
        setSharedSelector(shared);
        setScope(shared && shared.count > 1 ? "class" : "element");

        // Also track the shared selector so changes are recorded correctly
        if (shared) {
          tracker.track(
            shared.selector,
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
      },
      onCancel: () => {
        deactivateOverlay();
      },
    });
    pickerRef.current = picker;

    return () => {
      picker.destroy();
      preview.destroy();
      bridge.disconnect();
      unmountOverlay(mount.host);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activateOverlay = useCallback(() => {
    setActive(true);
    pickerRef.current?.activate();
    previewRef.current?.attach();
  }, []);

  const deactivateOverlay = useCallback(() => {
    setActive(false);
    setSelectedElement(null);
    pickerRef.current?.deactivate();
  }, []);

  const toggleOverlay = useCallback(() => {
    setActive((prev) => {
      if (prev) {
        setSelectedElement(null);
        pickerRef.current?.deactivate();
      } else {
        pickerRef.current?.activate();
        previewRef.current?.attach();
      }
      return !prev;
    });
  }, []);

  const syncTrackerState = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    setChangeCount(tracker.getPendingChanges().length);
    setCanUndo(tracker.canUndo);
    setCanRedo(tracker.canRedo);
    tracker.persist();
  }, []);
  syncTrackerStateRef.current = syncTrackerState;

  const refreshSelectedElement = useCallback(() => {
    setSelectedElement((prev) => {
      if (!prev?.element) return prev;
      return inspectElement(prev.element);
    });
  }, []);
  refreshSelectedElementRef.current = refreshSelectedElement;

  const handlePropertyChange = useCallback((property: string, value: string) => {
    if (!selectedElement || !previewRef.current || !trackerRef.current) return;
    const selector = scope === "class" && sharedSelector
      ? sharedSelector.selector
      : selectedElement.selector;
    previewRef.current.applyChange(selector, property, value);
    trackerRef.current.recordChange(selector, property, value);
    syncTrackerState();
    refreshSelectedElement();
    setChangeRevision((r) => r + 1);
  }, [selectedElement, scope, sharedSelector, syncTrackerState, refreshSelectedElement]);

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

  // Tree: select element programmatically via picker
  const handleTreeSelect = useCallback((el: Element) => {
    const picker = pickerRef.current;
    if (picker) {
      picker.selectElement(el);
    }
    // Switch to design tab after selecting
    setPanelTab("design");
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
    setSide((s) => s === "right" ? "left" : "right");
  }, []);

  const handleUndo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    const entry = tracker.popUndo();
    if (entry) {
      if (entry.value) preview.applyChange(entry.selector, entry.property, entry.value);
      else preview.removeChange(entry.selector, entry.property);
      syncTrackerState();
      refreshSelectedElement();
    }
  }, [syncTrackerState, refreshSelectedElement]);

  const handleRedo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    const entry = tracker.popRedo();
    if (entry) {
      preview.applyChange(entry.selector, entry.property, entry.value);
      syncTrackerState();
      refreshSelectedElement();
    }
  }, [syncTrackerState, refreshSelectedElement]);

  // Hotkey listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (matchesHotkey(e, config.hotkey)) {
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
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [active, config.hotkey, toggleOverlay, handleUndo, handleRedo]);

  const handleReset = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    preview.clearAll();
    tracker.clear();
    syncTrackerState();
    refreshSelectedElement();
  }, [syncTrackerState, refreshSelectedElement]);

  const handleScopeChange = useCallback((newScope: "element" | "class") => {
    const preview = previewRef.current;
    const tracker = trackerRef.current;
    if (!preview || !tracker || !selectedElement || !sharedSelector) {
      setScope(newScope);
      return;
    }

    const elementSelector = selectedElement.selector;
    const classSelector = sharedSelector.selector;
    const fromSelector = scope === "class" ? classSelector : elementSelector;
    const toSelector = newScope === "class" ? classSelector : elementSelector;

    if (fromSelector !== toSelector) {
      preview.migrateChanges(fromSelector, toSelector);
      tracker.migrateChanges(fromSelector, toSelector);
      syncTrackerState();
      refreshSelectedElement();
      setChangeRevision((r) => r + 1);
    }

    setScope(newScope);
  }, [selectedElement, sharedSelector, scope, syncTrackerState, refreshSelectedElement]);

  const handleCopy = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    navigator.clipboard.writeText(formatChanges(tracker.getPendingChanges(), fidelity));
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
        formatChanges(trackerRef.current?.getPendingChanges() ?? [], f ?? fidelityRef.current),
      clearChanges: () => {
        const tracker = trackerRef.current;
        const preview = previewRef.current;
        if (!tracker || !preview) return;
        preview.clearAll();
        tracker.clear();
        syncTrackerStateRef.current();
        refreshSelectedElementRef.current();
      },
    };
    (window as any).__retune = api;
    return () => { delete (window as any).__retune; };
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <TooltipPortalContext.Provider value={portalTarget}>
      {/* Floating toolbar */}
      <div className={`retune-toolbar bottom ${side} ${active ? "expanded" : "collapsed"}`}>
        {/* Collapsed: single activate button */}
        <Tooltip content="Toggle edit mode" shortcut={config.hotkey} side="top">
          <button
            className="retune-toolbar-collapse-btn"
            onClick={activateOverlay}
          >
            <IconCursorClick size={20} />
            {!active && changeCount > 0 && <span className="retune-changes-dot" />}
          </button>
        </Tooltip>

        {/* Expanded: edit count + actions */}
        <div className="retune-toolbar-expanded">
          {changeCount > 0 && (
            <div className="retune-edit-count">{changeCount}</div>
          )}
          <Tooltip content="Copy changes" shortcut="⌘C" side="top">
            <button
              className={`retune-toolbar-btn${changeCount === 0 ? " disabled" : ""}`}
              onClick={handleCopy}
              disabled={changeCount === 0}
            >
              <span className="retune-icon-swap">
                <span className={`retune-icon-swap-icon ${copied ? "out" : "in"}`}>
                  <IconSquareBehindSquare1 size={20} />
                </span>
                <span className={`retune-icon-swap-icon ${copied ? "in" : "out"}`}>
                  <IconCheckCircle2 size={20} />
                </span>
              </span>
            </button>
          </Tooltip>
          <Tooltip content="Undo" shortcut="⌘Z" side="top">
            <button
              className={`retune-toolbar-btn${!canUndo ? " disabled" : ""}`}
              onClick={handleUndo}
              disabled={!canUndo}
            >
              <IconStepBack size={20} />
            </button>
          </Tooltip>
          <Tooltip content="Redo" shortcut="⌘⇧Z" side="top">
            <button
              className={`retune-toolbar-btn${!canRedo ? " disabled" : ""}`}
              onClick={handleRedo}
              disabled={!canRedo}
            >
              <span className="retune-icon-flip">
                <IconStepBack size={20} />
              </span>
            </button>
          </Tooltip>
          <Tooltip content="Reset all" side="top">
            <button
              className={`retune-toolbar-btn${changeCount === 0 ? " disabled" : ""}`}
              onClick={handleReset}
              disabled={changeCount === 0}
            >
              <IconBroom size={20} />
            </button>
          </Tooltip>
          <Tooltip content={`Move to ${side === "right" ? "left" : "right"}`} side="top">
            <button
              className="retune-toolbar-btn"
              onClick={handleToggleSide}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <line x1={side === "right" ? "9" : "15"} y1="3" x2={side === "right" ? "9" : "15"} y2="21" />
              </svg>
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

      {/* Panel with tabs */}
      <AnimatedPanel visible={!!(active && selectedElement)}>
        <div className={`retune-panel ${side}`}>
          <div className="retune-tab-bar" ref={tabBarRef}>
            <div className="retune-tab-pill" ref={tabPillRef} />
            <button className={`retune-tab${panelTab === "elements" ? " active" : ""}`} onClick={() => setPanelTab("elements")}>Elements</button>
            <button className={`retune-tab${panelTab === "design" ? " active" : ""}`} onClick={() => setPanelTab("design")}>Design</button>
          </div>
          <div className="retune-panel-body">
            {panelTab === "elements" && (
              <ElementTree
                selectedElement={selectedElement?.element ?? null}
                onSelect={handleTreeSelect}
                onHover={handleTreeHover}
              />
            )}
            {panelTab === "design" && selectedElement && (
              <PropertyPanel
                element={selectedElement}
                position={side}
                onPropertyChange={handlePropertyChange}
                onPropertyHover={setHoveredBoxModel}
                onApplyToElement={handleApplyToElement}
                scope={scope}
                onScopeChange={handleScopeChange}
                sharedSelector={sharedSelector}
              />
            )}
          </div>
        </div>
      </AnimatedPanel>

      {/* Box model visualization overlay */}
      {active && selectedElement && hoveredBoxModel && (
        <BoxModelOverlay
          element={selectedElement.element}
          hoveredProperty={hoveredBoxModel}
          revision={changeRevision}
        />
      )}
    </TooltipPortalContext.Provider>,
    portalTarget
  );
}
