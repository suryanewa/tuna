import { describe, expect, it } from "vitest";
import { getTranscriptDelta } from "../overlay/use-comment-dictation";

describe("getTranscriptDelta", () => {
  it("returns only newly finalized transcript text", () => {
    expect(getTranscriptDelta(0, "hello world")).toBe("hello world");
    expect(getTranscriptDelta(5, "hello world")).toBe(" world");
    expect(getTranscriptDelta(11, "hello world")).toBe("");
  });
});
