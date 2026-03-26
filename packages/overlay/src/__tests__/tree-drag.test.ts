import { describe, it, expect, beforeAll } from "vitest";
import { computeDropIndex, getVisibleChildren } from "../overlay/ElementTree";

// ── Polyfills for Node (no browser APIs) ──

class MockDOMRect {
  x: number; y: number; width: number; height: number;
  top: number; right: number; bottom: number; left: number;
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x; this.y = y; this.width = width; this.height = height;
    this.left = x; this.top = y; this.right = x + width; this.bottom = y + height;
  }
  toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

beforeAll(() => {
  (globalThis as any).DOMRect = MockDOMRect;
});

// ── computeDropIndex ──

describe("computeDropIndex", () => {
  function makeRects(...tops: number[]): DOMRect[] {
    return tops.map(top => new MockDOMRect(0, top, 200, 32) as unknown as DOMRect);
  }

  it("returns 0 when cursor is above all siblings", () => {
    const rects = makeRects(100, 132, 164);
    expect(computeDropIndex(50, rects)).toBe(0);
  });

  it("returns length when cursor is below all siblings", () => {
    const rects = makeRects(100, 132, 164);
    expect(computeDropIndex(200, rects)).toBe(3);
  });

  it("returns correct index based on midpoint comparison", () => {
    const rects = makeRects(100, 132, 164);
    // Midpoints: 116, 148, 180
    expect(computeDropIndex(110, rects)).toBe(0); // above first midpoint
    expect(computeDropIndex(120, rects)).toBe(1); // below first, above second
    expect(computeDropIndex(150, rects)).toBe(2); // below second, above third
    expect(computeDropIndex(185, rects)).toBe(3); // below all
  });

  it("returns 0 for single sibling when cursor is above midpoint", () => {
    const rects = makeRects(100); // midpoint = 116
    expect(computeDropIndex(110, rects)).toBe(0);
  });

  it("returns 1 for single sibling when cursor is below midpoint", () => {
    const rects = makeRects(100); // midpoint = 116
    expect(computeDropIndex(120, rects)).toBe(1);
  });

  it("handles empty rects array", () => {
    expect(computeDropIndex(100, [])).toBe(0);
  });

  it("returns correct index for 5-element list", () => {
    const rects = makeRects(0, 32, 64, 96, 128);
    // Midpoints: 16, 48, 80, 112, 144
    expect(computeDropIndex(10, rects)).toBe(0);
    expect(computeDropIndex(30, rects)).toBe(1);
    expect(computeDropIndex(150, rects)).toBe(5);
  });

  it("cursor exactly at midpoint goes to next index", () => {
    const rects = makeRects(100, 132);
    // Midpoint of first: 116 — cursorY < midY is false at 116
    expect(computeDropIndex(116, rects)).toBe(1);
  });
});

// ── getVisibleChildren (with minimal DOM mock) ──

describe("getVisibleChildren", () => {
  function mockElement(tag: string, attrs: Record<string, string> = {}): Element {
    return {
      tagName: tag.toUpperCase(),
      hasAttribute: (name: string) => name in attrs,
      children: [] as any,
    } as unknown as Element;
  }

  function mockParent(children: Element[]): Element {
    return {
      tagName: "DIV",
      hasAttribute: () => false,
      children,
      [Symbol.iterator]: function* () { yield* children; },
    } as unknown as Element;
  }

  it("returns all visible children", () => {
    const a = mockElement("p");
    const b = mockElement("span");
    const parent = mockParent([a, b]);
    expect(getVisibleChildren(parent)).toEqual([a, b]);
  });

  it("filters out SCRIPT and STYLE tags", () => {
    const p = mockElement("p");
    const script = mockElement("script");
    const style = mockElement("style");
    const parent = mockParent([p, script, style]);
    expect(getVisibleChildren(parent)).toEqual([p]);
  });

  it("filters out skip tags", () => {
    const div = mockElement("div");
    const meta = mockElement("meta");
    const link = mockElement("link");
    const br = mockElement("br");
    const parent = mockParent([div, meta, link, br]);
    expect(getVisibleChildren(parent)).toEqual([div]);
  });

  it("filters out retune overlay elements", () => {
    const child = mockElement("div");
    const retuneHost = mockElement("div", { "data-retune-host": "" });
    const retuneHighlight = mockElement("div", { "data-retune-highlight": "" });
    const parent = mockParent([child, retuneHost, retuneHighlight]);
    expect(getVisibleChildren(parent)).toEqual([child]);
  });

  it("uses visualOrderMap when available", () => {
    const a = mockElement("p");
    const b = mockElement("span");
    const c = mockElement("div");
    const parent = mockParent([a, b, c]);

    const map = new Map<Element, Element[]>();
    map.set(parent, [c, a, b]);
    expect(getVisibleChildren(parent, map)).toEqual([c, a, b]);
  });

  it("returns empty array when all children are filtered", () => {
    const script = mockElement("script");
    const style = mockElement("style");
    const parent = mockParent([script, style]);
    expect(getVisibleChildren(parent)).toEqual([]);
  });
});

