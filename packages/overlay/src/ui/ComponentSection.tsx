/**
 * Component Section — displays React component props and state
 * in a 2-column grid layout within the property panel.
 */

import { useState, useCallback, useRef } from "react";
import type { InspectedElement } from "../types";
import { setReactState } from "../selector/identifier";
import { Section } from "./section";
import { ChangeIndicator } from "./change-indicator";
import { SegmentedControl } from "./segmented-control";
import { SelectInput } from "./select-input";

interface ComponentSectionProps {
  selectedElement: InspectedElement;
  onRefresh?: () => void;
  onPropChange?: (propName: string, newValue: unknown) => void;
  changedProps?: Set<string>;
  onPropReset?: (propName: string) => void;
  manifest?: Record<string, any> | null;
  /** Monotonic counter — bump to revert all DOM prop previews (e.g. on "clear changes") */
  resetRevision?: number;
}

export const MANIFEST_PROMPT = `Generate a retune.manifest.json file in the project's public directory (so it's served at /retune.manifest.json). This manifest describes the project's React components and design tokens so that Retune's visual editor can show accurate controls.

Place the file where your framework serves static assets:
- Next.js: public/retune.manifest.json
- Vite/CRA: public/retune.manifest.json
- Remix: public/retune.manifest.json

For each React component in the project, include a "props" object and optionally a "state" object:

Props:
- All props with their types: "string", "number", "boolean", "enum", "function"
- For enum props, list all allowed values in a "values" array
- Default values where defined
- For props that map to CSS classes, include a "class_map" object (e.g., size: "sm" maps to class "avatar--sm")

State (for components with useState hooks):
- List each useState hook in declaration order
- Use the variable name as the key (e.g., "activeFolder", "isOpen")
- Include type, default value, and description
- Use "enum" type with "values" when state has a finite set of possible values (e.g., a folder name from a fixed list)
- Use "boolean" for toggle states, "number" for counters/IDs, "string" for free text

Example component entry:
{
  "Avatar": {
    "props": {
      "size": {
        "type": "enum",
        "values": ["sm", "md", "lg"],
        "default": "md",
        "class_map": { "sm": "avatar--sm", "md": "avatar--md", "lg": "avatar--lg" }
      }
    }
  },
  "MailApp": {
    "props": {},
    "state": {
      "activeFolder": {
        "type": "enum",
        "values": ["Inbox", "Drafts", "Sent"],
        "default": "Inbox",
        "description": "Currently selected folder"
      },
      "composeOpen": {
        "type": "boolean",
        "default": false,
        "description": "Whether the compose modal is open"
      }
    }
  }
}

For design tokens, include a "tokens" object organized by category:
- Colors, spacing, radii, typography, shadows from CSS custom properties
- For each token: the resolved value and CSS variable name
- Omit internal/framework variables (e.g., --tw-ring-color, --tw-shadow)`;

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

/** Look up manifest enum info for a component prop */
function getManifestEnum(manifest: Record<string, any> | null | undefined, componentName: string | null, propName: string): string[] | null {
  if (!manifest?.components || !componentName) return null;
  const comp = manifest.components[componentName];
  if (!comp?.props) return null;
  const propDef = comp.props[propName];
  if (propDef?.type === "enum" && Array.isArray(propDef.values) && propDef.values.length > 0) {
    return propDef.values;
  }
  return null;
}

/** Look up manifest class_map for a component prop */
function getManifestClassMap(manifest: Record<string, any> | null | undefined, componentName: string | null, propName: string): Record<string, string> | null {
  if (!manifest?.components || !componentName) return null;
  const comp = manifest.components[componentName];
  const propDef = comp?.props?.[propName];
  if (propDef?.class_map && typeof propDef.class_map === "object") {
    return propDef.class_map;
  }
  return null;
}

/** Get original prop value from reactProps or manifest default */
function getOriginalValue(reactProps: Record<string, unknown> | null, manifest: Record<string, any> | null | undefined, componentName: string | null, propName: string): unknown {
  if (reactProps && propName in reactProps) return reactProps[propName];
  if (manifest?.components && componentName) {
    const propDef = manifest.components[componentName]?.props?.[propName];
    if (propDef?.default !== undefined) return propDef.default;
  }
  return undefined;
}

