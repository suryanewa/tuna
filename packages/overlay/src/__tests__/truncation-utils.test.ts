import { describe, it, expect } from "vitest";
import { detectTruncation, computeTruncationChanges } from "../ui/truncation-utils";

describe("detectTruncation", () => {
  it("detects no truncation", () => {
    const result = detectTruncation({
      textOverflow: "clip",
      whiteSpace: "normal",
      webkitLineClamp: "none",
    });
    expect(result.enabled).toBe(false);
    expect(result.lines).toBe(1);
  });

  it("detects single-line ellipsis", () => {
    const result = detectTruncation({
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      webkitLineClamp: "none",
    });
    expect(result.enabled).toBe(true);
    expect(result.lines).toBe(1);
  });

  it("detects multi-line clamp", () => {
    const result = detectTruncation({
      webkitLineClamp: "3",
      textOverflow: "ellipsis",
      whiteSpace: "normal",
    });
    expect(result.enabled).toBe(true);
    expect(result.lines).toBe(3);
  });

  it("defaults to 2 lines for invalid clamp value", () => {
    const result = detectTruncation({
      webkitLineClamp: "abc",
    });
    expect(result.enabled).toBe(true);
    expect(result.lines).toBe(2);
  });

  it("treats unset webkitLineClamp as no clamp", () => {
    const result = detectTruncation({
      webkitLineClamp: "unset",
      textOverflow: "clip",
      whiteSpace: "normal",
    });
    expect(result.enabled).toBe(false);
  });
});

describe("computeTruncationChanges", () => {
  it("disabling clears all truncation properties", () => {
    const changes = computeTruncationChanges(
      { enabled: false, lines: 1 },
      { currentDisplay: "block" },
    );
    expect(changes.textOverflow).toBe("clip");
    expect(changes.overflow).toBe("visible");
    expect(changes.whiteSpace).toBe("normal");
    expect(changes.webkitLineClamp).toBe("unset");
    expect(changes.webkitBoxOrient).toBe("unset");
  });

  it("disabling resets display from -webkit-box to block", () => {
    const changes = computeTruncationChanges(
      { enabled: false, lines: 1 },
      { currentDisplay: "-webkit-box" },
    );
    expect(changes.display).toBe("block");
  });

  it("disabling does not change display if not -webkit-box", () => {
    const changes = computeTruncationChanges(
      { enabled: false, lines: 1 },
      { currentDisplay: "flex" },
    );
    expect(changes.display).toBeUndefined();
  });

  it("enabling single-line sets webkit-line-clamp to 1", () => {
    const changes = computeTruncationChanges(
      { enabled: true, lines: 1 },
      { currentDisplay: "block" },
    );
    expect(changes.display).toBe("-webkit-box");
    expect(changes.webkitBoxOrient).toBe("vertical");
    expect(changes.webkitLineClamp).toBe("1");
    expect(changes.overflow).toBe("hidden");
    expect(changes.textOverflow).toBe("ellipsis");
  });

  it("enabling multi-line sets correct line count", () => {
    const changes = computeTruncationChanges(
      { enabled: true, lines: 3 },
      { currentDisplay: "block" },
    );
    expect(changes.webkitLineClamp).toBe("3");
    expect(changes.display).toBe("-webkit-box");
  });
});
