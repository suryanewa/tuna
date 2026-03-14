"use client";

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
import { LivePreviewEngine } from "../engine/live-preview";
import { ChangeTracker } from "../engine/change-tracker";
import { formatChanges, collapseShorthands, type Fidelity } from "../engine/output";
import { BridgeClient } from "../bridge/ws-client";
import { inspectElement, matchesHotkey } from "../ui/helpers";
import { getSelector, getSelectorCandidates, type SelectorCandidate } from "../selector/identifier";
import { getPseudoStateStyles, getStyleSources, getScopedStyles, type ForcedState, type StyleSource } from "../inspector/styles";
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

export function Retune(props: RetuneConfig = {}) {
  const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";
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

  // Selector candidates for the selected element (class-based selectors with match counts)
  const [selectorCandidates, setSelectorCandidates] = useState<SelectorCandidate[]>([]);
  // The active selector: null = element-specific, or a class-based selector string
  const [activeSelector, setActiveSelector] = useState<string | null>(null);
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
        case "getEnrichedChanges": {
          const { scanDesignTokens } = await import("../inspector/tokens");
          const { enrichPropertyChanges } = await import("../engine/candidates");
          const tokenMap = scanDesignTokens();
          return tracker.getPendingChanges().map((c) => ({
            ...c,
            changes: enrichPropertyChanges(collapseShorthands(c.changes), tokenMap, c.selector),
          }));
        }
        case "getFormattedChanges":
          return formatChanges(tracker.getPendingChanges(), params?.fidelity || fidelityRef.current);
        case "clearChanges": {
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
          return { ok: true };
        }
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
        // Clear forced pseudo-state when selecting a new element
        if (forcedStateRef.current) {
          clearForcedInlineStyles();
        }
        // Compute style sources and selector candidates
        setStyleSources(getStyleSources(element));
        const candidates = getSelectorCandidates(element);
        setSelectorCandidates(candidates);
        // Default to the first non-utility candidate (skip utility classes)
        const meaningful = candidates.filter(c => c.verdict !== "utility");
        const defaultSelector = meaningful.length > 0 ? meaningful[0].selector : null;
        activeSelectorRef.current = defaultSelector;
        setActiveSelector(defaultSelector);

        // Apply scoped styles if a class selector is the default
        if (defaultSelector) {
          inspected.computedStyles = getScopedStyles(element, defaultSelector);
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
        );

        // Also track selector candidates so changes are recorded correctly
        for (const candidate of candidates) {
          tracker.track(
            candidate.selector,
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
    pickerRef.current?.deactivate();
  }, [clearForcedInlineStyles]);

  const toggleOverlay = useCallback(() => {
    setActive((prev) => {
      if (prev) {
        if (forcedStateRef.current) clearForcedInlineStyles();
        setSelectedElement(null);
        selectedElementRef.current = null;
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
    setChangeCount(tracker.getPendingChanges().length);
    setCanUndo(tracker.canUndo);
    setCanRedo(tracker.canRedo);
    tracker.persist();
  }, []);
  syncTrackerStateRef.current = syncTrackerState;

  const refreshSelectedElement = useCallback(() => {
    setSelectedElement((prev) => {
      if (!prev?.element) return prev;
      const inspected = inspectElement(prev.element);
      const scope = activeSelectorRef.current;
      if (scope) {
        inspected.computedStyles = getScopedStyles(prev.element, scope);
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
  const handleTokenSwap = useCallback((oldClassName: string, newClassName: string) => {
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
  const handleTokenAssociate = useCallback((properties: string[], token: { className: string; values: Record<string, string> }) => {
    const tracker = trackerRef.current;
    const el = selectedElementRef.current;
    if (!tracker || !el) return;
    const selector = activeSelectorRef.current ?? el.selector;
    tracker.setTokenAssociation(selector, properties, token);
    tracker.persist();
    setChangeRevision((r) => r + 1);
  }, []);

  // Get current token associations for the selected element
  const selectedTokenAssociations = useMemo(() => {
    const tracker = trackerRef.current;
    if (!tracker || !selectedElement) return {};
    const selector = activeSelector ?? selectedElement.selector;
    return tracker.getTokenAssociations(selector) ?? {};
  // changeRevision ensures we re-read after new associations are recorded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElement, activeSelector, changeRevision]);

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

  const handleUndo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    const entries = tracker.popUndo();
    if (entries) {
      for (const entry of entries) {
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
      for (const entry of entries) {
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
  }, [syncForcedInlineStyles]);

  const handleRedo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    const entries = tracker.popRedo();
    if (entries) {
      for (const entry of entries) {
        preview.applyChange(entry.selector, entry.property, entry.value);
      }
      syncForcedInlineStyles();
      syncTrackerStateRef.current();
      refreshSelectedElementRef.current();
      pickerRef.current?.refreshSelection();
      setChangeRevision((r) => r + 1);
    }
  }, [syncForcedInlineStyles]);

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
    // Clean up forced pseudo-state inline styles before clearing
    if (forcedStateRef.current) clearForcedInlineStyles();
    preview.clearAll();
    tracker.clear();
    syncTrackerState();
    setChangeRevision((r) => r + 1);
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
    refreshSelectedElement();
  }, [syncTrackerState, refreshSelectedElement, clearForcedInlineStyles]);

  const handleSelectorChange = useCallback((newSelector: string | null) => {
    const preview = previewRef.current;
    const tracker = trackerRef.current;
    const el = selectedElementRef.current;
    if (!preview || !tracker || !el) {
      activeSelectorRef.current = newSelector;
      setActiveSelector(newSelector);
      return;
    }

    const fromSelector = activeSelectorRef.current ?? el.selector;
    const toSelector = newSelector ?? el.selector;

    if (fromSelector !== toSelector) {
      preview.migrateChanges(fromSelector, toSelector);
      tracker.migrateChanges(fromSelector, toSelector);

      // Also migrate pseudo-state variants (:hover, :focus, :active)
      const pseudoStates: ForcedState[] = [":hover", ":focus", ":active"];
      for (const ps of pseudoStates) {
        preview.migrateChanges(fromSelector + ps, toSelector + ps);
        tracker.migrateChanges(fromSelector + ps, toSelector + ps);
      }

      // Update forcedStylesRef.selector so cleanup tracking stays correct
      if (forcedStylesRef.current.selector === fromSelector) {
        forcedStylesRef.current.selector = toSelector;
      }

      syncTrackerState();
      setChangeRevision((r) => r + 1);
    }

    // Update ref before refresh so scoped styles use the new selector
    activeSelectorRef.current = newSelector;
    setActiveSelector(newSelector);

    // If a pseudo-state is forced, rebuild inline styles for the new selector context
    // so the DOM element reflects the correct pseudo-state values after migration.
    if (forcedStateRef.current) {
      syncForcedInlineStyles();
    }

    refreshSelectedElement();
  }, [syncTrackerState, refreshSelectedElement, syncForcedInlineStyles]);

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
                key={selectedElement.selector}
                element={selectedElement}
                position={side}
                onPropertyChange={handlePropertyChange}
                onPropertyHover={setHoveredBoxModel}
                onApplyToElement={handleApplyToElement}
                onTokenSwap={handleTokenSwap}
                onTokenAssociate={handleTokenAssociate}
                tokenAssociations={selectedTokenAssociations}
                selectorCandidates={selectorCandidates}
                activeSelector={activeSelector}
                onSelectorChange={handleSelectorChange}
                styleSources={styleSources}
                forcedState={forcedState}
                onForcedStateChange={handleForcedStateChange}
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
