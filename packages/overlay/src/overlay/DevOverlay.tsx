"use client";

/**
 * DevOverlay — the main React component users add to their app.
 *
 * Usage:
 *   import { DevOverlay } from "@composer/overlay";
 *   // In your layout:
 *   {process.env.NODE_ENV === "development" && <DevOverlay />}
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { ComposerConfig, InspectedElement } from "../types";
import { mountOverlay, unmountOverlay } from "./mount";
import { createPicker } from "../selector/picker";
import { LivePreviewEngine } from "../engine/live-preview";
import { ChangeTracker } from "../engine/change-tracker";
import { formatChanges, type Fidelity } from "../engine/output";
import { BridgeClient } from "../bridge/ws-client";
import { inspectElement, matchesHotkey } from "../ui/helpers";
import { PropertyPanel } from "./PropertyPanel";
import { IconCursorClick } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCursorClick";
import { IconSquareBehindSquare1 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconSquareBehindSquare1";
import { IconStepBack } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconStepBack";
import { IconCrossMedium } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCrossMedium";

const DEFAULT_CONFIG: Required<ComposerConfig> = {
  port: 9223,
  hotkey: "alt+d",
  fidelity: "standard",
  position: "bottom-right",
};

export function DevOverlay(props: ComposerConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...props };

  const [active, setActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<InspectedElement | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [fidelity] = useState<Fidelity>(config.fidelity);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);

  const mountRef = useRef<ReturnType<typeof mountOverlay> | null>(null);
  const pickerRef = useRef<ReturnType<typeof createPicker> | null>(null);
  const previewRef = useRef<LivePreviewEngine | null>(null);
  const trackerRef = useRef<ChangeTracker | null>(null);
  const bridgeRef = useRef<BridgeClient | null>(null);
  const selectedElementRef = useRef<InspectedElement | null>(null);
  selectedElementRef.current = selectedElement;

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
        case "getFormattedChanges":
          return formatChanges(tracker.getPendingChanges(), params?.fidelity || fidelity);
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    });

    bridge.connect();

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
          inspected.computedStyles
        );
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
  }, [active, config.hotkey]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncTrackerState = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    setChangeCount(tracker.getPendingChanges().reduce((s, c) => s + c.changes.length, 0));
    setCanUndo(tracker.canUndo);
    setCanRedo(tracker.canRedo);
  }, []);

  const refreshSelectedElement = useCallback(() => {
    setSelectedElement((prev) => {
      if (!prev?.element) return prev;
      return inspectElement(prev.element);
    });
  }, []);

  const handlePropertyChange = useCallback((property: string, value: string) => {
    if (!selectedElement || !previewRef.current || !trackerRef.current) return;
    previewRef.current.applyChange(selectedElement.selector, property, value);
    trackerRef.current.recordChange(selectedElement.selector, property, value);
    syncTrackerState();
    refreshSelectedElement();
  }, [selectedElement, syncTrackerState, refreshSelectedElement]);

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

  const handleCopy = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    navigator.clipboard.writeText(formatChanges(tracker.getPendingChanges(), fidelity));
  }, [fidelity]);

  const handleClose = useCallback(() => {
    deactivateOverlay();
  }, [deactivateOverlay]);

  if (!portalTarget) return null;

  return createPortal(
    <>
      {/* Floating toolbar */}
      <div className={`composer-toolbar ${config.position.replace("-", " ")} ${active ? "expanded" : "collapsed"}`}>
        {/* Collapsed: single activate button */}
        <button
          className="composer-toolbar-collapse-btn"
          onClick={activateOverlay}
          title={`Toggle edit mode (${config.hotkey})`}
        >
          <IconCursorClick size={20} />
        </button>

        {/* Expanded: edit count + actions */}
        <div className="composer-toolbar-expanded">
          {changeCount > 0 && (
            <div className="composer-edit-count">{changeCount}</div>
          )}
          <button
            className={`composer-toolbar-btn${changeCount === 0 ? " disabled" : ""}`}
            onClick={handleCopy}
            disabled={changeCount === 0}
            title="Copy changes"
          >
            <IconSquareBehindSquare1 size={20} />
          </button>
          <button
            className={`composer-toolbar-btn${!canUndo ? " disabled" : ""}`}
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo"
          >
            <IconStepBack size={20} />
          </button>
          <button
            className={`composer-toolbar-btn${!canRedo ? " disabled" : ""}`}
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo"
          >
            <span className="composer-icon-flip">
              <IconStepBack size={20} />
            </span>
          </button>
          <button
            className="composer-toolbar-btn"
            onClick={handleClose}
            title="Close"
          >
            <IconCrossMedium size={20} />
          </button>
        </div>
      </div>

      {/* Property panel */}
      {active && selectedElement && (
        <PropertyPanel
          element={selectedElement}
          position={config.position.includes("right") ? "right" : "left"}
          onPropertyChange={handlePropertyChange}
        />
      )}
    </>,
    portalTarget
  );
}
