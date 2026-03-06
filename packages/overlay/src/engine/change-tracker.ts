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
}

export class ChangeTracker {
  private tracked = new Map<string, TrackedElement>();
  private undoStack: Array<{ selector: string; property: string; value: string }> = [];
  private redoStack: Array<{ selector: string; property: string; value: string }> = [];

  /** Start tracking an element — snapshots its current styles */
  track(
    selector: string,
    tagName: string,
    textContent: string | null,
    classes: string[],
    reactComponents: string[],
    currentStyles: Record<string, string>
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
      });
    }
  }

  /** Record a style change */
  recordChange(selector: string, property: string, newValue: string): { from: string; to: string } | null {
    const tracked = this.tracked.get(selector);
    if (!tracked) return null;

    const oldValue = tracked.currentStyles[property] || "";
    if (oldValue === newValue) return null;

    tracked.currentStyles[property] = newValue;

    this.undoStack.push({ selector, property, value: oldValue });
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
  }
}
