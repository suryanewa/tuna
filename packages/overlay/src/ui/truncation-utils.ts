/**
 * Centralized truncation logic for text elements.
 *
 * Three modes:
 *   1. Disabled — no truncation
 *   2. Single-line ellipsis (lines === 1)
 *   3. Multi-line clamp (lines >= 2, uses -webkit-line-clamp)
 */

export interface TruncationContext {
  /** Current CSS `display` value of the element */
  currentDisplay: string;
}

export interface TruncationState {
  enabled: boolean;
  /** 1 for single-line ellipsis, 2+ for multi-line clamp */
  lines: number;
}

/** Detect current truncation state from computed styles. */
export function detectTruncation(styles: Record<string, string>): TruncationState {
  const lineClamp = styles.webkitLineClamp;
  const hasClamp = !!lineClamp && lineClamp !== "none" && lineClamp !== "unset";

  if (hasClamp) {
    return { enabled: true, lines: parseInt(lineClamp, 10) || 2 };
  }

  const hasSingleLine =
    styles.textOverflow === "ellipsis" && styles.whiteSpace === "nowrap";

  if (hasSingleLine) {
    return { enabled: true, lines: 1 };
  }

  return { enabled: false, lines: 1 };
}

/**
 * Returns a map of CSS properties to set for the given truncation state.
 *
 * The caller should iterate over the entries and apply each one via
 * `onPropertyChange(prop, value)`.
 */
export function computeTruncationChanges(
  state: TruncationState,
  ctx: TruncationContext,
): Record<string, string> {
  const changes: Record<string, string> = {};

  if (!state.enabled) {
    // Disabled — clear all truncation properties
    changes.textOverflow = "clip";
    changes.overflow = "visible";
    changes.whiteSpace = "normal";
    changes.webkitLineClamp = "unset";
    changes.webkitBoxOrient = "unset";
    changes.minWidth = "0px";
    if (ctx.currentDisplay === "-webkit-box") {
      changes.display = "block";
    }
    return changes;
  }

  if (state.lines <= 1) {
    // Single-line ellipsis
    changes.textOverflow = "ellipsis";
    changes.overflow = "hidden";
    changes.whiteSpace = "nowrap";
    changes.webkitLineClamp = "unset";
    changes.webkitBoxOrient = "unset";
    changes.minWidth = "0px";
    if (ctx.currentDisplay === "-webkit-box") {
      changes.display = "block";
    }
    return changes;
  }

  // Multi-line clamp (lines >= 2)
  changes.display = "-webkit-box";
  changes.webkitBoxOrient = "vertical";
  changes.webkitLineClamp = String(state.lines);
  changes.overflow = "hidden";
  changes.textOverflow = "ellipsis";
  changes.whiteSpace = "normal";
  changes.minWidth = "0px";

  return changes;
}