/** Apply DOM-level preview for a prop change */
function applyDomPreview(
  element: Element,
  propName: string,
  oldValue: unknown,
  newValue: unknown,
  classMap: Record<string, string> | null,
) {
  // Enum with class_map: swap CSS classes directly
  if (classMap) {
    const oldClass = classMap[String(oldValue)];
    const newClass = classMap[String(newValue)];
    if (oldClass) element.classList.remove(oldClass);
    if (newClass) element.classList.add(newClass);
    return;
  }
  // String prop on a text-only element: update textContent
  if (typeof newValue === "string" && element.children.length === 0) {
    element.textContent = newValue;
  }
}

export function ComponentSection({ selectedElement, onRefresh, onPropChange, changedProps, onPropReset, manifest, resetRevision }: ComponentSectionProps) {
  const { reactComponents, reactProps, reactState, sourceFile } = selectedElement;
  const componentName = reactComponents[0] || null;

  // Build prop/state lists early so we can bail if there's nothing to show
  const propEntries: Array<[string, unknown]> = [];
  const skip = new Set(["children", "ref", "key", "className", "style", "params", "searchParams"]);
  const seen = new Set<string>();
  if (reactProps) {
    for (const key of Object.keys(reactProps)) {
      if (skip.has(key) || key.startsWith("__") || key.startsWith("data-")) continue;
      try { propEntries.push([key, reactProps[key]]); seen.add(key); } catch {}
    }
  }
  if (manifest?.components && componentName) {
    const comp = manifest.components[componentName];
    if (comp?.props) {
      for (const [key, def] of Object.entries<any>(comp.props)) {
        if (seen.has(key) || skip.has(key)) continue;
        if (def.default !== undefined) {
          propEntries.push([key, def.default]);
        }
      }
    }
  }
  const editableState = reactState?.filter(h => h.hasDispatch) || [];

  // Only show section when there are actual props or state to display
  if (propEntries.length === 0 && editableState.length === 0) return null;

  // Track current previewed values so reset can revert correctly
  const previewedRef = useRef<Record<string, unknown>>({});
  const lastResetRevRef = useRef(resetRevision ?? 0);

  // Revert all DOM prop previews when resetRevision bumps (global "clear changes")
  if (resetRevision !== undefined && resetRevision !== lastResetRevRef.current) {
    lastResetRevRef.current = resetRevision;
    for (const [propName, currentValue] of Object.entries(previewedRef.current)) {
      const originalValue = getOriginalValue(reactProps, manifest, componentName, propName);
      if (originalValue !== undefined) {
        const classMap = getManifestClassMap(manifest, componentName, propName);
        applyDomPreview(selectedElement.element, propName, currentValue, originalValue, classMap);
      }
    }
    previewedRef.current = {};
  }

  const handlePropChange = useCallback((propName: string, newValue: unknown) => {
    const oldValue = previewedRef.current[propName] ?? getOriginalValue(reactProps, manifest, componentName, propName);
    // Apply DOM preview first so scope levels can read updated classes
    const classMap = getManifestClassMap(manifest, componentName, propName);
    applyDomPreview(selectedElement.element, propName, oldValue, newValue, classMap);
    previewedRef.current[propName] = newValue;
    onPropChange?.(propName, newValue);
  }, [selectedElement.element, reactProps, manifest, componentName, onPropChange]);

  const handlePropReset = useCallback((propName: string) => {
    const currentValue = previewedRef.current[propName];
    const originalValue = getOriginalValue(reactProps, manifest, componentName, propName);
    if (currentValue !== undefined && originalValue !== undefined) {
      const classMap = getManifestClassMap(manifest, componentName, propName);
      applyDomPreview(selectedElement.element, propName, currentValue, originalValue, classMap);
    }
    delete previewedRef.current[propName];
    // Notify after DOM revert so scope levels read updated classes
    onPropReset?.(propName);
  }, [selectedElement.element, reactProps, manifest, componentName, onPropReset]);

  const handleStateChange = useCallback((hookIndex: number, newValue: unknown) => {
    if (setReactState(selectedElement.element, hookIndex, newValue)) {
      setTimeout(() => onRefresh?.(), 50);
    }
  }, [selectedElement.element, onRefresh]);

  // propEntries and editableState already computed above the early return

  // Resolve manifest state definitions (ordered keys map to editable state order)
  const manifestStateDefs: Array<{ name: string; def: any }> = [];
  if (manifest?.components && componentName) {
    const compState = manifest.components[componentName]?.state;
    if (compState) {
      for (const [name, def] of Object.entries<any>(compState)) {
        manifestStateDefs.push({ name, def });
      }
    }
  }

  // Stabilize inferred labels (no-manifest fallback) — compute once from initial values
  const inferredLabelsRef = useRef<Map<number, string>>(new Map());
  for (const hook of editableState) {
    if (!inferredLabelsRef.current.has(hook.index)) {
      inferredLabelsRef.current.set(hook.index, inferStateLabel(hook.value, hook.index));
    }
  }

  function getStateLabel(hook: { index: number; value: unknown }, editableIndex: number): string {
    const manifestEntry = manifestStateDefs[editableIndex];
    if (manifestEntry) {
      return manifestEntry.name.charAt(0).toUpperCase() + manifestEntry.name.slice(1).replace(/([A-Z])/g, " $1").trim();
    }
    return inferredLabelsRef.current.get(hook.index) || `state ${hook.index + 1}`;
  }

  function getStateEnum(editableIndex: number): string[] | null {
    const manifestEntry = manifestStateDefs[editableIndex];
    if (manifestEntry?.def?.type === "enum" && Array.isArray(manifestEntry.def.values) && manifestEntry.def.values.length > 0) {
      return manifestEntry.def.values;
    }
    return null;
  }

  const allEntries: Array<{ key: string; label: string; value: unknown; type: "prop" | "state"; enumValues?: string[] | null; hookIndex?: number }> = [];
  for (const [key, value] of propEntries) {
    allEntries.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), value, type: "prop", enumValues: getManifestEnum(manifest, componentName, key) });
  }
  for (let i = 0; i < editableState.length; i++) {
    const hook = editableState[i];
    allEntries.push({ key: `s-${hook.index}`, label: getStateLabel(hook, i), value: hook.value, type: "state", enumValues: getStateEnum(i), hookIndex: hook.index });
  }

  return (
    <Section label={componentName || "Component"} action={
      sourceFile ? <span className="retune-component-source">{sourceFile.fileName.split("/").pop()}:{sourceFile.lineNumber}</span> : undefined
    }>
      <div className="retune-component-grid">
        {allEntries.map((entry) => {
          const valueType = getValueType(entry.value);
          const isToggle = valueType === "boolean";
          const isChanged = entry.type === "prop" ? changedProps?.has(entry.key) : false;

          return (
            <div key={entry.key} className="retune-component-field">
              <span className="retune-component-field-label">{entry.label}</span>
              {entry.enumValues ? (
                <SelectInput
                  prop={entry.key}
                  value={String(previewedRef.current[entry.key] ?? entry.value ?? "")}
                  options={entry.enumValues}
                  onChange={(_prop, v) => entry.type === "prop" ? handlePropChange(entry.key, v) : handleStateChange(entry.hookIndex!, v)}
                  isChanged={isChanged}
                  onReset={() => handlePropReset(entry.key)}
                />
              ) : isToggle ? (
                <SegmentedControl
                  options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
                  value={entry.value ? "true" : "false"}
                  onChange={(v) => {
                    const boolVal = v === "true";
                    entry.type === "prop" ? handlePropChange(entry.key, boolVal) : handleStateChange(entry.hookIndex!, boolVal);
                  }}
                />
              ) : (
                <ValueInput
                  value={entry.value}
                  onChange={(v) => entry.type === "prop" ? handlePropChange(entry.key, v) : handleStateChange(entry.hookIndex!, v)}
                  isChanged={isChanged}
                  onReset={entry.type === "prop" ? () => handlePropReset(entry.key) : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
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
  const focusedRef = useRef(false);

  const strValue = String(value ?? "");
  if (strValue !== localValue && !focusedRef.current) {
    setLocalValue(strValue);
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
        onFocus={() => { focusedRef.current = true; }}
        onBlur={() => {
          focusedRef.current = false;
          if (type === "number") {
            const num = parseFloat(localValue);
            if (!isNaN(num)) onChange(num);
          }
        }}
        onChange={(e) => {
          setLocalValue(e.target.value);
          if (type === "number") {
            const num = parseFloat(e.target.value);
            if (!isNaN(num)) onChange(num);
          } else {
            onChange(e.target.value);
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
