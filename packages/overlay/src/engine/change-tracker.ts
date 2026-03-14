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
  tokenAssociations?: Record<string, TrackedTokenRef>;
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
        this.undoStack.push({ selector, property, value: oldValue, group: last.group });
      }
      last.time = now;
    } else {
      // New gesture — new group
      this.groupCounter++;
      this.undoStack.push({ selector, property, value: oldValue, group: this.groupCounter });
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
  popUndo(): Array<{ selector: string; property: string; value: string }> | null {
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
      if (tracked) {
        const currentValue = tracked.currentStyles[entry.property] || "";
        this.redoStack.push({ selector: entry.selector, property: entry.property, value: currentValue, group: redoGroup });
        tracked.currentStyles[entry.property] = entry.value;

        // If reverting to original value, clear any token association for this property
        if (tracked.tokenAssociations) {
          const camelProp = entry.property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          if (entry.value === (tracked.originalStyles[entry.property] || "")) {
            delete tracked.tokenAssociations[camelProp];
          }
        }
      }
    }

    this.persist();
    return entries;
  }

  /** Pop an entire redo group and return all entries */
  popRedo(): Array<{ selector: string; property: string; value: string }> | null {
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
      if (tracked) {
        const currentValue = tracked.currentStyles[entry.property] || "";
        this.undoStack.push({ selector: entry.selector, property: entry.property, value: currentValue, group: undoGroup });
        tracked.currentStyles[entry.property] = entry.value;
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

      if (propertyChanges.length > 0) {
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
        if (tracked.tokenAssociations && Object.keys(tracked.tokenAssociations).length > 0) {
          change.tokenAssociations = tracked.tokenAssociations;
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
    if (from.tokenAssociations) {
      if (!to.tokenAssociations) to.tokenAssociations = {};
      for (const { property } of migrated) {
        const camelProp = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (from.tokenAssociations[camelProp]) {
          to.tokenAssociations[camelProp] = from.tokenAssociations[camelProp];
          delete from.tokenAssociations[camelProp];
        }
        // Also check kebab-case key
        if (from.tokenAssociations[property]) {
          to.tokenAssociations[property] = from.tokenAssociations[property];
          delete from.tokenAssociations[property];
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
    if (!tracked.tokenAssociations) tracked.tokenAssociations = {};
    for (const prop of properties) {
      tracked.tokenAssociations[prop] = token;
    }
  }

  /** Get token association for a property, if any */
  getTokenAssociation(selector: string, property: string): TrackedTokenRef | undefined {
    return this.tracked.get(selector)?.tokenAssociations?.[property];
  }

  /** Get all token associations for a selector */
  getTokenAssociations(selector: string): Record<string, TrackedTokenRef> | undefined {
    return this.tracked.get(selector)?.tokenAssociations;
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
      const data = {
        tracked: Array.from(this.tracked.entries()),
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
