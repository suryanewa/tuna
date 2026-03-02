import { describe, it, expect } from "vitest";
import {
  writePositionType,
  readConstraint,
  readStickyEdge,
  readStickyValue,
  readPositionType,
} from "../tailwind-adapters";
import type { TailwindStyles } from "@/lib/playground/editor-types";

/**
 * Bug: Setting position to "sticky" produces `position: sticky` with no
 * constraint (top/right/bottom/left), so the element never actually sticks.
 *
 * CSS requires `position: sticky` + at least one inset property (e.g. `top: 0`)
 * to function. The UI shows "Top: 0" as defaults but those defaults are never
 * written to the styles — they only exist as fallback return values in
 * readStickyEdge/readStickyValue.
 *
 * Expected: writePositionType("sticky") should set a default constraint
 * (top-0) so the element sticks immediately.
 */

describe("sticky positioning must include a default constraint", () => {
  it("switching from static to sticky should set top-0 by default", () => {
    const styles: TailwindStyles = {};

    const patch = writePositionType("sticky");
    const updated = { ...styles, ...patch };

    expect(readPositionType(updated)).toBe("sticky");
    // Sticky MUST have a constraint to work — top-0 is the default
    expect(readConstraint(updated, "top")).toBe(0);
  });

  it("switching from absolute to sticky should set top-0", () => {
    const styles: TailwindStyles = {
      position: "absolute",
      left: "left-[300px]",
      top: "top-[150px]",
    };

    const patch = writePositionType("sticky");
    const updated = { ...styles, ...patch };

    // Old absolute constraints should be cleared
    expect(readConstraint(updated, "left")).toBeUndefined();
    // But top-0 must be set for sticky to function
    expect(readConstraint(updated, "top")).toBe(0);
  });

  it("switching from relative to sticky should set top-0", () => {
    const styles: TailwindStyles = {
      position: "relative",
    };

    const patch = writePositionType("sticky");
    const updated = { ...styles, ...patch };

    expect(readPositionType(updated)).toBe("sticky");
    expect(readConstraint(updated, "top")).toBe(0);
  });

  it("readStickyEdge and readStickyValue reflect the default after switching to sticky", () => {
    const styles: TailwindStyles = {};
    const patch = writePositionType("sticky");
    const updated = { ...styles, ...patch };

    expect(readStickyEdge(updated)).toBe("top");
    expect(readStickyValue(updated)).toBe(0);
  });

  it("switching from sticky to static should clear the constraint", () => {
    const styles: TailwindStyles = {
      position: "sticky",
      top: "top-0",
    };

    const patch = writePositionType("static");
    const updated = { ...styles, ...patch };

    expect(readPositionType(updated)).toBe("static");
    expect(readConstraint(updated, "top")).toBeUndefined();
  });

  it("switching from sticky to relative should clear the constraint", () => {
    const styles: TailwindStyles = {
      position: "sticky",
      top: "top-4",
    };

    const patch = writePositionType("relative");
    const updated = { ...styles, ...patch };

    expect(readPositionType(updated)).toBe("relative");
    expect(readConstraint(updated, "top")).toBeUndefined();
  });
});
