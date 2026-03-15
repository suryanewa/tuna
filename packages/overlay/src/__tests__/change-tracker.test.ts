import { describe, it, expect, beforeEach } from "vitest";
import { ChangeTracker } from "../engine/change-tracker";

describe("ChangeTracker", () => {
  let tracker: ChangeTracker;
  const sel = ".btn";

  function trackElement(styles: Record<string, string> = { padding: "8px", color: "red" }) {
    tracker.track(sel, "BUTTON", "Click me", ["btn"], [], styles);
  }

  beforeEach(() => {
    tracker = new ChangeTracker();
  });

  // ─── Token association & unlinking ─────────────────────────────────

  describe("token association", () => {
    it("setTokenAssociation stores and getTokenAssociation retrieves", () => {
      trackElement();
      const tokenRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setTokenAssociation(sel, ["padding"], tokenRef);
      expect(tracker.getTokenAssociation(sel, "padding")).toBe(tokenRef);
    });

    it("clearTokenAssociation removes the association", () => {
      trackElement();
      const tokenRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setTokenAssociation(sel, ["padding"], tokenRef);
      tracker.clearTokenAssociation(sel, ["padding"]);
      expect(tracker.getTokenAssociation(sel, "padding")).toBeUndefined();
    });

    it("getTokenAssociations returns all associations", () => {
      trackElement();
      const t1 = { className: "var(--spacing-3)", values: { padding: "12px" } };
      const t2 = { className: "var(--color-brand)", values: { color: "blue" } };
      tracker.setTokenAssociation(sel, ["padding"], t1);
      tracker.setTokenAssociation(sel, ["color"], t2);
      const all = tracker.getTokenAssociations(sel);
      expect(all).toEqual({ padding: t1, color: t2 });
    });
  });

  describe("unlinkToken", () => {
    it("marks properties as unlinked", () => {
      trackElement();
      tracker.unlinkToken(sel, ["padding"]);
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(true);
      expect(tracker.isTokenUnlinked(sel, "color")).toBe(false);
    });

    it("clears value-only associations when unlinking", () => {
      trackElement();
      const tokenRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setTokenAssociation(sel, ["padding"], tokenRef);
      tracker.unlinkToken(sel, ["padding"]);
      expect(tracker.getTokenAssociation(sel, "padding")).toBeUndefined();
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(true);
    });

    it("getUnlinkedTokens returns all unlinked properties", () => {
      trackElement();
      tracker.unlinkToken(sel, ["padding", "color"]);
      const unlinked = tracker.getUnlinkedTokens(sel);
      expect(unlinked.has("padding")).toBe(true);
      expect(unlinked.has("color")).toBe(true);
    });

    it("relinkToken clears the unlinked state", () => {
      trackElement();
      tracker.unlinkToken(sel, ["padding"]);
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(true);
      tracker.relinkToken(sel, ["padding"]);
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(false);
    });
  });

  // ─── recordUnlink (undoable unlink) ──────────────────────────────

  describe("recordUnlink", () => {
    it("marks properties as unlinked", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(true);
    });

    it("clears value-only associations when unlinking", () => {
      trackElement();
      const tokenRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setTokenAssociation(sel, ["padding"], tokenRef);
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.getTokenAssociation(sel, "padding")).toBeUndefined();
    });

    it("pushes to undo stack (canUndo becomes true)", () => {
      trackElement();
      expect(tracker.canUndo).toBe(false);
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.canUndo).toBe(true);
    });

    it("undo restores the unlinked property (relinks)", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(true);
      tracker.popUndo();
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(false);
    });

    it("undo restores saved token association", () => {
      trackElement();
      const tokenRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setTokenAssociation(sel, ["padding"], tokenRef);
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.getTokenAssociation(sel, "padding")).toBeUndefined();
      tracker.popUndo();
      expect(tracker.getTokenAssociation(sel, "padding")).toEqual(tokenRef);
    });

    it("redo re-unlinks after undo", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding"]);
      tracker.popUndo();
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(false);
      tracker.popRedo();
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(true);
    });

    it("clears redo stack on new action", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding"]);
      tracker.popUndo();
      expect(tracker.canRedo).toBe(true);
      tracker.recordChange(sel, "color", "blue");
      expect(tracker.canRedo).toBe(false);
    });

    it("unlinks multiple properties in one group", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding", "color"]);
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(true);
      expect(tracker.isTokenUnlinked(sel, "color")).toBe(true);
      // Undo should relink both at once
      tracker.popUndo();
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(false);
      expect(tracker.isTokenUnlinked(sel, "color")).toBe(false);
    });
  });

  // ─── Change detection includes unlinked properties ─────────────

  describe("unlinked properties as changes", () => {
    it("isPropertyChanged returns true for unlinked property", () => {
      trackElement();
      tracker.unlinkToken(sel, ["padding"]);
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(true);
    });

    it("getChangedProperties includes unlinked properties", () => {
      trackElement();
      tracker.unlinkToken(sel, ["padding"]);
      const changed = tracker.getChangedProperties(sel);
      expect(changed.has("padding")).toBe(true);
    });

    it("resetProperty clears unlinked-only state (value unchanged)", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(true);
      const result = tracker.resetProperty(sel, "padding");
      expect(result).not.toBeNull();
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(false);
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(false);
    });
  });

  // ─── Per-property change tracking ─────────────────────────────────

  describe("isPropertyChanged", () => {
    it("returns false when property unchanged", () => {
      trackElement();
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(false);
    });

    it("returns true after recordChange modifies the property", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(true);
    });

    it("returns false for untracked selector", () => {
      expect(tracker.isPropertyChanged(".unknown", "padding")).toBe(false);
    });
  });

  describe("getChangedProperties", () => {
    it("returns empty set when nothing changed", () => {
      trackElement();
      expect(tracker.getChangedProperties(sel).size).toBe(0);
    });

    it("returns changed properties only", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      const changed = tracker.getChangedProperties(sel);
      expect(changed.has("padding")).toBe(true);
      expect(changed.has("color")).toBe(false);
    });

    it("returns multiple changed properties", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      tracker.recordChange(sel, "color", "blue");
      const changed = tracker.getChangedProperties(sel);
      expect(changed.size).toBe(2);
      expect(changed.has("padding")).toBe(true);
      expect(changed.has("color")).toBe(true);
    });
  });

  // ─── resetProperty ────────────────────────────────────────────────

  describe("resetProperty", () => {
    it("resets property to original value", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      const result = tracker.resetProperty(sel, "padding");
      expect(result).toEqual({ from: "16px", to: "8px" });
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(false);
    });

    it("returns null when property is not changed", () => {
      trackElement();
      expect(tracker.resetProperty(sel, "padding")).toBeNull();
    });

    it("returns null for untracked selector", () => {
      expect(tracker.resetProperty(".unknown", "padding")).toBeNull();
    });

    it("clears token association on reset", () => {
      trackElement();
      const tokenRef = { className: "var(--spacing-4)", values: { padding: "16px" } };
      tracker.recordChange(sel, "padding", "16px");
      tracker.setTokenAssociation(sel, ["padding"], tokenRef);
      tracker.resetProperty(sel, "padding");
      expect(tracker.getTokenAssociation(sel, "padding")).toBeUndefined();
    });

    it("clears unlinked state on reset", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      tracker.unlinkToken(sel, ["padding"]);
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(true);
      tracker.resetProperty(sel, "padding");
      expect(tracker.isTokenUnlinked(sel, "padding")).toBe(false);
    });

    it("supports undo after reset (restores the changed value)", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      tracker.resetProperty(sel, "padding");
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(false);

      // Undo the reset — should restore the changed value
      const undone = tracker.popUndo();
      expect(undone).not.toBeNull();
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(true);
    });

    it("supports redo after undo of reset", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      tracker.resetProperty(sel, "padding");
      tracker.popUndo(); // undo the reset
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(true);

      // Redo the reset
      const redone = tracker.popRedo();
      expect(redone).not.toBeNull();
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(false);
    });

    it("clears redo stack (new action after undo)", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      // Force a new undo group so "color" doesn't coalesce with "padding"
      (tracker as any).lastChange = null;
      tracker.recordChange(sel, "color", "blue");
      tracker.popUndo(); // undo color change only (separate group)
      expect(tracker.canRedo).toBe(true);

      // Reset padding — should clear redo stack
      tracker.resetProperty(sel, "padding");
      expect(tracker.canRedo).toBe(false);
    });

    it("only resets the specified property, leaving others unchanged", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      tracker.recordChange(sel, "color", "blue");
      tracker.resetProperty(sel, "padding");
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(false);
      expect(tracker.isPropertyChanged(sel, "color")).toBe(true);
    });
  });
});
