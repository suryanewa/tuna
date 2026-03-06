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
import { getSelector, getReactComponentHierarchy, getReactProps } from "../selector/identifier";
import { getRelevantStyles, detectLayoutMode } from "../inspector/styles";
import { LivePreviewEngine } from "../engine/live-preview";
import { ChangeTracker } from "../engine/change-tracker";
import { formatChanges, type Fidelity } from "../engine/output";
import { BridgeClient } from "../bridge/ws-client";

const DEFAULT_CONFIG: Required<ComposerConfig> = {
  port: 9223,
  hotkey: "alt+d",
  fidelity: "standard",
  position: "top-right",
};

export function DevOverlay(props: ComposerConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...props };

  const [active, setActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<InspectedElement | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [fidelity, setFidelity] = useState<Fidelity>(config.fidelity);

  const mountRef = useRef<ReturnType<typeof mountOverlay> | null>(null);
  const pickerRef = useRef<ReturnType<typeof createPicker> | null>(null);
  const previewRef = useRef<LivePreviewEngine | null>(null);
  const trackerRef = useRef<ChangeTracker | null>(null);
  const bridgeRef = useRef<BridgeClient | null>(null);

  // Initialize on mount
  useEffect(() => {
    const mount = mountOverlay();
    mountRef.current = mount;

    const preview = new LivePreviewEngine();
    previewRef.current = preview;

    const tracker = new ChangeTracker();
    trackerRef.current = tracker;

    const bridge = new BridgeClient(config.port);
    bridgeRef.current = bridge;

    // Handle requests from MCP server
    bridge.onRequest(async (method, params) => {
      switch (method) {
        case "getSelection":
          return selectedElement;
        case "getPendingChanges":
          return tracker.getPendingChanges();
        case "getFormattedChanges":
          return formatChanges(tracker.getPendingChanges(), params?.fidelity || fidelity);
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    });

    bridge.connect();

    // Poll connection status
    const statusInterval = setInterval(() => {
      setConnected(bridge.connected);
    }, 1000);

    const picker = createPicker(mount.root, {
      onHover: () => {},
      onSelect: (element) => {
        const inspected = inspectElement(element);
        setSelectedElement(inspected);

        // Start tracking this element
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
        setActive(false);
      },
    });
    pickerRef.current = picker;

    return () => {
      clearInterval(statusInterval);
      picker.destroy();
      preview.destroy();
      bridge.disconnect();
      unmountOverlay(mount.host);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle picker when active state changes
  useEffect(() => {
    const picker = pickerRef.current;
    const preview = previewRef.current;
    if (!picker || !preview) return;

    if (active) {
      picker.activate();
      preview.attach();
    } else {
      picker.deactivate();
      setSelectedElement(null);
    }
  }, [active]);

  // Hotkey listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (matchesHotkey(e, config.hotkey)) {
        e.preventDefault();
        setActive((a) => !a);
      }
      // Cmd+Z for undo when active
      if (active && (e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Cmd+Shift+Z for redo when active
      if (active && (e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [active, config.hotkey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePropertyChange = useCallback((property: string, value: string) => {
    if (!selectedElement || !previewRef.current || !trackerRef.current) return;

    previewRef.current.applyChange(selectedElement.selector, property, value);
    trackerRef.current.recordChange(selectedElement.selector, property, value);
    setChangeCount(trackerRef.current.getPendingChanges().reduce(
      (sum, c) => sum + c.changes.length, 0
    ));
  }, [selectedElement]);

  const handleUndo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;

    const entry = tracker.popUndo();
    if (entry) {
      if (entry.value) {
        preview.applyChange(entry.selector, entry.property, entry.value);
      } else {
        preview.removeChange(entry.selector, entry.property);
      }
      setChangeCount(tracker.getPendingChanges().reduce(
        (sum, c) => sum + c.changes.length, 0
      ));
    }
  }, []);

  const handleRedo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;

    const entry = tracker.popRedo();
    if (entry) {
      preview.applyChange(entry.selector, entry.property, entry.value);
      setChangeCount(tracker.getPendingChanges().reduce(
        (sum, c) => sum + c.changes.length, 0
      ));
    }
  }, []);

  const handleCopy = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;

    const output = formatChanges(tracker.getPendingChanges(), fidelity);
    navigator.clipboard.writeText(output);
  }, [fidelity]);

  const handleSend = useCallback(async () => {
    const tracker = trackerRef.current;
    const bridge = bridgeRef.current;
    if (!tracker || !bridge) return;

    const changes = tracker.getPendingChanges();
    if (changes.length === 0) return;

    try {
      await bridge.sendChanges(changes);
    } catch {
      // If MCP server isn't connected, copy to clipboard instead
      handleCopy();
    }
  }, [handleCopy]);

  const handleClear = useCallback(() => {
    previewRef.current?.clearAll();
    trackerRef.current?.clear();
    setSelectedElement(null);
    setChangeCount(0);
  }, []);

  // Render into Shadow DOM
  const shadowRoot = mountRef.current?.root;
  if (!shadowRoot) return null;

  return createPortal(
    <>
      {/* Floating toolbar */}
      <div className={`composer-toolbar ${config.position.replace("-", " ")}`}>
        {/* Edit mode toggle */}
        <button
          className={`composer-btn ${active ? "active" : ""}`}
          onClick={() => setActive(!active)}
          title={`Toggle edit mode (${config.hotkey})`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Change count */}
        {changeCount > 0 && (
          <div className="composer-changes-count">{changeCount}</div>
        )}

        {/* Copy */}
        {changeCount > 0 && (
          <button className="composer-btn" onClick={handleCopy} title="Copy changes to clipboard">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        )}

        {/* Send to AI */}
        {changeCount > 0 && (
          <button className="composer-btn" onClick={handleSend} title="Send changes to AI agent">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L7 14L5.5 8.5L2 7L14 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* Clear */}
        {changeCount > 0 && (
          <button className="composer-btn" onClick={handleClear} title="Clear all changes">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Connection status */}
        <div className={`composer-badge ${connected ? "connected" : "disconnected"}`}>
          <div className={`composer-status-dot ${connected ? "connected" : "disconnected"}`} />
          {connected ? "MCP" : "—"}
        </div>
      </div>

      {/* Property panel (shown when an element is selected) */}
      {active && selectedElement && (
        <PropertyPanel
          element={selectedElement}
          position={config.position.includes("right") ? "right" : "left"}
          onPropertyChange={handlePropertyChange}
        />
      )}
    </>,
    shadowRoot as any
  );
}

// --- Property Panel ---

function PropertyPanel({
  element,
  position,
  onPropertyChange,
}: {
  element: InspectedElement;
  position: "left" | "right";
  onPropertyChange: (property: string, value: string) => void;
}) {
  const isText = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", "BUTTON", "LABEL"].includes(element.tagName);
  const isFlex = element.layoutMode === "flex";
  const isGrid = element.layoutMode === "grid";

  return (
    <div className={`composer-panel ${position}`}>
      <div className="composer-panel-header">
        <div className="composer-panel-title">
          {element.tagName.toLowerCase()}
          {element.reactComponents.length > 0 && ` · ${element.reactComponents[0]}`}
        </div>
      </div>

      {/* Spacing */}
      <StyleSection
        label="Spacing"
        properties={["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft"]}
        styles={element.computedStyles}
        onChange={onPropertyChange}
      />

      {/* Sizing */}
      <StyleSection
        label="Size"
        properties={["width", "height", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"]}
        styles={element.computedStyles}
        onChange={onPropertyChange}
      />

      {/* Typography (for text elements) */}
      {isText && (
        <StyleSection
          label="Typography"
          properties={["fontSize", "fontWeight", "lineHeight", "letterSpacing", "color"]}
          styles={element.computedStyles}
          onChange={onPropertyChange}
        />
      )}

      {/* Background */}
      <StyleSection
        label="Background"
        properties={["backgroundColor", "opacity"]}
        styles={element.computedStyles}
        onChange={onPropertyChange}
      />

      {/* Flex layout */}
      {isFlex && (
        <StyleSection
          label="Flex"
          properties={["flexDirection", "alignItems", "justifyContent", "gap"]}
          styles={element.computedStyles}
          onChange={onPropertyChange}
        />
      )}

      {/* Grid layout */}
      {isGrid && (
        <StyleSection
          label="Grid"
          properties={["gridTemplateColumns", "gridTemplateRows", "gap"]}
          styles={element.computedStyles}
          onChange={onPropertyChange}
        />
      )}

      {/* Visual */}
      <StyleSection
        label="Effects"
        properties={["boxShadow"]}
        styles={element.computedStyles}
        onChange={onPropertyChange}
      />
    </div>
  );
}

function StyleSection({
  label,
  properties,
  styles,
  onChange,
}: {
  label: string;
  properties: string[];
  styles: Record<string, string>;
  onChange: (property: string, value: string) => void;
}) {
  return (
    <div className="composer-section">
      <div className="composer-section-label">{label}</div>
      {properties.map((prop) => (
        <div key={prop} className="composer-row">
          <label>{formatPropLabel(prop)}</label>
          {isColorProperty(prop) ? (
            <>
              <input
                type="color"
                className="composer-color-swatch"
                value={rgbToHex(styles[prop] || "")}
                onChange={(e) => onChange(prop, e.target.value)}
              />
              <input
                className="composer-input"
                value={styles[prop] || ""}
                onChange={(e) => onChange(prop, e.target.value)}
              />
            </>
          ) : (
            <input
              className="composer-input"
              value={styles[prop] || ""}
              onChange={(e) => onChange(prop, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Helpers ---

function inspectElement(element: Element): InspectedElement {
  return {
    element,
    selector: getSelector(element),
    tagName: element.tagName,
    textContent: element.textContent?.trim().slice(0, 100) || null,
    classes: element.className && typeof element.className === "string"
      ? element.className.trim().split(/\s+/)
      : [],
    rect: element.getBoundingClientRect(),
    computedStyles: getRelevantStyles(element),
    layoutMode: detectLayoutMode(element),
    reactComponents: getReactComponentHierarchy(element),
    reactProps: getReactProps(element),
  };
}

function matchesHotkey(e: KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey.toLowerCase().split("+");
  const key = parts.pop()!;
  const needsAlt = parts.includes("alt");
  const needsCtrl = parts.includes("ctrl");
  const needsMeta = parts.includes("meta") || parts.includes("cmd");
  const needsShift = parts.includes("shift");

  return (
    e.key.toLowerCase() === key &&
    e.altKey === needsAlt &&
    e.ctrlKey === needsCtrl &&
    e.metaKey === needsMeta &&
    e.shiftKey === needsShift
  );
}

function formatPropLabel(prop: string): string {
  return prop
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace("Padding ", "P ")
    .replace("Margin ", "M ")
    .replace("Border ", "B ")
    .replace(" Top", " T")
    .replace(" Right", " R")
    .replace(" Bottom", " B")
    .replace(" Left", " L")
    .replace(" Radius", " Rad");
}

function isColorProperty(prop: string): boolean {
  return prop.toLowerCase().includes("color") || prop === "backgroundColor";
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb.startsWith("#") ? rgb : "#000000";
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}
