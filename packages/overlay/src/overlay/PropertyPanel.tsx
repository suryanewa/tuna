/**
 * PropertyPanel — the right-side inspector panel showing
 * editable properties for the selected element.
 *
 * Thin orchestrator: computes shared state (styles, variable/token helpers,
 * derived booleans) and renders extracted section components conditionally.
 */

import { useMemo, useCallback } from "react";
import type { InspectedElement } from "../types";
import type { BoxModelProperty } from "../ui/box-model-overlay";
import type { VariableMatch } from "../variables/types";
import { resolveVariablesForElement, isRawUtility } from "../variables/resolver";
import { MIXED_VALUE } from "../ui/mixed-value";

// ── Section components ──
import { ScopeSection } from "../ui/sections/ScopeSection";
import { PositionSection } from "../ui/sections/PositionSection";
import { LayoutSection } from "../ui/sections/LayoutSection";
import { SpacingSection } from "../ui/sections/SpacingSection";
import { SizeSection } from "../ui/sections/SizeSection";
import { TypographySection } from "../ui/sections/TypographySection";
import { FillSection } from "../ui/sections/FillSection";
import { BorderSection } from "../ui/sections/BorderSection";
import { ShadowSection } from "../ui/sections/ShadowSection";
import { FiltersSection } from "../ui/sections/FiltersSection";
import { ImageSection } from "../ui/sections/ImageSection";

type ForcedState = ":hover" | ":focus" | ":active" | null;

type SelectorCandidate = { selector: string; count: number; verdict: "semantic" | "utility" | "ambiguous" };
type ScopeLevel = { label: string; selector: string | null; count: number; kind?: string };
type StyleSource = { selector: string; value: string };

