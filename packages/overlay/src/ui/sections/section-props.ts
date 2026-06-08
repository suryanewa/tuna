/**
 * Shared props interface for all property panel sections.
 *
 * PropertyPanel computes these once and passes them to each section.
 * Sections are standalone components that can be used in the overlay,
 * canvas, or any future surface.
 */

import type { InspectedElement } from "../../types";
import type { BoxModelProperty } from "../box-model-overlay";
import type { VariableMatch, DesignVariable } from "../../variables/types";

export type ForcedState = ":hover" | ":focus" | ":active" | null;
export type SelectorCandidate = { selector: string; count: number; verdict: "semantic" | "utility" | "ambiguous" };
export type ScopeLevel = { label: string; selector: string | null; count: number; kind?: string };
export type StyleSource = { selector: string; value: string };

/** Props shared by all sections — computed styles + change/variable helpers */
export interface BaseSectionProps {
  /** The inspected element */
  element: InspectedElement;
  /** Computed styles (shortcut for element.computedStyles) */
  s: Record<string, string>;
  /** Apply a CSS property change */
  onPropertyChange: (property: string, value: string) => void;
  /** Record an HTML/SVG attribute change */
  onAttributeChange?: (attr: string, oldValue: string, newValue: string) => void;
  /** Hover a box-model property (shows overlay) */
  onPropertyHover?: (property: BoxModelProperty) => void;
  /** Apply a style directly to an element (for token swap class changes) */
  onApplyToElement?: (element: Element, property: string, value: string) => void;

  // ── Variable/token helpers ──
  /** Get variable props for a NumberInput/ComboInput */
  variableProps: (camelProp: string) => Record<string, any>;
  /** Get variable props for a ShorthandInput */
  shorthandVariableProps: (camelProps: string[]) => Record<string, any>;
  /** Get change indicator props for a property */
  changeProps: (camelProp: string) => { isChanged: boolean; onReset: () => void };
  /** Get change indicator props for a shorthand group */
  shorthandChangeProps: (camelProps: string[]) => { isChanged: boolean; onReset: () => void };
  /** Handle selecting a new token from the token picker */
  handleVariableSelect: (oldToken: DesignVariable, newToken: DesignVariable, fallbackProperties?: string[]) => void;
  /** Handle applying a token to properties for the first time */
  handleVariableApply: (newToken: DesignVariable, properties: string[]) => void;

  // ── Derived layout context ──
  /** Is this element a flex child? */
  isFlexChild: boolean;
  /** Is this element a grid child? */
  isGridChild: boolean;
  /** Parent flex direction */
  parentFlexDir: string;
}

/** Props for the Scope section */
export interface ScopeSectionProps {
  element: InspectedElement;
  selectedCount?: number;
  scopeLevels: ScopeLevel[];
  activeLevelIndex: number;
  onScopeLevelChange?: (index: number) => void;
  onScopeLevelHover?: (index: number | null) => void;
  forcedState?: ForcedState;
  onForcedStateChange?: (state: ForcedState) => void;
}

/** Props for the Position section */
export interface PositionSectionProps extends BaseSectionProps {
  /** Hover a box-model property (shows overlay) */
  onPropertyHover?: (property: BoxModelProperty) => void;
  /** Notify parent when pin lines change */
  onPinLinesChange?: (authored: { top: boolean; right: boolean; bottom: boolean; left: boolean }) => void;
  /** Apply a style directly to an element */
  onApplyToElement?: (element: Element, property: string, value: string) => void;
}

/** Props for the Size section */
export interface SizeSectionProps extends BaseSectionProps {
  /** When set, shows iframe dimensions instead of CSS width/height */
  frameDimensions?: { width: number; height: number; onResize: (width: number, height: number) => void };
}

/** Props for the Typography section */
export interface TypographySectionProps extends BaseSectionProps {
  /** Whether the element contains text content */
  isText: boolean;
  /** Whether the element supports vertical-align */
  hasVerticalAlign: boolean;
}
