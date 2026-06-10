export type SelectionClickResult =
  | { kind: "noop" }
  | { kind: "replace"; primary: Element; selected: Element[] }
  | { kind: "promote"; primary: Element; selected: Element[] }
  | { kind: "toggle-off"; primary: Element | null; selected: Element[]; shiftKey: boolean; altKey: boolean }
  | { kind: "add"; primary: Element; selected: Element[] };

export function resolveSelectionClick(
  clicked: Element,
  selected: Element[],
  primary: Element | null,
  modifiers: { shiftKey: boolean; altKey: boolean },
  maxSize: number,
): SelectionClickResult | null {
  if (modifiers.altKey) {
    const index = selected.indexOf(clicked);
    if (index < 0) return null;

    const next = selected.filter((_, i) => i !== index);
    const nextPrimary = next.length === 0
      ? null
      : primary && next.includes(primary) && primary !== clicked
        ? primary
        : next[next.length - 1];

    return {
      kind: "toggle-off",
      primary: nextPrimary,
      selected: next,
      shiftKey: false,
      altKey: true,
    };
  }

  if (modifiers.shiftKey) {
    const index = selected.indexOf(clicked);
    if (index >= 0) {
      const next = selected.filter((_, i) => i !== index);
      const nextPrimary = next.length === 0
        ? null
        : primary && next.includes(primary) && primary !== clicked
          ? primary
          : next[next.length - 1];

      return {
        kind: "toggle-off",
        primary: nextPrimary,
        selected: next,
        shiftKey: true,
        altKey: false,
      };
    }

    if (selected.length >= maxSize) return null;

    const next = [...selected, clicked];
    return { kind: "add", primary: clicked, selected: next };
  }

  const index = selected.indexOf(clicked);
  if (index >= 0) {
    if (selected.length > 1) {
      return { kind: "promote", primary: clicked, selected };
    }
    return { kind: "noop" };
  }

  return { kind: "replace", primary: clicked, selected: [clicked] };
}