// ── Reorder index computation ──

describe("reorder index computation", () => {
  it("from index 0 to after-all in 5-element list", () => {
    const arr = ["A", "B", "C", "D", "E"];
    const fromIndex = 0;
    const toIndex = 5; // computeDropIndex returns length for "after all"

    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);

    expect(arr).toEqual(["B", "C", "D", "E", "A"]);
  });

  it("from last index to index 0", () => {
    const arr = ["A", "B", "C", "D", "E"];
    const fromIndex = 4;
    const toIndex = 0;

    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);

    expect(arr).toEqual(["E", "A", "B", "C", "D"]);
  });

  it("adjacent swap down (cursor past neighbor midpoint)", () => {
    const arr = ["A", "B", "C"];
    const fromIndex = 0;
    const toIndex = 2; // past B's midpoint

    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);

    expect(arr).toEqual(["B", "A", "C"]);
  });

  it("adjacent swap up", () => {
    const arr = ["A", "B", "C"];
    const fromIndex = 2;
    const toIndex = 1;

    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);

    expect(arr).toEqual(["A", "C", "B"]);
  });

  it("middle element to end", () => {
    const arr = ["A", "B", "C", "D"];
    const fromIndex = 1;
    const toIndex = 4;

    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);

    expect(arr).toEqual(["A", "C", "D", "B"]);
  });

  it("same position is no-op (caught by guard)", () => {
    const fromIndex = 1;
    const toIndex = 1;
    expect(toIndex).toBe(fromIndex);
  });
});

// ── Reparent output format ──

describe("reparent output format", () => {
  it("encodes as oldParent → newParent@index", () => {
    const from = ".sidebar";
    const to = ".main-content@2";

    const [selector, index] = to.split("@");
    expect(selector).toBe(".main-content");
    expect(parseInt(index, 10)).toBe(2);
  });

  it("handles selectors with special characters using lastIndexOf", () => {
    const to = "div.container > ul.nav-list@0";

    const atIdx = to.lastIndexOf("@");
    expect(to.slice(0, atIdx)).toBe("div.container > ul.nav-list");
    expect(parseInt(to.slice(atIdx + 1), 10)).toBe(0);
  });

  it("handles index 0 (first child)", () => {
    const to = ".parent@0";
    const [selector, index] = to.split("@");
    expect(selector).toBe(".parent");
    expect(parseInt(index, 10)).toBe(0);
  });
});

// ── Reparent validation ──

describe("reparent validation", () => {
  it("isAncestor detects parent-child relationship", () => {
    // Inline implementation matching ElementTree.tsx
    function isAncestor(ancestor: any, descendant: any): boolean {
      let current = descendant.parentElement;
      while (current) {
        if (current === ancestor) return true;
        current = current.parentElement;
      }
      return false;
    }

    const grandparent = { parentElement: null };
    const parent = { parentElement: grandparent };
    const child = { parentElement: parent };

    expect(isAncestor(grandparent, child)).toBe(true);
    expect(isAncestor(parent, child)).toBe(true);
    expect(isAncestor(child, grandparent)).toBe(false);
    expect(isAncestor(child, child)).toBe(false); // self is not ancestor
  });

  it("siblings are not ancestors of each other", () => {
    function isAncestor(ancestor: any, descendant: any): boolean {
      let current = descendant.parentElement;
      while (current) {
        if (current === ancestor) return true;
        current = current.parentElement;
      }
      return false;
    }

    const parent = { parentElement: null };
    const a = { parentElement: parent };
    const b = { parentElement: parent };

    expect(isAncestor(a, b)).toBe(false);
    expect(isAncestor(b, a)).toBe(false);
  });
});
