/**
 * Live preview engine using Constructable Stylesheets.
 *
 * Applies CSS changes to the host document without touching existing
 * stylesheets. Changes are instantly reversible by removing the sheet
 * from adoptedStyleSheets.
 */

interface AppliedRule {
  selector: string;
  property: string;
  value: string;
  index: number;
}

export class LivePreviewEngine {
  private sheet: CSSStyleSheet;
  private rules: AppliedRule[] = [];
  private attached = false;

  constructor() {
    this.sheet = new CSSStyleSheet();
  }

  /** Attach the preview stylesheet to the document */
  attach() {
    if (this.attached) return;
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.sheet];
    this.attached = true;
  }

  /** Detach — instantly reverts all preview changes */
  detach() {
    if (!this.attached) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== this.sheet
    );
    this.attached = false;
  }

  /** Apply a single property change with !important to override existing styles */
  applyChange(selector: string, property: string, value: string) {
    // Remove existing rule for this selector+property if any
    this.removeChange(selector, property);

    const kebabProp = camelToKebab(property);
    const rule = `${selector} { ${kebabProp}: ${value} !important; }`;
    const index = this.sheet.insertRule(rule, this.sheet.cssRules.length);
    this.rules.push({ selector, property, value, index });
  }

  /** Remove a specific property change */
  removeChange(selector: string, property: string) {
    const ruleIndex = this.rules.findIndex(
      (r) => r.selector === selector && r.property === property
    );
    if (ruleIndex === -1) return;

    // Delete from stylesheet — indices shift, so rebuild
    this.rebuildSheet(
      this.rules.filter((_, i) => i !== ruleIndex)
    );
  }

  /** Remove all changes for a selector */
  removeAllChanges(selector: string) {
    this.rebuildSheet(
      this.rules.filter((r) => r.selector !== selector)
    );
  }

  /** Clear all preview changes */
  clearAll() {
    this.sheet.replaceSync("");
    this.rules = [];
  }

  /** Get all currently applied changes */
  getChanges(): ReadonlyArray<AppliedRule> {
    return this.rules;
  }

  private rebuildSheet(newRules: AppliedRule[]) {
    this.sheet.replaceSync("");
    this.rules = [];
    for (const r of newRules) {
      this.applyChange(r.selector, r.property, r.value);
    }
  }

  destroy() {
    this.detach();
    this.clearAll();
  }
}

function camelToKebab(str: string): string {
  const kebab = str.replace(/([A-Z])/g, "-$1").toLowerCase();
  // Vendor prefixes: webkitX → -webkit-x
  if (kebab.startsWith("webkit-")) return `-${kebab}`;
  if (kebab.startsWith("moz-")) return `-${kebab}`;
  if (kebab.startsWith("ms-")) return `-${kebab}`;
  return kebab;
}
