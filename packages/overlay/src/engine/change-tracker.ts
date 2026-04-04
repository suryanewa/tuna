/**
 * Tracks before/after style changes with undo/redo support.
 */

import type { ElementChange, PropertyChange } from "../types";

/** A lightweight variable reference stored alongside changes */
export interface TrackedVariableRef {
  className: string;
  values: Record<string, string>;
}

interface TrackedElement {
  selector: string;
  tagName: string;
  textContent: string | null;
  classes: string[];
  reactComponents: string[];
  originalStyles: Record<string, string>;
  currentStyles: Record<string, string>;
  /** Original React prop values (snapshot at selection time) */
  originalProps?: Record<string, unknown>;
  /** Current React prop values (after edits) */
  currentProps?: Record<string, unknown>;
  /** Value-only variable associations: camelCase property → variable ref */
  variableAssociations?: Record<string, TrackedVariableRef>;
  /** Properties explicitly unlinked from their variable */
  unlinkedVariables?: Set<string>;
  /** Original HTML/SVG attribute values */
  originalAttrs?: Record<string, string>;
  /** Current HTML/SVG attribute values */
  currentAttrs?: Record<string, string>;
  sourceFile?: { fileName: string; lineNumber: number; columnNumber?: number } | null;
  stylingApproach?: string;
  inlineStyles?: string | null;
  elementId?: string | null;
  accessibleName?: string | null;
  parentContext?: string | null;
  childSummary?: string | null;
  domPath?: string;
  nearbySiblings?: string | null;
  position?: { x: number; y: number; width: number; height: number };
}

interface UndoEntry {
  selector: string;
  property: string;
  value: string;
  group: number;
  /** When set, this entry is a metadata-only unlink (no style value change) */
  action?: "unlink";
  /** Saved variable association for restoring on undo of unlink */
  variableRef?: TrackedVariableRef;
  /** Previous variable association for this property (null = no association existed) */
  prevVariableAssoc?: TrackedVariableRef | null;
  /** Whether property was in unlinkedVariables before this change */
  prevUnlinked?: boolean;
}

const COALESCE_MS = 300;

export class ChangeTracker {
  private tracked = new Map<string, TrackedElement>();
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private lastChange: { selector: string; time: number; group: number } | null = null;
  private groupCounter = 0;

  /** Start tracking an element — snapshots its current styles */
  track(
    selector: string,
    tagName: string,
    textContent: string | null,
    classes: string[],
    reactComponents: string[],
    currentStyles: Record<string, string>,
    sourceFile?: { fileName: string; lineNumber: number; columnNumber?: number } | null,
    stylingApproach?: string,
    inlineStyles?: string | null,
    elementId?: string | null,
    accessibleName?: string | null,
    parentContext?: string | null,
    childSummary?: string | null,
    domPath?: string,
    nearbySiblings?: string | null,
    position?: { x: number; y: number; width: number; height: number },
    reactProps?: Record<string, unknown> | null,
  ) {
    if (!this.tracked.has(selector)) {
      this.tracked.set(selector, {
        selector,
        tagName,
        textContent,
        classes,
        reactComponents,
        originalStyles: { ...currentStyles },
        currentStyles: { ...currentStyles },
        originalProps: reactProps ? { ...reactProps } : undefined,
        currentProps: reactProps ? { ...reactProps } : undefined,
        sourceFile,
        stylingApproach,
        inlineStyles,
        elementId,
        accessibleName,
        parentContext,
        childSummary,
        domPath,
        nearbySiblings,
        position,
      });
    } else if (reactProps) {
      // Backfill reactProps if element was tracked before props were available
      const entry = this.tracked.get(selector)!;
      if (!entry.originalProps) {
        entry.originalProps = { ...reactProps };
        entry.currentProps = { ...reactProps };
      }
    }
  }

  /** Record a React prop change */
  recordPropChange(selector: string, propName: string, newValue: unknown): void {
    const entry = this.tracked.get(selector);
    if (!entry || !entry.currentProps) return;
    entry.currentProps[propName] = newValue;
    this.persist();
  }

  /** Check if a prop has been changed from its original value */
  isPropChanged(selector: string, propName: string): boolean {
    const entry = this.tracked.get(selector);
    if (!entry?.originalProps || !entry?.currentProps) return false;
    return entry.originalProps[propName] !== entry.currentProps[propName];
  }

