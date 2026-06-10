import { describe, expect, it } from "vitest";
import { resolveSelectionClick } from "../selector/selection-click";

function el(id: string): Element {
  return { id } as unknown as Element;
}

describe("resolveSelectionClick", () => {
  const a = el("a");
  const b = el("b");
  const c = el("c");

  it("replaces selection on plain click of an unselected element", () => {
    expect(resolveSelectionClick(c, [a, b], a, { shiftKey: false, altKey: false }, 8)).toEqual({
      kind: "replace",
      primary: c,
      selected: [c],
    });
  });

  it("promotes an already-selected element without collapsing multi-select", () => {
    expect(resolveSelectionClick(b, [a, b], a, { shiftKey: false, altKey: false }, 8)).toEqual({
      kind: "promote",
      primary: b,
      selected: [a, b],
    });
  });

  it("noops when the sole selected element is clicked again", () => {
    expect(resolveSelectionClick(a, [a], a, { shiftKey: false, altKey: false }, 8)).toEqual({
      kind: "noop",
    });
  });

  it("adds to multi-select with shift+click", () => {
    expect(resolveSelectionClick(c, [a], a, { shiftKey: true, altKey: false }, 8)).toEqual({
      kind: "add",
      primary: c,
      selected: [a, c],
    });
  });

  it("starts a selection with shift+click when nothing is selected", () => {
    expect(resolveSelectionClick(a, [], null, { shiftKey: true, altKey: false }, 8)).toEqual({
      kind: "add",
      primary: a,
      selected: [a],
    });
  });

  it("removes from multi-select with shift+click toggle", () => {
    expect(resolveSelectionClick(b, [a, b], a, { shiftKey: true, altKey: false }, 8)).toEqual({
      kind: "toggle-off",
      primary: a,
      selected: [a],
      shiftKey: true,
      altKey: false,
    });
  });

  it("removes from multi-select with alt+click", () => {
    expect(resolveSelectionClick(b, [a, b], a, { shiftKey: false, altKey: true }, 8)).toEqual({
      kind: "toggle-off",
      primary: a,
      selected: [a],
      shiftKey: false,
      altKey: true,
    });
  });

  it("clears selection when alt+click removes the last element", () => {
    expect(resolveSelectionClick(a, [a], a, { shiftKey: false, altKey: true }, 8)).toEqual({
      kind: "toggle-off",
      primary: null,
      selected: [],
      shiftKey: false,
      altKey: true,
    });
  });

  it("ignores alt+click on an unselected element", () => {
    expect(resolveSelectionClick(c, [a, b], a, { shiftKey: false, altKey: true }, 8)).toBeNull();
  });

  it("ignores shift+click when the pool is full", () => {
    const pool = [el("1"), el("2"), el("3")];
    expect(resolveSelectionClick(c, pool, pool[2], { shiftKey: true, altKey: false }, 3)).toBeNull();
  });
});
