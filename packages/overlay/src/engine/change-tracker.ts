/**
 * Tracks before/after style changes with undo/redo support.
 */

import type { ElementChange, PropertyChange } from "../types";

interface TrackedElement {
  selector: string;
  tagName: string;
  textContent: string | null;
  classes: string[];
  reactComponents: string[];
  originalStyles: Record<string, string>;
  currentStyles: Record<string, string>;
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

const COALESCE_MS = 300;

export class ChangeTracker {
  private tracked = new Map<string, TrackedElement>();
  private undoStack: Array<{ selector: string; property: string; value: string }> = [];
  private redoStack: Array<{ selector: string; property: string; value: string }> = [];
  private lastChange: { selector: string; property: string; time: number } | null = null;

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

  /** Record a style change (coalesces rapid changes to the same property) */
  recordChange(selector: string, property: string, newValue: string): { from: string; to: string } | null {
    const tracked = this.tracked.get(selector);
    if (!tracked) return null;

    const oldValue = tracked.currentStyles[property] || "";
    if (oldValue === newValue) return null;

    tracked.currentStyles[property] = newValue;

    const now = Date.now();
    const last = this.lastChange;

    // Coalesce: if same selector+property within COALESCE_MS, update the
    // existing undo entry instead of pushing a new one. This keeps the
    // "before" value from the start of the gesture so undo reverts the
    // entire scrub in one step.
    if (
      last &&
      last.selector === selector &&
      last.property === property &&
      now - last.time < COALESCE_MS
    ) {
      // Update timestamp but keep the original undo entry's value
      last.time = now;
    } else {
      this.undoStack.push({ selector, property, value: oldValue });
      this.lastChange = { selector, property, time: now };
    }

    this.redoStack = []; // clear redo on new change

    return { from: oldValue, to: newValue };
  }

  /** Get the last change for undo */
  popUndo(): { selector: string; property: string; value: string } | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    const tracked = this.tracked.get(entry.selector);
    if (tracked) {
      const currentValue = tracked.currentStyles[entry.property] || "";
      this.redoStack.push({ selector: entry.selector, property: entry.property, value: currentValue });
      tracked.currentStyles[entry.property] = entry.value;
    }

    return entry;
  }

  /** Get the last undone change for redo */
  popRedo(): { selector: string; property: string; value: string } | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    const tracked = this.tracked.get(entry.selector);
    if (tracked) {
      const currentValue = tracked.currentStyles[entry.property] || "";
      this.undoStack.push({ selector: entry.selector, property: entry.property, value: currentValue });
      tracked.currentStyles[entry.property] = entry.value;
    }

    return entry;
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
        changes.push({
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
        });
      }
    }

    return changes;
  }

  /** Check if there are any pending changes */
  hasPendingChanges(): boolean {
    return this.getPendingChanges().length > 0;
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

  private static STORAGE_KEY = "composer-pending-changes";

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
      return this.hasPendingChanges();
    } catch {
      return false;
    }
  }
}