  /** Reset a prop to its original value. Returns the original value or undefined. */
  resetProp(selector: string, propName: string): unknown | undefined {
    const entry = this.tracked.get(selector);
    if (!entry?.originalProps || !entry?.currentProps) return undefined;
    const original = entry.originalProps[propName];
    entry.currentProps[propName] = original;
    this.persist();
    return original;
  }

  /** Record an HTML/SVG attribute change (alt, loading, autoplay, etc.) */
  recordAttributeChange(selector: string, attr: string, oldValue: string, newValue: string): void {
    const entry = this.tracked.get(selector);
    if (!entry) return;
    if (!entry.originalAttrs) entry.originalAttrs = {};
    if (!entry.currentAttrs) entry.currentAttrs = {};
    // Only store original once
    if (!(attr in entry.originalAttrs)) {
      entry.originalAttrs[attr] = oldValue;
    }
    entry.currentAttrs[attr] = newValue;
    this.persist();
  }

  /** Set an initial value for a property if it hasn't been set yet.
   *  Useful for structural properties like __reorder that aren't in the
   *  original computed styles snapshot. */
  ensureOriginalValue(selector: string, property: string, value: string) {
    const tracked = this.tracked.get(selector);
    if (tracked && !(property in tracked.originalStyles)) {
      tracked.originalStyles[property] = value;
      tracked.currentStyles[property] = value;
    }
  }

  /** Record a style change. Groups paired properties (e.g. paddingTop+paddingBottom
   *  from a single scrub gesture) into one undo step. */
  recordChange(selector: string, property: string, newValue: string): { from: string; to: string } | null {
    const tracked = this.tracked.get(selector);
    if (!tracked) return null;

    const oldValue = tracked.currentStyles[property] || "";
    if (oldValue === newValue) return null;

    tracked.currentStyles[property] = newValue;

    // Snapshot variable state so undo can restore it
    const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const prevVariableAssoc = tracked.variableAssociations?.[camelProp] ?? null;
    const prevUnlinked = tracked.unlinkedVariables?.has(camelProp) ?? false;

    const now = Date.now();
    const last = this.lastChange;

    // Coalesce by selector within COALESCE_MS. This groups paired properties
    // (e.g. paddingTop + paddingBottom from ShorthandInput) into the same
    // undo group so they revert together.
    if (last && last.selector === selector && now - last.time < COALESCE_MS) {
      // Same gesture — check if this property already has an entry in the group
      const existingIdx = this.findInGroup(last.group, property);
      if (existingIdx !== -1) {
        // Already tracked in this group — keep the original "from" value (coalesce)
      } else {
        // New property in this gesture — add to the same group
        this.undoStack.push({ selector, property, value: oldValue, group: last.group, prevVariableAssoc, prevUnlinked });
      }
      last.time = now;
    } else {
      // New gesture — new group
      this.groupCounter++;
      this.undoStack.push({ selector, property, value: oldValue, group: this.groupCounter, prevVariableAssoc, prevUnlinked });
      this.lastChange = { selector, time: now, group: this.groupCounter };
    }

    this.redoStack = []; // clear redo on new change

    return { from: oldValue, to: newValue };
  }

  /** Record a change for persistence only — no undo stack entry.
   *  Used for bulk structural changes that undo through separate mechanisms. */
  recordChangeSilent(selector: string, property: string, newValue: string): void {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;
    tracked.currentStyles[property] = newValue;
  }

  /** Find an undo entry for a property within a specific group */
  private findInGroup(group: number, property: string): number {
    for (let i = this.undoStack.length - 1; i >= 0; i--) {
      if (this.undoStack[i].group === group) {
        if (this.undoStack[i].property === property) return i;
      } else {
        break; // Groups are contiguous, so stop when we leave the group
      }
    }
    return -1;
  }

  /** Pop an entire undo group and return all entries */
  popUndo(): Array<{ selector: string; property: string; value: string; action?: "unlink" }> | null {
    if (this.undoStack.length === 0) return null;

    const top = this.undoStack[this.undoStack.length - 1];
    const group = top.group;
    const entries: UndoEntry[] = [];

    // Pop all entries in this group
    while (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1].group === group) {
      entries.push(this.undoStack.pop()!);
    }

