/**
 * Parses a string input into a rounded integer, returning undefined for
 * non-numeric values. Uses parseFloat + Math.round instead of parseInt
 * to properly round decimal values (e.g. "4.5" -> 5, not 4).
 *
 * Fixes:
 * - Bug 7: Non-numeric strings like "abc" return undefined instead of NaN
 * - Bug 8: Decimal values like "4.5" are rounded (5) instead of truncated (4)
 */
export function parseNumericInput(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const num = parseFloat(value);
  if (isNaN(num)) return undefined;
  return Math.round(num);
}

/**
 * Clamps a string value to min/max numeric constraints.
 * If the value is not a parseable number (e.g. "auto"), returns it as-is
 * since those are valid option labels in ComboInput.
 *
 * Fixes:
 * - Bug 6: min/max constraints are now enforced on direct text input (blur)
 */
export function clampNumericValue(
  value: string | undefined,
  constraints: { min?: number; max?: number }
): string | undefined {
  if (value === undefined || value === "") return value;
  const num = parseFloat(value);
  if (isNaN(num)) return value; // non-numeric option labels like "auto"
  let clamped = num;
  if (constraints.min !== undefined) clamped = Math.max(constraints.min, clamped);
  if (constraints.max !== undefined) clamped = Math.min(constraints.max, clamped);
  if (clamped !== num) return String(clamped);
  return value;
}
