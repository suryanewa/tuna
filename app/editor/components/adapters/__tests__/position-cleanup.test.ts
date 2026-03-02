import { describe, it, expect } from "vitest";
import {
  writePositionType,
  writeConstraint,
  readConstraint,
} from "../tailwind-adapters";
import type { TailwindStyles } from "@/lib/playground/editor-types";

/**
 * Bug: After moving an absolute element (which sets left/top constraints),
 * switching position back to static/relative leaves stale left/top classes.
 *
 * These orphaned classes (e.g., left-[300px], top-[150px]) still get converted
 * to inline styles by extractArbitraryStyles, causing the element to visually
 * retain its absolute-positioned offset even in static/relative layout.
 *
 * Expected: writePositionType("static") should clear left/top/right/bottom
 * constraints since they only apply to positioned elements.
 */

describe("position type change should clean up constraints", () => {
  it("switching from absolute to static clears left/top", () => {
    // Simulate: element was absolute and moved to left:300, top:150
    const styles: TailwindStyles = {
      position: "absolute",
      left: "left-[300px]",
      top: "top-[150px]",
    };

    // User switches position to static
    const patch = writePositionType("static");
    const updated = { ...styles, ...patch };

    // FIXED: left and top are now cleared when switching to static
    expect(readConstraint(updated, "left")).toBeUndefined();
    expect(readConstraint(updated, "top")).toBeUndefined();
  });

  it("switching from absolute to static should clear all constraints", () => {
    const styles: TailwindStyles = {
      position: "absolute",
      left: "left-[300px]",
      top: "top-[150px]",
      right: "right-[50px]",
      bottom: "bottom-[20px]",
    };

    const patch = writePositionType("static");
    const updated = { ...styles, ...patch };

    // After fix: all constraints should be cleared
    expect(readConstraint(updated, "left")).toBeUndefined();
    expect(readConstraint(updated, "top")).toBeUndefined();
    expect(readConstraint(updated, "right")).toBeUndefined();
    expect(readConstraint(updated, "bottom")).toBeUndefined();
  });

  it("switching from absolute to relative should also clear constraints", () => {
    const styles: TailwindStyles = {
      position: "absolute",
      left: "left-[200px]",
      top: "top-[100px]",
    };

    const patch = writePositionType("relative");
    const updated = { ...styles, ...patch };

    // relative + left/top would cause unexpected offset, should be cleared
    expect(readConstraint(updated, "left")).toBeUndefined();
    expect(readConstraint(updated, "top")).toBeUndefined();
  });

  it("switching from absolute to fixed should preserve constraints", () => {
    const styles: TailwindStyles = {
      position: "absolute",
      left: "left-[300px]",
      top: "top-[150px]",
    };

    // fixed also uses left/top — should keep them
    const patch = writePositionType("fixed");
    const updated = { ...styles, ...patch };

    expect(readConstraint(updated, "left")).toBe(300);
    expect(readConstraint(updated, "top")).toBe(150);
  });

  it("switching between absolute and sticky should clear constraints", () => {
    const styles: TailwindStyles = {
      position: "absolute",
      left: "left-[300px]",
      top: "top-[150px]",
    };

    const patch = writePositionType("sticky");
    const updated = { ...styles, ...patch };

    // sticky uses top for scroll threshold but left isn't typical — clear left
    expect(readConstraint(updated, "left")).toBeUndefined();
    // sticky requires at least one inset property — top-0 is set as default
    expect(readConstraint(updated, "top")).toBe(0);
  });
});