    // Apply reverts and push to redo with the same group ID
    const redoGroup = ++this.groupCounter;
    for (const entry of entries) {
      const tracked = this.tracked.get(entry.selector);
      if (!tracked) continue;

      if (entry.action === "unlink") {
        // Undo an unlink → relink the property
        tracked.unlinkedVariables?.delete(entry.property);
        // Restore saved variable association if any
        if (entry.variableRef) {
          if (!tracked.variableAssociations) tracked.variableAssociations = {};
          tracked.variableAssociations[entry.property] = entry.variableRef;
        }
        this.redoStack.push({ selector: entry.selector, property: entry.property, value: "", group: redoGroup, action: "unlink", variableRef: entry.variableRef });
      } else {
        const currentValue = tracked.currentStyles[entry.property] || "";
        const camelProp = entry.property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        // Save current variable state for redo
        const currentAssoc = tracked.variableAssociations?.[camelProp] ?? null;
        const currentUnlinked = tracked.unlinkedVariables?.has(camelProp) ?? false;
        this.redoStack.push({ selector: entry.selector, property: entry.property, value: currentValue, group: redoGroup, prevVariableAssoc: currentAssoc, prevUnlinked: currentUnlinked });
        tracked.currentStyles[entry.property] = entry.value;

        // Restore previous variable association state
        if (entry.prevVariableAssoc !== undefined) {
          if (entry.prevVariableAssoc) {
            if (!tracked.variableAssociations) tracked.variableAssociations = {};
            tracked.variableAssociations[camelProp] = entry.prevVariableAssoc;
          } else {
            if (tracked.variableAssociations) delete tracked.variableAssociations[camelProp];
          }
        }
        // Restore previous unlinked state
        if (entry.prevUnlinked !== undefined) {
          if (entry.prevUnlinked) {
            if (!tracked.unlinkedVariables) tracked.unlinkedVariables = new Set();
            tracked.unlinkedVariables.add(camelProp);
          } else {
            tracked.unlinkedVariables?.delete(camelProp);
          }
        }
      }
    }