export function PropertyPanel({
  element,
  selectedElements = [element],
  position,
  onPropertyChange,
  onAttributeChange,
  onPropertyHover,
  onApplyToElement,
  onVariableSwap,
  onVariableAssociate,
  onVariableUnlink,
  variableAssociations = {},
  unlinkedVariables,
  changedProperties,
  onPropertyReset,
  selectorCandidates = [],
  activeSelector = null,
  scopeLevels = [] as ScopeLevel[],
  activeLevelIndex = 0,
  onScopeLevelChange,
  onScopeLevelHover,
  ownedProperties,
  styleSources = {},
  forcedState = null,
  onForcedStateChange,
  onPinLinesChange,
  frameDimensions,
}: {
  element: InspectedElement;
  selectedElements?: InspectedElement[];
  position: "left" | "right";
  onPropertyChange: (property: string, value: string) => void;
  /** Record an HTML/SVG attribute change (not CSS) */
  onAttributeChange?: (attr: string, oldValue: string, newValue: string) => void;
  onPropertyHover?: (property: BoxModelProperty) => void;
  onApplyToElement?: (element: Element, property: string, value: string) => void;
  onVariableSwap?: (oldClassName: string, newClassName: string) => void;
  /** Record a value-only token association (persisted in change tracker) */
  onVariableAssociate?: (properties: string[], token: { className: string; values: Record<string, string> }) => void;
  /** Clear token association for properties */
  onVariableUnlink?: (properties: string[]) => void;
  /** Current value-only token associations from change tracker */
  variableAssociations?: Record<string, { className: string; values: Record<string, string> }>;
  /** Properties explicitly unlinked from their token */
  unlinkedVariables?: Set<string>;
  /** Properties that have been changed from their original value */
  changedProperties?: Set<string>;
  /** Reset a single property to its original value */
  onPropertyReset?: (property: string) => void;
  selectorCandidates?: SelectorCandidate[];
  activeSelector?: string | null;
  scopeLevels?: ScopeLevel[];
  activeLevelIndex?: number;
  onScopeLevelChange?: (index: number) => void;
  onScopeLevelHover?: (index: number | null) => void;
  /** Properties owned by CSS rules matching the active scope. undefined = show all. */
  ownedProperties?: Set<string>;
  styleSources?: Record<string, StyleSource>;
  forcedState?: ForcedState;
  onForcedStateChange?: (state: ForcedState) => void;
  onPinLinesChange?: (authored: { top: boolean; right: boolean; bottom: boolean; left: boolean }) => void;
  /** When set, the Size section shows iframe dimensions instead of computed CSS width/height */
  frameDimensions?: { width: number; height: number; onResize: (width: number, height: number) => void };
}) {
  const rawStyles = useMemo(() => {
    if (selectedElements.length <= 1) return element.computedStyles;

    const styles = { ...element.computedStyles };
    const keys = new Set<string>(Object.keys(styles));
    for (const selected of selectedElements) {
      for (const key of Object.keys(selected.computedStyles)) keys.add(key);
    }

    for (const key of keys) {
      const first = selectedElements[0]?.computedStyles[key] ?? "";
      const mixed = selectedElements.some((selected) => (selected.computedStyles[key] ?? "") !== first);
      if (mixed) styles[key] = MIXED_VALUE;
      else styles[key] = first;
    }

    return styles;
  }, [element.computedStyles, selectedElements]);

  // Scope-aware styles: getScopedStyles already returns scoped values for owned
  // properties and computed values for the rest. No Proxy needed.
  const s = rawStyles;

  // ── Token resolution ──
  const variableMatches = useMemo(() => {
    if (!element.element) return new Map<string, VariableMatch>();
    return resolveVariablesForElement(element.element, s, activeSelector ?? undefined);
  }, [element.element, s, activeSelector]);

  // Helper: get token match for a camelCase prop.
  // User-set associations take priority over element-scanned matches, since the
  // user explicitly chose a token (e.g., swapping var(--spacing-4) → var(--spacing-8)).
  const getVariableMatch = useCallback((camelProp: string): VariableMatch | undefined => {
    // Skip properties that the user explicitly unlinked
    if (unlinkedVariables?.has(camelProp)) return undefined;
    const kebab = camelProp.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
    // Check persisted associations first (user's explicit choice takes priority)
    const assoc = variableAssociations[camelProp];
    if (assoc) return { variable: assoc, property: kebab };
    // Then element-scanned matches (class-based + CSS variable detection)
    const match = variableMatches.get(kebab);
    if (match && !isRawUtility(match.variable)) return match;
    return undefined;
  }, [variableMatches, variableAssociations, unlinkedVariables]);

  // Handle token swap: swap classes on the element.
  // If the old token's class is on the element, do a class swap.
  // If not (value-only apply), just update values without touching classes.
  // `fallbackProperties` provides the affected CSS properties when the token was
  // auto-detected from stylesheets (no entry in variableAssociations).
  const handleVariableSelect = useCallback((oldToken: import("../variables/types").DesignVariable, newToken: import("../variables/types").DesignVariable, fallbackProperties?: string[]) => {
    const el = element.element;
    if (!el) return;
    const isClassBased = el.classList.contains(oldToken.className);
    const newIsVariable = newToken.className.startsWith("var(");
    if (isClassBased && !newIsVariable) {
      // Class-based swap (both old and new are class tokens)
      el.classList.remove(oldToken.className);
      el.classList.add(newToken.className);
      onVariableSwap?.(oldToken.className, newToken.className);
      for (const [prop, val] of Object.entries(newToken.values)) {
        const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        onPropertyChange(camelProp, val);
      }
    } else {
      // Value-only swap: find which properties had the old token applied
      const affectedProps: string[] = [];
      for (const [prop, ref] of Object.entries(variableAssociations)) {
        if (ref.className === oldToken.className) {
          affectedProps.push(prop);
        }
      }
      // Fallback for element-scanned tokens (detected from stylesheets, no explicit association)
      if (affectedProps.length === 0 && fallbackProperties) {
        affectedProps.push(...fallbackProperties);
      }
      const value = Object.values(newToken.values)[0];
      if (!value) return;
      for (const prop of affectedProps) {
        onPropertyChange(prop, value);
      }
      onVariableAssociate?.(affectedProps, { className: newToken.className, values: newToken.values });
    }
  }, [element.element, onVariableSwap, onPropertyChange, variableAssociations, onVariableAssociate]);

  // Handle applying a token value from scratch (no existing token on element).
  // This is a value pick — we set the token's representative value on the specific
  // properties being edited, without adding the class. This lets the user apply
  // different tokens to different sides (e.g. different H and V padding).
  const handleVariableApply = useCallback((newToken: import("../variables/types").DesignVariable, properties: string[]) => {
    const el = element.element;
    if (!el) return;
    const value = Object.values(newToken.values)[0];
    if (!value) return;
    for (const prop of properties) {
      onPropertyChange(prop, value);
    }
    onVariableAssociate?.(properties, { className: newToken.className, values: newToken.values });
  }, [element.element, onPropertyChange, onVariableAssociate]);

  // Handle unlinking a token from a property (clears association without changing value)
  const handleVariableUnlink = useCallback((camelProp: string) => {
    onVariableUnlink?.([camelProp]);
  }, [onVariableUnlink]);

  // Token props for a NumberInput
  const variablePropsHelper = useCallback((camelProp: string) => {
    const match = getVariableMatch(camelProp);
    return {
      ...(match ? { variableMatch: match, onVariableSelect: handleVariableSelect, onVariableUnlink: () => handleVariableUnlink(camelProp) } : {}),
      property: camelProp,
      onVariableApply: handleVariableApply,
    };
  }, [getVariableMatch, handleVariableSelect, handleVariableApply, handleVariableUnlink]);

  // Token props for ShorthandInput — only shows variable indicator when ALL props share the same variable
  const shorthandVariablePropsHelper = useCallback((camelProps: string[]) => {
    const allMatches = camelProps.map(p => getVariableMatch(p));
    const firstMatch = allMatches.find(m => m !== undefined);
    if (!firstMatch) return { property: camelProps[0], onVariableApply: handleVariableApply };

    // Only show as variable-applied when ALL properties share the same variable
    const allSameVar = allMatches.every(
      m => m !== undefined && m.variable.className === firstMatch.variable.className
    );
    if (allSameVar) {
      return {
        variableMatch: firstMatch, property: camelProps[0],
        onVariableSelect: handleVariableSelect, onVariableApply: handleVariableApply,
        onVariableUnlink: () => onVariableUnlink?.(camelProps),
      };
    }
    return { property: camelProps[0], onVariableApply: handleVariableApply };
  }, [getVariableMatch, handleVariableSelect, handleVariableApply, onVariableUnlink]);

  // Change indicator props for a single property
  const changePropsHelper = useCallback((camelProp: string) => ({
    isChanged: changedProperties?.has(camelProp) ?? false,
    onReset: () => onPropertyReset?.(camelProp),
  }), [changedProperties, onPropertyReset]);

  // Change indicator props for shorthand groups: changed if ANY property in the group changed
  const shorthandChangePropsHelper = useCallback((camelProps: string[]) => ({
    isChanged: camelProps.some(p => changedProperties?.has(p)) ?? false,
    onReset: () => { for (const p of camelProps) onPropertyReset?.(p); },
  }), [changedProperties, onPropertyReset]);

  // ── Derived booleans ──
  const TEXT_TAGS = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", "BUTTON", "LABEL", "LI", "TD", "TH", "FIGCAPTION", "BLOCKQUOTE", "CITE", "EM", "STRONG", "SMALL"];
  const hasDirectText = element.element ? Array.from(element.element.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
  ) : false;
  const isText = TEXT_TAGS.includes(element.tagName) || hasDirectText;
  const displayValue = s.display || "block";
  const isFlex = displayValue.includes("flex");
  const isGrid = displayValue.includes("grid");
  const positionType = s.position || "static";
  const isPositioned = positionType !== "static";
  const showOffsets = positionType === "absolute" || positionType === "fixed" || positionType === "relative";
  const isSticky = positionType === "sticky";
  const hasVerticalAlign = isText || ["IMG", "INPUT", "SELECT", "TEXTAREA"].includes(element.tagName) || isFlex || isGrid;
  const isImage = element.tagName === "IMG" || element.tagName === "PICTURE" || element.tagName === "CANVAS";
  const isVideo = element.tagName === "VIDEO";
  const isSvg = element.tagName === "SVG" || element.tagName === "svg";
  const isSvgChild = !isSvg && !!element.element?.closest("svg");
  const isMedia = isImage || isVideo;
  const hasBackgroundImage = s.backgroundImage && s.backgroundImage !== "none" && !s.backgroundImage.startsWith("linear-gradient") && !s.backgroundImage.startsWith("radial-gradient");

  // Detect if element is a child of a flex/grid container
  const parentDisplay = element.element?.parentElement
    ? getComputedStyle(element.element.parentElement).display
    : "";
  const isFlexChild = parentDisplay.includes("flex");
  const isGridChild = parentDisplay.includes("grid");

  // Parent flex direction (for sizing mode)
  const parentFlexDir = isFlexChild && element.element?.parentElement
    ? getComputedStyle(element.element.parentElement).flexDirection || "row"
    : "row";

  // ── Shared base props for sections ──
  const baseProps = {
    element,
    s,
    onPropertyChange,
    onAttributeChange,
    onPropertyHover,
    onApplyToElement,
    variableProps: variablePropsHelper,
    shorthandVariableProps: shorthandVariablePropsHelper,
    changeProps: changePropsHelper,
    shorthandChangeProps: shorthandChangePropsHelper,
    handleVariableSelect,
    handleVariableApply,
    isFlexChild,
    isGridChild,
    parentFlexDir,
  };

  return (
    <>
      {/* Scope — hidden for frame node selection (body has no meaningful scope) */}
      {!frameDimensions && (
        <ScopeSection
          element={element}
          selectedCount={selectedElements.length}
          scopeLevels={scopeLevels}
          activeLevelIndex={activeLevelIndex}
          onScopeLevelChange={onScopeLevelChange}
          onScopeLevelHover={onScopeLevelHover}
          forcedState={forcedState}
          onForcedStateChange={onForcedStateChange}
        />
      )}

      {/* Position (hidden for SVG child shapes) */}
      {!isSvgChild && (
        <PositionSection
          {...baseProps}
          onPinLinesChange={onPinLinesChange}
        />
      )}

      {/* Layout (hidden for SVG child shapes) */}
      {!isSvgChild && (
        <LayoutSection
          {...baseProps}
        />
      )}

      {/* Spacing */}
      <SpacingSection
        s={s}
        onPropertyChange={onPropertyChange}
        onPropertyHover={onPropertyHover}
        variableProps={variablePropsHelper}
        shorthandVariableProps={shorthandVariablePropsHelper}
        changeProps={changePropsHelper}
        shorthandChangeProps={shorthandChangePropsHelper}
      />

      {/* Size */}
      <SizeSection
        {...baseProps}
        frameDimensions={frameDimensions}
      />

      {/* Typography (returns null internally when !isText) */}
      {!isSvgChild && (
        <TypographySection
          {...baseProps}
          isText={isText}
          hasVerticalAlign={hasVerticalAlign}
        />
      )}

      {/* Fill / Appearance / SVG Fill+Stroke */}
      <FillSection
        {...baseProps}
        isSvgChild={isSvgChild}
        isMedia={isMedia}
        getVariableMatch={getVariableMatch}
        onVariableAssociate={onVariableAssociate}
        onPropertyReset={onPropertyReset}
      />

      {/* Image / Video / Background Image — after Appearance, before Border */}
      {(isImage || isVideo || hasBackgroundImage) && (
        <ImageSection
          {...baseProps}
          isImage={isImage}
          isVideo={isVideo}
          hasBackgroundImage={!!hasBackgroundImage}
        />
      )}

      {/* Border (hidden for SVG child shapes — they use Stroke in FillSection) */}
      {!isSvgChild && (
        <BorderSection
          s={s}
          onPropertyChange={onPropertyChange}
          variableProps={variablePropsHelper}
          shorthandVariableProps={shorthandVariablePropsHelper}
          changeProps={changePropsHelper}
          shorthandChangeProps={shorthandChangePropsHelper}
        />
      )}

      {/* Shadow */}
      <ShadowSection
        {...baseProps}
      />

      {/* Filters (hidden for SVG child shapes) */}
      {!isSvgChild && (
        <FiltersSection
          {...baseProps}
        />
      )}
    </>
  );
}
