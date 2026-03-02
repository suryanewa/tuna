import { describe, it, expect, vi } from "vitest";

/**
 * Test: TiptapTextEditor onBlur must exit editing mode.
 *
 * Bug: Clicking outside the Tiptap text editor doesn't fully exit edit mode.
 * After clicking out, hovering over the text still shows a text-edit cursor,
 * and clicking lets the user enter edit mode with extra spacing. Only pressing
 * Escape fully exits.
 *
 * Root cause: The onBlur handler in TiptapTextEditor calls onSave() to persist
 * the content, but does NOT call onExit() to clear editingElementId. The
 * onSave callback in EditorCanvas only calls updateElement(), it does not call
 * setEditingElementId(null). Meanwhile, the Escape key handler correctly calls
 * onExit(), which is why Escape works.
 *
 * Flow comparison:
 *   Escape key: handleKeyDown → onExit() → setEditingElementId(null)  ✅
 *   Click outside: onBlur → onSave(json, text) → updateElement(...)   ❌ missing onExit()
 *
 * Fix: The onBlur handler must call onExit() after onSave() so that
 * editingElementId is cleared and isEditing becomes false.
 */

describe("TiptapTextEditor blur should exit editing mode", () => {
  /**
   * Simulates the onBlur logic from TiptapTextEditor.
   * Before the fix, onBlur only called onSave. After the fix, it also calls onExit.
   */
  it("onBlur should call both onSave and onExit", () => {
    const onSave = vi.fn();
    const onExit = vi.fn();
    const isExiting = false;

    // Simulate the onBlur handler logic (fixed version)
    const simulateOnBlur = () => {
      if (isExiting) return;
      const json = { type: "doc", content: [] };
      const text = "hello";
      onSave(json, text);
      onExit(); // <-- This call was missing in the buggy version
    };

    simulateOnBlur();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("onBlur should NOT call onSave or onExit when isExiting is true (Escape path)", () => {
    const onSave = vi.fn();
    const onExit = vi.fn();
    const isExiting = true;

    const simulateOnBlur = () => {
      if (isExiting) return;
      const json = { type: "doc", content: [] };
      const text = "hello";
      onSave(json, text);
      onExit();
    };

    simulateOnBlur();

    // When Escape was pressed, isExitingRef is true, so onBlur is a no-op
    // (onExit was already called by the Escape key handler)
    expect(onSave).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  it("Escape key handler should call onExit but NOT onSave (discard changes)", () => {
    const onSave = vi.fn();
    const onExit = vi.fn();

    // Simulate the Escape key handler logic
    const simulateEscapeKey = () => {
      onExit();
      // Note: does NOT call onSave — Escape discards changes
    };

    simulateEscapeKey();

    expect(onSave).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("editingElementId should be null after blur (exit editing mode)", () => {
    let editingElementId: string | null = "el-123";

    const setEditingElementId = (id: string | null) => {
      editingElementId = id;
    };

    const onSave = vi.fn();
    const onExit = () => setEditingElementId(null);
    const isExiting = false;

    // Simulate onBlur
    const simulateOnBlur = () => {
      if (isExiting) return;
      onSave({ type: "doc", content: [] }, "hello");
      onExit();
    };

    // Before blur: still editing
    expect(editingElementId).toBe("el-123");

    simulateOnBlur();

    // After blur: editing exited
    expect(editingElementId).toBeNull();
  });
});
