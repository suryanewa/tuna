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
  const [fidelity] = useState<Fidelity>(config.fidelity);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);

  const mountRef = useRef<ReturnType<typeof mountOverlay> | null>(null);
  const pickerRef = useRef<ReturnType<typeof createPicker> | null>(null);
  const previewRef = useRef<LivePreviewEngine | null>(null);
  const trackerRef = useRef<ChangeTracker | null>(null);
  const bridgeRef = useRef<BridgeClient | null>(null);

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

    const statusInterval = setInterval(() => {
      setConnected(bridge.connected);
    }, 1000);

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
      if (entry.value) preview.applyChange(entry.selector, entry.property, entry.value);
      else preview.removeChange(entry.selector, entry.property);
      setChangeCount(tracker.getPendingChanges().reduce((s, c) => s + c.changes.length, 0));
    }
  }, []);

  const handleRedo = useCallback(() => {
    const tracker = trackerRef.current;
    const preview = previewRef.current;
    if (!tracker || !preview) return;
    const entry = tracker.popRedo();
    if (entry) {
      preview.applyChange(entry.selector, entry.property, entry.value);
      setChangeCount(tracker.getPendingChanges().reduce((s, c) => s + c.changes.length, 0));
    }
  }, []);

  const handleCopy = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    navigator.clipboard.writeText(formatChanges(tracker.getPendingChanges(), fidelity));
  }, [fidelity]);

  const handleSend = useCallback(async () => {
    const tracker = trackerRef.current;
    const bridge = bridgeRef.current;
    if (!tracker || !bridge) return;
    const changes = tracker.getPendingChanges();
    if (changes.length === 0) return;
    try { await bridge.sendChanges(changes); } catch { handleCopy(); }
  }, [handleCopy]);

  const handleClear = useCallback(() => {
    previewRef.current?.clearAll();
    trackerRef.current?.clear();
    setSelectedElement(null);
    setChangeCount(0);
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <>
      {/* Floating toolbar */}
      <div className={`composer-toolbar ${config.position.replace("-", " ")}`}>
        <button
          className={`composer-btn ${active ? "active" : ""}`}
          onClick={() => setActive(!active)}
          title={`Toggle edit mode (${config.hotkey})`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {changeCount > 0 && (
          <>
            <div className="composer-divider" />
            <div className="composer-changes-count">{changeCount}</div>
            <button className="composer-btn" onClick={handleCopy} title="Copy changes">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button className="composer-btn" onClick={handleSend} title="Send to AI">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M14 2L7 14L5.5 8.5L2 7L14 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="composer-btn" onClick={handleClear} title="Clear">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}

        <div className="composer-divider" />
        <div className={`composer-badge ${connected ? "connected" : "disconnected"}`}>
          <div className={`composer-status-dot ${connected ? "connected" : "disconnected"}`} />
          {connected ? "MCP" : "offline"}
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

// ─── Property Panel ───────────────────────────────────────────

function PropertyPanel({
  element,
  position,
  onPropertyChange,
}: {
  element: InspectedElement;
  position: "left" | "right";
  onPropertyChange: (property: string, value: string) => void;
}) {
  const s = element.computedStyles;
  const isText = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", "BUTTON", "LABEL", "LI", "TD", "TH", "FIGCAPTION", "BLOCKQUOTE", "CITE", "EM", "STRONG", "SMALL"].includes(element.tagName);
  const isFlex = element.layoutMode === "flex";
  const isGrid = element.layoutMode === "grid";
  const isPositioned = element.layoutMode === "absolute" || element.layoutMode === "fixed";

  return (
    <div className={`composer-panel ${position}`}>
      {/* Header */}
      <div className="composer-panel-header">
        <div className="composer-el-tag">{element.tagName.toLowerCase()}</div>
        {element.reactComponents.length > 0 && (
          <div className="composer-el-component">{element.reactComponents.join(" › ")}</div>
        )}
        {element.textContent && (
          <div className="composer-el-text">"{truncate(element.textContent, 30)}"</div>
        )}
      </div>

      {/* Spacing */}
      <Section label="Spacing">
        <div className="composer-grid">
          <Prop label="PT" prop="paddingTop" value={s.paddingTop} onChange={onPropertyChange} />
          <Prop label="PR" prop="paddingRight" value={s.paddingRight} onChange={onPropertyChange} />
          <Prop label="PB" prop="paddingBottom" value={s.paddingBottom} onChange={onPropertyChange} />
          <Prop label="PL" prop="paddingLeft" value={s.paddingLeft} onChange={onPropertyChange} />
          <Prop label="MT" prop="marginTop" value={s.marginTop} onChange={onPropertyChange} />
          <Prop label="MR" prop="marginRight" value={s.marginRight} onChange={onPropertyChange} />
          <Prop label="MB" prop="marginBottom" value={s.marginBottom} onChange={onPropertyChange} />
          <Prop label="ML" prop="marginLeft" value={s.marginLeft} onChange={onPropertyChange} />
        </div>
      </Section>

      {/* Size */}
      <Section label="Size">
        <div className="composer-grid">
          <Prop label="W" prop="width" value={s.width} onChange={onPropertyChange} />
          <Prop label="H" prop="height" value={s.height} onChange={onPropertyChange} />
          <Prop label="TL" prop="borderTopLeftRadius" value={s.borderTopLeftRadius} onChange={onPropertyChange} />
          <Prop label="TR" prop="borderTopRightRadius" value={s.borderTopRightRadius} onChange={onPropertyChange} />
          <Prop label="BL" prop="borderBottomLeftRadius" value={s.borderBottomLeftRadius} onChange={onPropertyChange} />
          <Prop label="BR" prop="borderBottomRightRadius" value={s.borderBottomRightRadius} onChange={onPropertyChange} />
        </div>
      </Section>

      {/* Typography */}
      {isText && (
        <Section label="Typography">
          <div className="composer-grid">
            <Prop label="Size" prop="fontSize" value={s.fontSize} onChange={onPropertyChange} />
            <Prop label="Weight" prop="fontWeight" value={s.fontWeight} onChange={onPropertyChange} />
            <Prop label="Height" prop="lineHeight" value={s.lineHeight} onChange={onPropertyChange} />
            <Prop label="Spacing" prop="letterSpacing" value={s.letterSpacing} onChange={onPropertyChange} />
          </div>
          <div className="composer-grid single" style={{ marginTop: 4 }}>
            <ColorProp label="Color" prop="color" value={s.color} onChange={onPropertyChange} />
            <SelectProp label="Align" prop="textAlign" value={s.textAlign} options={["left", "center", "right", "justify"]} onChange={onPropertyChange} />
          </div>
        </Section>
      )}

      {/* Fill */}
      <Section label="Fill">
        <div className="composer-grid single">
          <ColorProp label="BG" prop="backgroundColor" value={s.backgroundColor} onChange={onPropertyChange} />
        </div>
        <div className="composer-grid" style={{ marginTop: 4 }}>
          <Prop label="Opacity" prop="opacity" value={s.opacity} onChange={onPropertyChange} />
        </div>
      </Section>

      {/* Flex Layout */}
      {isFlex && (
        <Section label="Flex">
          <div className="composer-grid">
            <SelectProp label="Dir" prop="flexDirection" value={s.flexDirection} options={["row", "row-reverse", "column", "column-reverse"]} onChange={onPropertyChange} />
            <Prop label="Gap" prop="gap" value={s.gap} onChange={onPropertyChange} />
            <SelectProp label="Align" prop="alignItems" value={s.alignItems} options={["stretch", "flex-start", "center", "flex-end", "baseline"]} onChange={onPropertyChange} />
            <SelectProp label="Justify" prop="justifyContent" value={s.justifyContent} options={["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"]} onChange={onPropertyChange} />
          </div>
        </Section>
      )}

      {/* Grid Layout */}
      {isGrid && (
        <Section label="Grid">
          <div className="composer-grid single">
            <Prop label="Columns" prop="gridTemplateColumns" value={s.gridTemplateColumns} onChange={onPropertyChange} />
            <Prop label="Rows" prop="gridTemplateRows" value={s.gridTemplateRows} onChange={onPropertyChange} />
          </div>
          <div className="composer-grid" style={{ marginTop: 4 }}>
            <Prop label="Gap" prop="gap" value={s.gap} onChange={onPropertyChange} />
          </div>
        </Section>
      )}

      {/* Position */}
      {isPositioned && (
        <Section label="Position">
          <div className="composer-grid">
            <Prop label="Top" prop="top" value={s.top} onChange={onPropertyChange} />
            <Prop label="Right" prop="right" value={s.right} onChange={onPropertyChange} />
            <Prop label="Bottom" prop="bottom" value={s.bottom} onChange={onPropertyChange} />
            <Prop label="Left" prop="left" value={s.left} onChange={onPropertyChange} />
            <Prop label="Z" prop="zIndex" value={s.zIndex} onChange={onPropertyChange} />
          </div>
        </Section>
      )}

      {/* Effects */}
      {s.boxShadow && s.boxShadow !== "none" && (
        <Section label="Effects">
          <div className="composer-grid single">
            <Prop label="Shadow" prop="boxShadow" value={s.boxShadow} onChange={onPropertyChange} full />
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="composer-section">
      <div className="composer-section-label">{label}</div>
      {children}
    </div>
  );
}

function Prop({
  label, prop, value, onChange, full,
}: {
  label: string;
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
  full?: boolean;
}) {
  const [localValue, setLocalValue] = useState(value || "");
  const labelRef = useRef<HTMLSpanElement>(null);

  // Sync external value changes
  useEffect(() => { setLocalValue(value || ""); }, [value]);

  // Scrub-to-adjust: drag on label to change numeric values
  const scrubRef = useRef({ startX: 0, startVal: 0, active: false });

  const handleLabelPointerDown = (e: React.PointerEvent) => {
    const num = parseFloat(localValue);
    if (isNaN(num)) return;
    scrubRef.current = { startX: e.clientX, startVal: num, active: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLabelPointerMove = (e: React.PointerEvent) => {
    if (!scrubRef.current.active) return;
    const delta = Math.round((e.clientX - scrubRef.current.startX));
    const unit = localValue.replace(/[\d.-]+/, "") || "";
    const newVal = `${scrubRef.current.startVal + delta}${unit}`;
    setLocalValue(newVal);
    onChange(prop, newVal);
  };

  const handleLabelPointerUp = () => {
    scrubRef.current.active = false;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    onChange(prop, localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onChange(prop, localValue);
      (e.target as HTMLInputElement).blur();
    }
    // Arrow up/down for numeric values
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const num = parseFloat(localValue);
      if (isNaN(num)) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === "ArrowUp" ? step : -step;
      const unit = localValue.replace(/[\d.-]+/, "") || "";
      const newVal = `${num + delta}${unit}`;
      setLocalValue(newVal);
      onChange(prop, newVal);
    }
  };

  return (
    <div className={`composer-prop${full ? " full" : ""}`}>
      <span
        ref={labelRef}
        className="composer-prop-label"
        onPointerDown={handleLabelPointerDown}
        onPointerMove={handleLabelPointerMove}
        onPointerUp={handleLabelPointerUp}
      >
        {label}
      </span>
      <input
        className="composer-prop-input"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
    </div>
  );
}

function ColorProp({
  label, prop, value, onChange,
}: {
  label: string;
  prop: string;
  value: string | undefined;
  onChange: (prop: string, value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value || "");
  useEffect(() => { setLocalValue(value || ""); }, [value]);

  const hexValue = rgbToHex(localValue);

  return (
    <div className="composer-prop color">
      <span className="composer-prop-label">{label}</span>
      <div className="composer-color-swatch">
        <div className="composer-color-swatch-fill" style={{ background: localValue }} />
        <input
          type="color"
          className="composer-color-picker"
          value={hexValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange(prop, e.target.value);
          }}
        />
      </div>
      <input
        className="composer-prop-input"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onChange(prop, localValue)}
        onKeyDown={(e) => { if (e.key === "Enter") { onChange(prop, localValue); (e.target as HTMLInputElement).blur(); } }}
        spellCheck={false}
      />
    </div>
  );
}

function SelectProp({
  label, prop, value, options, onChange,
}: {
  label: string;
  prop: string;
  value: string | undefined;
  options: string[];
  onChange: (prop: string, value: string) => void;
}) {
  return (
    <div className="composer-prop">
      <span className="composer-prop-label">{label}</span>
      <select
        className="composer-prop-select"
        value={value || ""}
        onChange={(e) => onChange(prop, e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

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

function truncate(str: string, len: number): string {
  const cleaned = str.replace(/\s+/g, " ").trim();
  return cleaned.length > len ? cleaned.slice(0, len) + "…" : cleaned;
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb.startsWith("#") ? rgb : "#000000";
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}
