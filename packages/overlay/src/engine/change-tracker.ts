/**
 * Tracks before/after style changes with undo/redo support.
 */

import type { ElementChange, PropertyChange } from "../types";

/** A lightweight token reference stored alongside changes */
export interface TrackedTokenRef {
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
  /** Value-only token associations: camelCase property → token ref */
  variableAssociations?: Record<string, TrackedTokenRef>;
  /** Properties explicitly unlinked from their class-based token */
  unlinkedTokens?: Set<string>;
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
  /** Saved token association for restoring on undo of unlink */
  tokenRef?: TrackedTokenRef;
  /** Previous token association for this property (null = no association existed) */
  prevTokenAssoc?: TrackedTokenRef | null;
  /** Whether property was in unlinkedTokens before this change */
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

    // Snapshot token state so undo can restore it
    const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const prevTokenAssoc = tracked.variableAssociations?.[camelProp] ?? null;
    const prevUnlinked = tracked.unlinkedTokens?.has(camelProp) ?? false;

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
        this.undoStack.push({ selector, property, value: oldValue, group: last.group, prevTokenAssoc, prevUnlinked });
      }
      last.time = now;
    } else {
      // New gesture — new group
      this.groupCounter++;
      this.undoStack.push({ selector, property, value: oldValue, group: this.groupCounter, prevTokenAssoc, prevUnlinked });
      this.lastChange = { selector, time: now, group: this.groupCounter };
    }

    this.redoStack = []; // clear redo on new change

    return { from: oldValue, to: newValue };
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
        tracked.unlinkedTokens?.delete(entry.property);
        // Restore saved token association if any
        if (entry.tokenRef) {
          if (!tracked.variableAssociations) tracked.variableAssociations = {};
          tracked.variableAssociations[entry.property] = entry.tokenRef;
        }
        this.redoStack.push({ selector: entry.selector, property: entry.property, value: "", group: redoGroup, action: "unlink", tokenRef: entry.tokenRef });
      } else {
        const currentValue = tracked.currentStyles[entry.property] || "";
        const camelProp = entry.property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        // Save current token state for redo
        const currentAssoc = tracked.variableAssociations?.[camelProp] ?? null;
        const currentUnlinked = tracked.unlinkedTokens?.has(camelProp) ?? false;
        this.redoStack.push({ selector: entry.selector, property: entry.property, value: currentValue, group: redoGroup, prevTokenAssoc: currentAssoc, prevUnlinked: currentUnlinked });
        tracked.currentStyles[entry.property] = entry.value;

        // Restore previous token association state
        if (entry.prevTokenAssoc !== undefined) {
          if (entry.prevTokenAssoc) {
            if (!tracked.variableAssociations) tracked.variableAssociations = {};
            tracked.variableAssociations[camelProp] = entry.prevTokenAssoc;
          } else {
            if (tracked.variableAssociations) delete tracked.variableAssociations[camelProp];
          }
        }
        // Restore previous unlinked state
        if (entry.prevUnlinked !== undefined) {
          if (entry.prevUnlinked) {
            if (!tracked.unlinkedTokens) tracked.unlinkedTokens = new Set();
            tracked.unlinkedTokens.add(camelProp);
          } else {
            tracked.unlinkedTokens?.delete(camelProp);
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
        if (!tracked.unlinkedTokens) tracked.unlinkedTokens = new Set();
        tracked.unlinkedTokens.add(entry.property);
        // Clear token association again
        if (tracked.variableAssociations) {
          delete tracked.variableAssociations[entry.property];
        }
        this.undoStack.push({ selector: entry.selector, property: entry.property, value: "", group: undoGroup, action: "unlink", tokenRef: entry.tokenRef });
      } else {
        const currentValue = tracked.currentStyles[entry.property] || "";
        const camelProp = entry.property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        // Save current token state for undo
        const currentAssoc = tracked.variableAssociations?.[camelProp] ?? null;
        const currentUnlinked = tracked.unlinkedTokens?.has(camelProp) ?? false;
        this.undoStack.push({ selector: entry.selector, property: entry.property, value: currentValue, group: undoGroup, prevTokenAssoc: currentAssoc, prevUnlinked: currentUnlinked });
        tracked.currentStyles[entry.property] = entry.value;

        // Restore token association state from redo entry
        if (entry.prevTokenAssoc !== undefined) {
          if (entry.prevTokenAssoc) {
            if (!tracked.variableAssociations) tracked.variableAssociations = {};
            tracked.variableAssociations[camelProp] = entry.prevTokenAssoc;
          } else {
            if (tracked.variableAssociations) delete tracked.variableAssociations[camelProp];
          }
        }
        // Restore unlinked state from redo entry
        if (entry.prevUnlinked !== undefined) {
          if (entry.prevUnlinked) {
            if (!tracked.unlinkedTokens) tracked.unlinkedTokens = new Set();
            tracked.unlinkedTokens.add(camelProp);
          } else {
            tracked.unlinkedTokens?.delete(camelProp);
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

      const unlinked = tracked.unlinkedTokens
        ? Array.from(tracked.unlinkedTokens).map(prop => ({
            property: prop,
            value: tracked.currentStyles[prop] || "",
          }))
        : [];
      const hasChanges = propertyChanges.length > 0 || unlinked.length > 0;

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

    // Migrate token associations for properties that were actually migrated
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

  /** Associate a value-only token apply with specific properties */
  setTokenAssociation(selector: string, properties: string[], token: TrackedTokenRef) {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;
    if (!tracked.variableAssociations) tracked.variableAssociations = {};
    for (const prop of properties) {
      tracked.variableAssociations[prop] = token;
    }
  }

  /** Remove token association for specific properties */
  clearTokenAssociation(selector: string, properties: string[]) {
    const tracked = this.tracked.get(selector);
    if (!tracked?.variableAssociations) return;
    for (const prop of properties) {
      delete tracked.variableAssociations[prop];
    }
  }

  /** Mark properties as explicitly unlinked from their class-based token */
  unlinkToken(selector: string, properties: string[]) {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;
    // Clear value-only associations
    if (tracked.variableAssociations) {
      for (const prop of properties) {
        delete tracked.variableAssociations[prop];
      }
    }
    // Track as unlinked (suppresses class-based token detection)
    if (!tracked.unlinkedTokens) tracked.unlinkedTokens = new Set();
    for (const prop of properties) {
      tracked.unlinkedTokens.add(prop);
    }
  }

  /** Unlink properties and push to undo stack so the operation is undoable */
  recordUnlink(selector: string, properties: string[]) {
    const tracked = this.tracked.get(selector);
    if (!tracked) return;

    // Save current token associations before clearing (for undo restore)
    const savedRefs: Record<string, TrackedTokenRef | undefined> = {};
    for (const prop of properties) {
      savedRefs[prop] = tracked.variableAssociations?.[prop];
    }

    // Perform the unlink
    this.unlinkToken(selector, properties);

    // Push to undo stack as a new group
    this.groupCounter++;
    for (const prop of properties) {
      this.undoStack.push({
        selector,
        property: prop,
        value: "",
        group: this.groupCounter,
        action: "unlink",
        tokenRef: savedRefs[prop],
      });
    }
    this.lastChange = null;
    this.redoStack = [];
  }

  /** Check if a property has been explicitly unlinked */
  isTokenUnlinked(selector: string, property: string): boolean {
    return this.tracked.get(selector)?.unlinkedTokens?.has(property) ?? false;
  }

  /** Get all unlinked token properties for a selector */
  getUnlinkedTokens(selector: string): Set<string> {
    return this.tracked.get(selector)?.unlinkedTokens ?? new Set();
  }

  /** Re-link a property (clear the unlinked state, e.g. when user picks a new token) */
  relinkToken(selector: string, properties: string[]) {
    const tracked = this.tracked.get(selector);
    if (!tracked?.unlinkedTokens) return;
    for (const prop of properties) {
      tracked.unlinkedTokens.delete(prop);
    }
  }

  /** Get token association for a property, if any */
  getTokenAssociation(selector: string, property: string): TrackedTokenRef | undefined {
    return this.tracked.get(selector)?.variableAssociations?.[property];
  }

  /** Get all token associations for a selector */
  getTokenAssociations(selector: string): Record<string, TrackedTokenRef> | undefined {
    return this.tracked.get(selector)?.variableAssociations;
  }

  /** Check if a single property differs from its original value or has been unlinked */
  isPropertyChanged(selector: string, property: string): boolean {
    const tracked = this.tracked.get(selector);
    if (!tracked) return false;
    // Unlinked properties are considered changed (intentional detach)
    if (tracked.unlinkedTokens?.has(property)) return true;
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
    if (tracked.unlinkedTokens) {
      for (const prop of tracked.unlinkedTokens) {
        result.add(prop);
      }
    }
    return result;
  }

  /** Reset a property to its original value. Pushes to undo stack so redo works. */
  resetProperty(selector: string, property: string): { from: string; to: string } | null {
    const tracked = this.tracked.get(selector);
    if (!tracked) return null;

    const currentValue = tracked.currentStyles[property] || "";
    const originalValue = tracked.originalStyles[property] || "";
    const isUnlinked = tracked.unlinkedTokens?.has(property) ?? false;
    // Nothing to reset if value unchanged AND not unlinked
    if (currentValue === originalValue && !isUnlinked) return null;

    // Revert to original
    tracked.currentStyles[property] = originalValue;

    // Push to undo stack as a new group (discrete user action, no coalescing)
    this.groupCounter++;
    this.undoStack.push({ selector, property, value: currentValue, group: this.groupCounter });
    this.lastChange = null; // Don't coalesce with subsequent changes
    this.redoStack = []; // Standard: clear redo on new action

    // Clear token association and unlinked state for this property
    if (tracked.variableAssociations) {
      const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete tracked.variableAssociations[camelProp];
      delete tracked.variableAssociations[property];
    }
    if (tracked.unlinkedTokens) {
      tracked.unlinkedTokens.delete(property);
      const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      tracked.unlinkedTokens.delete(camelProp);
    }

    this.persist();
    return { from: currentValue, to: originalValue };
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
        { ...v, unlinkedTokens: v.unlinkedTokens ? Array.from(v.unlinkedTokens) : undefined },
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
        if (tracked.unlinkedTokens && Array.isArray(tracked.unlinkedTokens)) {
          tracked.unlinkedTokens = new Set(tracked.unlinkedTokens as unknown as string[]);
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
