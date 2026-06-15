export const MIXED_VALUE = "__tuna_mixed__";
export const MIXED_LABEL = "Mixed";

export function isMixedValue(value: string | undefined): boolean {
  return value === MIXED_VALUE;
}