    this.persist();
    return entries;
  }

  /** Pop an entire redo group and return all entries */
  popRedo(): Array<{ selector: string; property: string; value: string; action?: "unlink" }> | null {
    if (this.redoStack.length === 0) return null;

    const top = this.redoStack[this.redoStack.length - 1];
    const group = top.group;
    const entries: UndoEntry[] = [];

    // Pop all entries in this group
    while (this.redoStack.length > 0 && this.redoStack[this.redoStack.length - 1].group === group) {
      entries.push(this.redoStack.pop()!);
    }

    // Apply and push to undo with the same group ID
    const undoGroup = ++this.groupCounter;
    for (const entry of entries) {
      const tracked = this.tracked.get(entry.selector);
      if (!tracked) continue;

      if (entry.action === "unlink") {
        // Redo an unlink → unlink the property again
        if (!tracked.unlinkedVariables) tracked.unlinkedVariables = new Set();
        tracked.unlinkedVariables.add(entry.property);
        // Clear variable association again
        if (tracked.variableAssociations) {
          delete tracked.variableAssociations[entry.property];
        }
        this.undoStack.push({ selector: entry.selector, property: entry.property, value: "", group: undoGroup, action: "unlink", variableRef: entry.variableRef });
      } else {
        const currentValue = tracked.currentStyles[entry.property] || "";
        const camelProp = entry.property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        // Save current variable state for undo
        const currentAssoc = tracked.variableAssociations?.[camelProp] ?? null;
        const currentUnlinked = tracked.unlinkedVariables?.has(camelProp) ?? false;
        this.undoStack.push({ selector: entry.selector, property: entry.property, value: currentValue, group: undoGroup, prevVariableAssoc: currentAssoc, prevUnlinked: currentUnlinked });
        tracked.currentStyles[entry.property] = entry.value;

        // Restore variable association state from redo entry
        if (entry.prevVariableAssoc !== undefined) {
          if (entry.prevVariableAssoc) {
            if (!tracked.variableAssociations) tracked.variableAssociations = {};
            tracked.variableAssociations[camelProp] = entry.prevVariableAssoc;
          } else {
            if (tracked.variableAssociations) delete tracked.variableAssociations[camelProp];
          }
        }
        // Restore unlinked state from redo entry
        if (entry.prevUnlinked !== undefined) {
          if (entry.prevUnlinked) {
            if (!tracked.unlinkedVariables) tracked.unlinkedVariables = new Set();
            tracked.unlinkedVariables.add(camelProp);
          } else {
            tracked.unlinkedVariables?.delete(camelProp);
          }
        }
      }
    }

    this.persist();
    return entries;
  }

  /** Get all pending changes (properties that differ from original) */
  getPendingChanges(): ElementChange[] {
    const changes: ElementChange[] = [];

    for (const tracked of this.tracked.values()) {
      const propertyChanges: PropertyChange[] = [];

      for (const [prop, currentVal] of Object.entries(tracked.currentStyles)) {
        const originalVal = tracked.originalStyles[prop] || "";
        if (currentVal !== originalVal) {
          propertyChanges.push({
            property: prop,
            from: originalVal,
            to: currentVal,
          });
        }
      }

      // Collect prop changes
      const propChanges: Array<{ prop: string; from: unknown; to: unknown }> = [];
      if (tracked.originalProps && tracked.currentProps) {
        for (const [prop, currentVal] of Object.entries(tracked.currentProps)) {
          const originalVal = tracked.originalProps[prop];
          if (currentVal !== originalVal) {
            propChanges.push({ prop, from: originalVal, to: currentVal });
          }
        }
      }

      // Collect attribute changes
      const attributeChanges: Array<{ attr: string; from: string; to: string }> = [];
      if (tracked.originalAttrs && tracked.currentAttrs) {
        for (const [attr, currentVal] of Object.entries(tracked.currentAttrs)) {
          const originalVal = tracked.originalAttrs[attr] || "";
          if (currentVal !== originalVal) {
            attributeChanges.push({ attr, from: originalVal, to: currentVal });
          }
        }
      }

      const unlinked = tracked.unlinkedVariables
        ? Array.from(tracked.unlinkedVariables).map(prop => ({
            property: prop,
            value: tracked.currentStyles[prop] || "",
          }))
        : [];
      const hasChanges = propertyChanges.length > 0 || unlinked.length > 0 || propChanges.length > 0 || attributeChanges.length > 0;

      if (hasChanges) {
        const change: ElementChange = {
          selector: tracked.selector,
          tagName: tracked.tagName,
          textContent: tracked.textContent,
          classes: tracked.classes,
          reactComponents: tracked.reactComponents,
          changes: propertyChanges,
          timestamp: Date.now(),
          sourceFile: tracked.sourceFile,
          stylingApproach: tracked.stylingApproach,
          inlineStyles: tracked.inlineStyles,
          elementId: tracked.elementId,
          accessibleName: tracked.accessibleName,
          parentContext: tracked.parentContext,
          childSummary: tracked.childSummary,
          domPath: tracked.domPath,
          nearbySiblings: tracked.nearbySiblings,
          position: tracked.position,
        };
        if (tracked.variableAssociations && Object.keys(tracked.variableAssociations).length > 0) {
          change.variableAssociations = tracked.variableAssociations;
        }
        if (unlinked.length > 0) {
          change.unlinkedProperties = unlinked;
        }
        if (propChanges.length > 0) {
          change.propChanges = propChanges;
        }
        if (attributeChanges.length > 0) {
          change.attributeChanges = attributeChanges;
        }
        changes.push(change);
      }
    }

    return changes;
  }

  /** Check if there are any pending changes */
  hasPendingChanges(): boolean {
    return this.getPendingChanges().length > 0;
  }

  /** Migrate pending changes from one selector to another.
   *  Moves diffed properties (original vs current) to the target selector,
   *  resets the source selector back to its original state. */
  migrateChanges(fromSelector: string, toSelector: string): Array<{ property: string; value: string }> {
    const from = this.tracked.get(fromSelector);
    const to = this.tracked.get(toSelector);
    if (!from || !to) return [];

    const migrated: Array<{ property: string; value: string }> = [];

    for (const [prop, currentVal] of Object.entries(from.currentStyles)) {
      const originalVal = from.originalStyles[prop] || "";
      if (currentVal !== originalVal) {
        migrated.push({ property: prop, value: currentVal });
        // Apply to target
        to.currentStyles[prop] = currentVal;
        // Reset source back to original
        from.currentStyles[prop] = originalVal;
      }
    }

    // Migrate variable associations for properties that were actually migrated
    if (from.variableAssociations) {
      if (!to.variableAssociations) to.variableAssociations = {};
      for (const { property } of migrated) {
        const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (from.variableAssociations[camelProp]) {
          to.variableAssociations[camelProp] = from.variableAssociations[camelProp];
          delete from.variableAssociations[camelProp];
        }
        // Also check kebab-case key
        if (from.variableAssociations[property]) {
          to.variableAssociations[property] = from.variableAssociations[property];
          delete from.variableAssociations[property];
        }
      }
    }

    // Clear undo/redo since migration invalidates the history
    this.undoStack = [];
    this.redoStack = [];

    return migrated;
  }

  /** Associate a value-only variable apply with specific properties */
  setVariableAssociation(selector: string, properties: string[], token: TrackedVariableRef) {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;
    if (!tracked.variableAssociations) tracked.variableAssociations = {};
    for (const prop of properties) {
      tracked.variableAssociations[prop] = token;
    }
  }

  /** Remove variable association for specific properties */
  clearVariableAssociation(selector: string, properties: string[]) {
    const tracked = this.tracked.get(selector);
    if (!tracked?.variableAssociations) return;
    for (const prop of properties) {
      delete tracked.variableAssociations[prop];
    }
  }

  /** Mark properties as explicitly unlinked from their variable */
  unlinkVariable(selector: string, properties: string[]) {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;
    // Clear value-only associations
    if (tracked.variableAssociations) {
      for (const prop of properties) {
        delete tracked.variableAssociations[prop];
      }
    }
    // Track as unlinked (suppresses variable detection)
    if (!tracked.unlinkedVariables) tracked.unlinkedVariables = new Set();
    for (const prop of properties) {
      tracked.unlinkedVariables.add(prop);
    }
  }

  /** Unlink properties and push to undo stack so the operation is undoable */
  recordUnlink(selector: string, properties: string[]) {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;

    // Save current variable associations before clearing (for undo restore)
    const savedRefs: Record<string, TrackedVariableRef | undefined> = {};
    for (const prop of properties) {
      savedRefs[prop] = tracked.variableAssociations?.[prop];
    }

    // Perform the unlink
    this.unlinkVariable(selector, properties);

    // Push to undo stack as a new group
    this.groupCounter++;
    for (const prop of properties) {
      this.undoStack.push({
        selector,
        property: prop,
        value: "",
        group: this.groupCounter,
        action: "unlink",
        variableRef: savedRefs[prop],
      });
    }
    this.lastChange = null;
    this.redoStack = [];
  }

  /** Check if a property has been explicitly unlinked */
  isVariableUnlinked(selector: string, property: string): boolean {
    return this.tracked.get(selector)?.unlinkedVariables?.has(property) ?? false;
  }

  /** Get all unlinked variable properties for a selector */
  getUnlinkedVariables(selector: string): Set<string> {
    return this.tracked.get(selector)?.unlinkedVariables ?? new Set();
  }

  /** Re-link a property (clear the unlinked state, e.g. when user picks a new variable) */
  relinkVariable(selector: string, properties: string[]) {
    const tracked = this.tracked.get(selector);
    if (!tracked?.unlinkedVariables) return;
    for (const prop of properties) {
      tracked.unlinkedVariables.delete(prop);
    }
  }

  /** Get variable association for a property, if any */
  getVariableAssociation(selector: string, property: string): TrackedVariableRef | undefined {
    return this.tracked.get(selector)?.variableAssociations?.[property];
  }

  /** Get all variable associations for a selector */
  getVariableAssociations(selector: string): Record<string, TrackedVariableRef> | undefined {
    return this.tracked.get(selector)?.variableAssociations;
  }

  /** Check if a single property differs from its original value or has been unlinked */
  isPropertyChanged(selector: string, property: string): boolean {
    const tracked = this.tracked.get(selector);
    if (!tracked) return false;
    // Unlinked properties are considered changed (intentional detach)
    if (tracked.unlinkedVariables?.has(property)) return true;
    const original = tracked.originalStyles[property] || "";
    const current = tracked.currentStyles[property] || "";
    return original !== current;
  }

  /** Get all changed properties for an element (camelCase keys) */
  getChangedProperties(selector: string): Set<string> {
    const result = new Set<string>();
    const tracked = this.tracked.get(selector);
    if (!tracked) return result;
    for (const [prop, currentVal] of Object.entries(tracked.currentStyles)) {
      const originalVal = tracked.originalStyles[prop] || "";
      if (currentVal !== originalVal) {
        result.add(prop);
      }
    }
    // Also include unlinked properties (intentional detach counts as a change)
    if (tracked.unlinkedVariables) {
      for (const prop of tracked.unlinkedVariables) {
        result.add(prop);
      }
    }
    return result;
  }

  /** Silently revert a property to its original value without touching the undo stack.
   *  Used for bulk entry cleanup when undoing structural changes. */
  silentRevert(selector: string, property: string): void {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;
    const original = tracked.originalStyles[property] || "";
    tracked.currentStyles[property] = original;
  }

  /** Completely remove a pseudo-property from a tracked element.
   *  Deletes from both originalStyles and currentStyles so it won't appear in pending changes. */
  removeProperty(selector: string, property: string): void {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;
    delete tracked.originalStyles[property];
    delete tracked.currentStyles[property];
  }

  /** Reset a property to its original value. Pushes to undo stack so redo works. */
  resetProperty(selector: string, property: string): { from: string; to: string } | null {
    const tracked = this.tracked.get(selector);
    if (!tracked) return null;

    const currentValue = tracked.currentStyles[property] || "";
    const originalValue = tracked.originalStyles[property] || "";
    const isUnlinked = tracked.unlinkedVariables?.has(property) ?? false;
    // Nothing to reset if value unchanged AND not unlinked
    if (currentValue === originalValue && !isUnlinked) return null;

    // Revert to original
    tracked.currentStyles[property] = originalValue;

    // Snapshot variable state before clearing (for undo restoration)
    const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const prevVariableAssoc = tracked.variableAssociations?.[camelProp] ?? tracked.variableAssociations?.[property] ?? null;
    const prevUnlinked = tracked.unlinkedVariables?.has(camelProp) || tracked.unlinkedVariables?.has(property) || false;

    // Push to undo stack as a new group (discrete user action, no coalescing)
    this.groupCounter++;
    this.undoStack.push({ selector, property, value: currentValue, group: this.groupCounter, prevVariableAssoc, prevUnlinked });
    this.lastChange = null; // Don't coalesce with subsequent changes
    this.redoStack = []; // Standard: clear redo on new action

    // Clear variable association and unlinked state for this property
    if (tracked.variableAssociations) {
      delete tracked.variableAssociations[camelProp];
      delete tracked.variableAssociations[property];
    }
    if (tracked.unlinkedVariables) {
      tracked.unlinkedVariables.delete(property);
      tracked.unlinkedVariables.delete(camelProp);
    }

    this.persist();
    return { from: currentValue, to: originalValue };
  }

  /** Prevent the next change from coalescing with the previous one */
  breakCoalescing() {
    this.lastChange = null;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  /** Clear all tracking */
  clear() {
    this.tracked.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.persist();
  }

  private static STORAGE_KEY = "retune-pending-changes";

  /** Save state to localStorage */
  persist() {
    try {
      // Convert Sets to arrays for JSON serialization
      const entries = Array.from(this.tracked.entries()).map(([k, v]) => [
        k,
        { ...v, unlinkedVariables: v.unlinkedVariables ? Array.from(v.unlinkedVariables) : undefined },
      ]);
      const data = {
        tracked: entries,
        undoStack: this.undoStack,
        redoStack: this.redoStack,
      };
      localStorage.setItem(ChangeTracker.STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable
    }
  }

  /** Restore state from localStorage */
  restore(): boolean {
    try {
      const raw = localStorage.getItem(ChangeTracker.STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.tracked = new Map(data.tracked);
      // Restore Sets from arrays
      for (const tracked of this.tracked.values()) {
        if (tracked.unlinkedVariables && Array.isArray(tracked.unlinkedVariables)) {
          tracked.unlinkedVariables = new Set(tracked.unlinkedVariables as unknown as string[]);
        }
      }
      this.undoStack = data.undoStack || [];
      this.redoStack = data.redoStack || [];
      // Restore groupCounter from existing entries
      for (const e of this.undoStack) {
        if (e.group > this.groupCounter) this.groupCounter = e.group;
      }
      for (const e of this.redoStack) {
        if (e.group > this.groupCounter) this.groupCounter = e.group;
      }
      return this.hasPendingChanges();
    } catch {
      return false;
    }
  }
}
