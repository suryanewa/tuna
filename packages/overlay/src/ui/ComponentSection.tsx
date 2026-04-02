/**
 * Component Section — displays React component props and state
 * in the property panel using the same RowGroup/retune-row pattern.
 */

import { useState, useCallback } from "react";
import type { InspectedElement } from "../types";
import { setReactState, setReactProp } from "../selector/identifier";
import { Section, RowGroup } from "./section";
import { ChangeIndicator } from "./change-indicator";

interface ComponentSectionProps {
  selectedElement: InspectedElement;
  onRefresh?: () => void;
  /** Called when a prop value changes — parent records in tracker */
  onPropChange?: (propName: string, newValue: unknown) => void;
  /** Set of prop names that have been changed from original */
  changedProps?: Set<string>;
  /** Called to reset a prop to its original value */
  onPropReset?: (propName: string) => void;
}

function getValueType(value: unknown): "boolean" | "number" | "string" | "function" | "object" | "null" {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "function") return "function";
  return "object";
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "function") return "fn()";
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json.length > 40 ? json.slice(0, 37) + "..." : json;
    } catch { return "{...}"; }
  }
  return String(value);
}

function inferStateLabel(value: unknown, index: number): string {
  const type = getValueType(value);
  if (type === "boolean") return `toggle ${index + 1}`;
  if (type === "number") return `count ${index + 1}`;
  if (type === "string") {
    const s = value as string;
    if (s.length > 0 && s.length <= 12) return s;
    return `text ${index + 1}`;
  }
  if (type === "object") {
    if (Array.isArray(value)) return `list (${(value as unknown[]).length})`;
    return `object`;
  }
  return `state ${index + 1}`;
}

export function ComponentSection({ selectedElement, onRefresh, onPropChange, changedProps, onPropReset }: ComponentSectionProps) {
  const { reactComponents, reactProps, reactState, sourceFile } = selectedElement;
  const componentName = reactComponents[0] || null;

  if (!componentName && !reactProps && !reactState) return null;

  const handlePropChange = useCallback((propName: string, newValue: unknown) => {
    if (setReactProp(selectedElement.element, propName, newValue)) {
      onPropChange?.(propName, newValue);
      setTimeout(() => onRefresh?.(), 50);
    }
  }, [selectedElement.element, onRefresh, onPropChange]);

  const handleStateChange = useCallback((hookIndex: number, newValue: unknown) => {
    if (setReactState(selectedElement.element, hookIndex, newValue)) {
      setTimeout(() => onRefresh?.(), 50);
    }
  }, [selectedElement.element, onRefresh]);

  // Filter props safely
  const propEntries: Array<[string, unknown]> = [];
  if (reactProps) {
    const skip = new Set(["children", "ref", "key", "className", "style", "params", "searchParams"]);
    for (const key of Object.keys(reactProps)) {
      if (skip.has(key) || key.startsWith("__") || key.startsWith("data-")) continue;
      try { propEntries.push([key, reactProps[key]]); } catch {}
    }
  }

  const editableState = reactState?.filter(h => h.hasDispatch) || [];

  return (
    <Section label={componentName || "Component"} action={
      sourceFile ? <span className="retune-component-source">{sourceFile.fileName.split("/").pop()}:{sourceFile.lineNumber}</span> : undefined
    }>
      {propEntries.map(([key, value]) => (
        <RowGroup key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
          <div className="retune-row">
            <ValueInput
              value={value}
              onChange={(v) => handlePropChange(key, v)}
              isChanged={changedProps?.has(key)}
              onReset={() => onPropReset?.(key)}
            />
          </div>
        </RowGroup>
      ))}

      {editableState.map((hook) => (
        <RowGroup key={`s-${hook.index}`} label={inferStateLabel(hook.value, hook.index)}>
          <div className="retune-row">
            <ValueInput value={hook.value} onChange={(v) => handleStateChange(hook.index, v)} />
          </div>
        </RowGroup>
      ))}
    </Section>
  );
}

/** Bare input control with optional change indicator */
function ValueInput({ value, onChange, isChanged, onReset }: {
  value: unknown;
  onChange: (value: unknown) => void;
  isChanged?: boolean;
  onReset?: () => void;
}) {
  const type = getValueType(value);
  const [localValue, setLocalValue] = useState(String(value ?? ""));

  const strValue = String(value ?? "");
  if (strValue !== localValue && document.activeElement?.classList.contains("retune-prop-input") === false) {
    setLocalValue(strValue);
  }

  if (type === "boolean") {
    return (
      <div className="retune-prop">
        <ChangeIndicator isChanged={isChanged ?? false} onReset={onReset ?? (() => {})} />
        <button
          className={`retune-component-toggle${value ? " on" : ""}`}
          onClick={() => onChange(!value)}
        >
          <span className="retune-component-toggle-thumb" />
        </button>
      </div>
    );
  }

  if (type === "function") {
    return (
      <div className="retune-prop">
        <input className="retune-prop-input" style={{ paddingLeft: 12 }} value="fn()" readOnly />
      </div>
    );
  }

  if (type === "object" || type === "null") {
    return (
      <div className="retune-prop">
        <input className="retune-prop-input" style={{ paddingLeft: 12 }} value={formatValue(value)} readOnly />
      </div>
    );
  }

  return (
    <div className="retune-prop">
      <ChangeIndicator isChanged={isChanged ?? false} onReset={onReset ?? (() => {})} />
      <input
        className="retune-prop-input"
        style={{ paddingLeft: 12 }}
        type={type === "number" ? "number" : "text"}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          if (type === "number") {
            const num = parseFloat(e.target.value);
            if (!isNaN(num)) onChange(num);
          } else {
            onChange(e.target.value);
          }
        }}
        onBlur={() => {
          if (type === "number") {
            const num = parseFloat(localValue);
            if (!isNaN(num)) onChange(num);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          e.stopPropagation();
        }}
      />
    </div>
  );
}
