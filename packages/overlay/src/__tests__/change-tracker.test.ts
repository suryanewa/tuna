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
    it("setVariableAssociation stores and getVariableAssociation retrieves", () => {
      trackElement();
      const varRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setVariableAssociation(sel, ["padding"], varRef);
      expect(tracker.getVariableAssociation(sel, "padding")).toBe(varRef);
    });

    it("clearVariableAssociation removes the association", () => {
      trackElement();
      const varRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setVariableAssociation(sel, ["padding"], varRef);
      tracker.clearVariableAssociation(sel, ["padding"]);
      expect(tracker.getVariableAssociation(sel, "padding")).toBeUndefined();
    });

    it("getVariableAssociations returns all associations", () => {
      trackElement();
      const t1 = { className: "var(--spacing-3)", values: { padding: "12px" } };
      const t2 = { className: "var(--color-brand)", values: { color: "blue" } };
      tracker.setVariableAssociation(sel, ["padding"], t1);
      tracker.setVariableAssociation(sel, ["color"], t2);
      const all = tracker.getVariableAssociations(sel);
      expect(all).toEqual({ padding: t1, color: t2 });
    });
  });

  describe("unlinkVariable", () => {
    it("marks properties as unlinked", () => {
      trackElement();
      tracker.unlinkVariable(sel, ["padding"]);
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
      expect(tracker.isVariableUnlinked(sel, "color")).toBe(false);
    });

    it("clears value-only associations when unlinking", () => {
      trackElement();
      const varRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setVariableAssociation(sel, ["padding"], varRef);
      tracker.unlinkVariable(sel, ["padding"]);
      expect(tracker.getVariableAssociation(sel, "padding")).toBeUndefined();
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
    });

    it("getUnlinkedVariables returns all unlinked properties", () => {
      trackElement();
      tracker.unlinkVariable(sel, ["padding", "color"]);
      const unlinked = tracker.getUnlinkedVariables(sel);
      expect(unlinked.has("padding")).toBe(true);
      expect(unlinked.has("color")).toBe(true);
    });

    it("relinkVariable clears the unlinked state", () => {
      trackElement();
      tracker.unlinkVariable(sel, ["padding"]);
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
      tracker.relinkVariable(sel, ["padding"]);
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(false);
    });
  });

  // ─── recordUnlink (undoable unlink) ──────────────────────────────

  describe("recordUnlink", () => {
    it("marks properties as unlinked", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
    });

    it("clears value-only associations when unlinking", () => {
      trackElement();
      const varRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setVariableAssociation(sel, ["padding"], varRef);
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.getVariableAssociation(sel, "padding")).toBeUndefined();
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
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
      tracker.popUndo();
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(false);
    });

    it("undo restores saved token association", () => {
      trackElement();
      const varRef = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setVariableAssociation(sel, ["padding"], varRef);
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.getVariableAssociation(sel, "padding")).toBeUndefined();
      tracker.popUndo();
      expect(tracker.getVariableAssociation(sel, "padding")).toEqual(varRef);
    });

    it("redo re-unlinks after undo", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding"]);
      tracker.popUndo();
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(false);
      tracker.popRedo();
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
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
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
      expect(tracker.isVariableUnlinked(sel, "color")).toBe(true);
      // Undo should relink both at once
      tracker.popUndo();
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(false);
      expect(tracker.isVariableUnlinked(sel, "color")).toBe(false);
    });
  });

  // ─── Change detection includes unlinked properties ─────────────

  describe("unlinked properties as changes", () => {
    it("isPropertyChanged returns true for unlinked property", () => {
      trackElement();
      tracker.unlinkVariable(sel, ["padding"]);
      expect(tracker.isPropertyChanged(sel, "padding")).toBe(true);
    });

    it("getChangedProperties includes unlinked properties", () => {
      trackElement();
      tracker.unlinkVariable(sel, ["padding"]);
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
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(false);
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
      const varRef = { className: "var(--spacing-4)", values: { padding: "16px" } };
      tracker.recordChange(sel, "padding", "16px");
      tracker.setVariableAssociation(sel, ["padding"], varRef);
      tracker.resetProperty(sel, "padding");
      expect(tracker.getVariableAssociation(sel, "padding")).toBeUndefined();
    });

    it("clears unlinked state on reset", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      tracker.unlinkVariable(sel, ["padding"]);
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
      tracker.resetProperty(sel, "padding");
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(false);
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

  // ─── ensureOriginalValue ─────────────────────────────────────────

  describe("ensureOriginalValue", () => {
    it("sets original and current value when property is missing", () => {
      trackElement(); // tracks with { padding: "8px", color: "red" }
      tracker.ensureOriginalValue(sel, "__reorder", "5");
      // Now recordChange should see "5" as the old value
      const result = tracker.recordChange(sel, "__reorder", "2");
      expect(result).toEqual({ from: "5", to: "2" });
    });

    it("does not overwrite existing original value", () => {
      trackElement();
      tracker.ensureOriginalValue(sel, "__reorder", "5");
      tracker.recordChange(sel, "__reorder", "3");
      // Try to set again — should be no-op
      tracker.ensureOriginalValue(sel, "__reorder", "99");
      // The pending change should still show from: "5", not "99"
      const changes = tracker.getPendingChanges();
      const reorder = changes[0]?.changes.find(c => c.property === "__reorder");
      expect(reorder?.from).toBe("5");
    });

    it("does nothing for untracked selector", () => {
      tracker.ensureOriginalValue(".unknown", "__reorder", "5");
      expect(tracker.getPendingChanges()).toEqual([]);
    });
  });

  // ─── breakCoalescing ────────────────────────────────────────────

  describe("breakCoalescing", () => {
    it("prevents coalescing of rapid changes into one undo group", () => {
      trackElement();
      tracker.recordChange(sel, "__reorder", "4");
      tracker.breakCoalescing();
      tracker.recordChange(sel, "__reorder", "3");

      // First undo should revert to "4", not "8px" (the original)
      const entries1 = tracker.popUndo();
      expect(entries1).not.toBeNull();
      expect(entries1![0].value).toBe("4");

      // Second undo should revert to original
      const entries2 = tracker.popUndo();
      expect(entries2).not.toBeNull();
    });

    it("without breakCoalescing, rapid changes coalesce", () => {
      trackElement();
      tracker.recordChange(sel, "__reorder", "4");
      // No breakCoalescing — same selector within coalesce window
      tracker.recordChange(sel, "__reorder", "3");

      // Only one undo group (coalesced)
      const entries = tracker.popUndo();
      expect(entries).not.toBeNull();
      // Should be empty after one pop
      expect(tracker.canUndo).toBe(false);
    });
  });

  // ─── Structural properties (__reorder, __delete, __text) ────────

  describe("structural properties", () => {
    it("__reorder change appears in getPendingChanges", () => {
      trackElement();
      tracker.ensureOriginalValue(sel, "__reorder", "5");
      tracker.recordChange(sel, "__reorder", "1");
      const changes = tracker.getPendingChanges();
      expect(changes.length).toBe(1);
      const reorder = changes[0].changes.find(c => c.property === "__reorder");
      expect(reorder).toEqual({ property: "__reorder", from: "5", to: "1" });
    });

    it("__delete change appears in getPendingChanges", () => {
      trackElement();
      tracker.recordChange(sel, "__delete", "true");
      const changes = tracker.getPendingChanges();
      expect(changes[0].changes.find(c => c.property === "__delete")).toBeDefined();
    });

    it("__text change appears in getPendingChanges", () => {
      trackElement();
      tracker.ensureOriginalValue(sel, "__text", "Hello");
      tracker.recordChange(sel, "__text", "Goodbye");
      const changes = tracker.getPendingChanges();
      const textChange = changes[0].changes.find(c => c.property === "__text");
      expect(textChange).toEqual({ property: "__text", from: "Hello", to: "Goodbye" });
    });

    it("undo reverts __reorder to original position", () => {
      trackElement();
      tracker.ensureOriginalValue(sel, "__reorder", "5");
      tracker.recordChange(sel, "__reorder", "1");
      tracker.popUndo();
      // After undo, no pending reorder change
      const changes = tracker.getPendingChanges();
      const reorder = changes[0]?.changes.find(c => c.property === "__reorder");
      expect(reorder).toBeUndefined();
    });

    it("multiple reorders on same selector consolidate into one change", () => {
      trackElement();
      tracker.ensureOriginalValue(sel, "__reorder", "5");
      tracker.breakCoalescing();
      tracker.recordChange(sel, "__reorder", "4");
      tracker.breakCoalescing();
      tracker.recordChange(sel, "__reorder", "3");
      tracker.breakCoalescing();
      tracker.recordChange(sel, "__reorder", "2");

      // Only one pending change entry for this selector
      const changes = tracker.getPendingChanges();
      expect(changes.length).toBe(1);
      const reorder = changes[0].changes.find(c => c.property === "__reorder");
      expect(reorder).toEqual({ property: "__reorder", from: "5", to: "2" });
    });
  });

  // ─── Undo/redo token association restoration ───────────────────

  describe("undo restores token associations for value changes", () => {
    it("undo restores previous token association after value change", () => {
      trackElement();
      const tokenA = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setVariableAssociation(sel, ["padding"], tokenA);
      // Force new undo group
      (tracker as any).lastChange = null;
      // Change value (simulating a token swap to tokenB)
      tracker.recordChange(sel, "padding", "16px");
      const tokenB = { className: "var(--spacing-4)", values: { padding: "16px" } };
      tracker.setVariableAssociation(sel, ["padding"], tokenB);
      expect(tracker.getVariableAssociation(sel, "padding")).toEqual(tokenB);

      // Undo the value change — should restore tokenA
      tracker.popUndo();
      expect(tracker.getVariableAssociation(sel, "padding")).toEqual(tokenA);
    });

    it("undo clears association when none existed before the change", () => {
      trackElement();
      // No association initially
      tracker.recordChange(sel, "padding", "16px");
      const tokenA = { className: "var(--spacing-4)", values: { padding: "16px" } };
      tracker.setVariableAssociation(sel, ["padding"], tokenA);

      tracker.popUndo();
      expect(tracker.getVariableAssociation(sel, "padding")).toBeUndefined();
    });

    it("redo restores token association after undo", () => {
      trackElement();
      const tokenA = { className: "var(--spacing-3)", values: { padding: "12px" } };
      tracker.setVariableAssociation(sel, ["padding"], tokenA);
      (tracker as any).lastChange = null;
      tracker.recordChange(sel, "padding", "16px");
      const tokenB = { className: "var(--spacing-4)", values: { padding: "16px" } };
      tracker.setVariableAssociation(sel, ["padding"], tokenB);

      tracker.popUndo(); // restores tokenA
      expect(tracker.getVariableAssociation(sel, "padding")).toEqual(tokenA);

      tracker.popRedo(); // restores tokenB
      expect(tracker.getVariableAssociation(sel, "padding")).toEqual(tokenB);
    });

    it("undo restores unlinked state when change was made after unlink", () => {
      trackElement();
      tracker.recordUnlink(sel, ["padding"]);
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);

      // Force new undo group
      (tracker as any).lastChange = null;
      // Real flow: recordChange runs first (snapshots prevUnlinked=true),
      // then relinkVariable clears the unlinked state
      tracker.recordChange(sel, "padding", "16px");
      tracker.relinkVariable(sel, ["padding"]);
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(false);

      // Undo the value change — should restore the unlinked state
      tracker.popUndo();
      expect(tracker.isVariableUnlinked(sel, "padding")).toBe(true);
    });
  });

  // ─── variableAssociations in getPendingChanges output ──────────

  describe("variableAssociations in output", () => {
    it("includes variableAssociations in getPendingChanges when set", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");
      const varRef = { className: "var(--spacing-4)", values: { padding: "16px" } };
      tracker.setVariableAssociation(sel, ["padding"], varRef);

      const changes = tracker.getPendingChanges();
      expect(changes.length).toBe(1);
      expect(changes[0].variableAssociations).toBeDefined();
      expect(changes[0].variableAssociations!["padding"]).toEqual(varRef);
    });

    it("omits variableAssociations when none are set", () => {
      trackElement();
      tracker.recordChange(sel, "padding", "16px");

      const changes = tracker.getPendingChanges();
      expect(changes.length).toBe(1);
      expect(changes[0].variableAssociations).toBeUndefined();
    });
  });

  describe("migrateChanges", () => {
    it("moves base, breakpoint, token, and unlink state to the new selector", () => {
      const from = ".btn";
      const to = ".btn.primary";
      tracker.track(from, "BUTTON", "Save", ["btn"], [], { padding: "8px", color: "red" });
      tracker.track(to, "BUTTON", "Save", ["btn", "primary"], [], { padding: "8px", color: "red" });
      tracker.trackBreakpoint(from, "768px", { padding: "8px", color: "red" });

      const varRef = { className: "var(--spacing-4)", values: { padding: "16px" } };
      tracker.recordChange(from, "padding", "16px");
      tracker.recordChange(from, "color", "blue", "768px");
      tracker.setVariableAssociation(from, ["padding"], varRef);
      tracker.recordUnlink(from, ["color"]);

      tracker.migrateChanges(from, to);

      const changes = tracker.getPendingChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].selector).toBe(to);
      expect(changes[0].changes).toEqual(expect.arrayContaining([
        { property: "padding", from: "8px", to: "16px" },
        { property: "color", from: "red", to: "blue", breakpoint: "768px" },
      ]));
      expect(changes[0].variableAssociations?.padding).toEqual(varRef);
      expect(changes[0].unlinkedProperties).toEqual([{ property: "color", value: "red" }]);
    });

    it("moves prop and attribute changes to the new selector", () => {
      const from = ".card";
      const to = ".card.featured";
      tracker.track(from, "ARTICLE", "Card", ["card"], [], {}, null, undefined, null, null, null, null, null, "", null, undefined, { variant: "plain" });
      tracker.track(to, "ARTICLE", "Card", ["card", "featured"], [], {}, null, undefined, null, null, null, null, null, "", null, undefined, { variant: "plain" });

      tracker.recordPropChange(from, "variant", "featured");
      tracker.recordAttributeChange(from, "aria-label", "Plain card", "Featured card");

      tracker.migrateChanges(from, to);

      const changes = tracker.getPendingChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].selector).toBe(to);
      expect(changes[0].propChanges).toEqual([{ prop: "variant", from: "plain", to: "featured" }]);
      expect(changes[0].attributeChanges).toEqual([{ attr: "aria-label", from: "Plain card", to: "Featured card" }]);
    });
  });
});
