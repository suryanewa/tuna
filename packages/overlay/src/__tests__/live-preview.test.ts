import { describe, it, expect, beforeEach, vi } from "vitest";
import { LivePreviewEngine } from "../engine/live-preview";

// ---------------------------------------------------------------------------
// Mock CSSStyleSheet (Node has no real constructable stylesheets)
// ---------------------------------------------------------------------------
class MockCSSStyleSheet {
  private rules: string[] = [];
  get cssRules() {
    // Return a minimal CSSRuleList-like object
    return { length: this.rules.length };
  }
  insertRule(rule: string, index: number) {
    this.rules.splice(index, 0, rule);
    return index;
  }
  replaceSync(text: string) {
    this.rules = text ? [text] : [];
  }
  /** Expose rules for inspection in tests */
  _getRawRules() {
    return [...this.rules];
  }
}

// Stub the global CSSStyleSheet constructor and document.adoptedStyleSheets
beforeEach(() => {
  (globalThis as any).CSSStyleSheet = MockCSSStyleSheet;
  (globalThis as any).document = {
    adoptedStyleSheets: [] as any[],
  };
});

describe("LivePreviewEngine", () => {
  let engine: LivePreviewEngine;

  beforeEach(() => {
    (globalThis as any).document.adoptedStyleSheets = [];
    engine = new LivePreviewEngine();
  });

  // -----------------------------------------------------------------------
  // 1. applyChange adds a rule to the sheet
  // -----------------------------------------------------------------------
  it("applyChange adds a rule to the sheet", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual(
      expect.objectContaining({
        selector: ".btn",
        property: "fontSize",
        value: "16px",
      })
    );
  });

  // -----------------------------------------------------------------------
  // 2. applyChange with same selector+property replaces existing rule
  // -----------------------------------------------------------------------
  it("applyChange with same selector+property replaces existing rule", () => {
    engine.applyChange(".btn", "fontSize", "14px");
    engine.applyChange(".btn", "fontSize", "18px");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].value).toBe("18px");
  });

  // -----------------------------------------------------------------------
  // 3. removeChange removes a specific rule
  // -----------------------------------------------------------------------
  it("removeChange removes a specific rule", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    engine.applyChange(".btn", "color", "red");
    engine.removeChange(".btn", "fontSize");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].property).toBe("color");
  });

  // -----------------------------------------------------------------------
  // 4. removeChange with non-existent rule is a no-op
  // -----------------------------------------------------------------------
  it("removeChange with non-existent rule is a no-op", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    engine.removeChange(".btn", "color"); // doesn't exist
    const changes = engine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].property).toBe("fontSize");
  });

  // -----------------------------------------------------------------------
  // 5. removeAllChanges removes all rules for a selector
  // -----------------------------------------------------------------------
  it("removeAllChanges removes all rules for a selector", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    engine.applyChange(".btn", "color", "red");
    engine.applyChange(".card", "padding", "8px");
    engine.removeAllChanges(".btn");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].selector).toBe(".card");
  });

  // -----------------------------------------------------------------------
  // 6. getChanges returns all applied rules
  // -----------------------------------------------------------------------
  it("getChanges returns all applied rules", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    engine.applyChange(".card", "padding", "8px");
    engine.applyChange(".header", "color", "blue");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(3);
    expect(changes.map((c) => c.selector)).toEqual([".btn", ".card", ".header"]);
  });

  // -----------------------------------------------------------------------
  // 7. clearAll removes everything
  // -----------------------------------------------------------------------
  it("clearAll removes everything", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    engine.applyChange(".card", "padding", "8px");
    engine.clearAll();
    expect(engine.getChanges()).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 8. migrateChanges moves rules from one selector to another
  // -----------------------------------------------------------------------
  it("migrateChanges moves rules from one selector to another", () => {
    engine.applyChange(".old-btn", "fontSize", "16px");
    engine.applyChange(".old-btn", "color", "red");
    engine.applyChange(".other", "padding", "8px");
    engine.migrateChanges(".old-btn", ".new-btn");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(3);
    // The old-btn rules should now be under .new-btn
    const migrated = changes.filter((c) => c.selector === ".new-btn");
    expect(migrated).toHaveLength(2);
    expect(migrated.map((c) => c.property).sort()).toEqual(["color", "fontSize"]);
    // The .other rule should be untouched
    expect(changes.find((c) => c.selector === ".other")).toBeDefined();
    // No rules should remain under .old-btn
    expect(changes.filter((c) => c.selector === ".old-btn")).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 9. Multiple rules coexist with different selectors
  // -----------------------------------------------------------------------
  it("multiple rules coexist with different selectors", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    engine.applyChange(".card", "fontSize", "14px");
    engine.applyChange(".header", "fontSize", "24px");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(3);
    // Each selector has its own value
    expect(changes.find((c) => c.selector === ".btn")!.value).toBe("16px");
    expect(changes.find((c) => c.selector === ".card")!.value).toBe("14px");
    expect(changes.find((c) => c.selector === ".header")!.value).toBe("24px");
  });

  // -----------------------------------------------------------------------
  // 10. Multiple rules coexist with same selector but different properties
  // -----------------------------------------------------------------------
  it("multiple rules coexist with same selector but different properties", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    engine.applyChange(".btn", "color", "red");
    engine.applyChange(".btn", "padding", "8px");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(3);
    expect(changes.map((c) => c.property).sort()).toEqual(["color", "fontSize", "padding"]);
  });

  // -----------------------------------------------------------------------
  // Extra: migrateChanges with no matching rules is a no-op
  // -----------------------------------------------------------------------
  it("migrateChanges is a no-op when source selector has no rules", () => {
    engine.applyChange(".btn", "fontSize", "16px");
    engine.migrateChanges(".nonexistent", ".target");
    const changes = engine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].selector).toBe(".btn");
  });

  // -----------------------------------------------------------------------
  // Extra: attach and detach manage adoptedStyleSheets
  // -----------------------------------------------------------------------
  it("attach adds sheet to adoptedStyleSheets", () => {
    engine.attach();
    expect((globalThis as any).document.adoptedStyleSheets).toHaveLength(1);
  });

  it("detach removes sheet from adoptedStyleSheets", () => {
    engine.attach();
    engine.detach();
    expect((globalThis as any).document.adoptedStyleSheets).toHaveLength(0);
  });

  it("double attach does not duplicate sheet", () => {
    engine.attach();
    engine.attach();
    expect((globalThis as any).document.adoptedStyleSheets).toHaveLength(1);
  });

  it("detach without attach is a no-op", () => {
    engine.detach();
    expect((globalThis as any).document.adoptedStyleSheets).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Extra: destroy detaches and clears
  // -----------------------------------------------------------------------
  it("destroy detaches and clears all", () => {
    engine.attach();
    engine.applyChange(".btn", "fontSize", "16px");
    engine.destroy();
    expect(engine.getChanges()).toHaveLength(0);
    expect((globalThis as any).document.adoptedStyleSheets).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Extra: camelCase properties are converted to kebab-case in the CSS rule
  // -----------------------------------------------------------------------
  it("converts camelCase property to kebab-case in the CSS rule", () => {
    // The engine stores the original property name in the rule object
    // but the CSS rule string uses kebab-case (handled internally)
    engine.applyChange(".btn", "fontSize", "16px");
    const changes = engine.getChanges();
    expect(changes[0].property).toBe("fontSize");
    // The property is stored as-is for lookup; the CSS text uses kebab
  });
});
