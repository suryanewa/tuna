export const SPACING_LINE_STYLE = "position:fixed;pointer-events:none;display:none;";

export const SPACING_LABEL_STYLE = `
  position:fixed;pointer-events:none;display:none;
  font-size:10px;font-weight:500;
  font-family:InterVariable,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  color:#fff;white-space:nowrap;
  background:var(--tuna-red);padding:1px 4px;border-radius:2px;
`;

export function formatSpacingDistance(value: number): string {
  return `${value}`;
}
