/**
 * PreviewBridge — lightweight pub/sub for pushing live drag values
 * directly to input DOM nodes, bypassing React reconciliation.
 *
 * During drag: picker writes values via set(property, value)
 * Input components subscribe and update DOM directly.
 * On drag end: clear() resets, React re-renders with committed state.
 */

type Listener = (value: string) => void;

export class PreviewBridge {
  private listeners = new Map<string, Set<Listener>>();
  private _active = false;

  /** Whether a drag preview is in progress */
  get active() { return this._active; }

  /** Start a preview session (suppresses React state → DOM sync in inputs) */
  start() { this._active = true; }

  /** End the preview session */
  end() {
    this._active = false;
    this.listeners.forEach((_, key) => this.notify(key, ""));
  }

  /** Push a preview value to all subscribers of a property */
  set(property: string, value: string) {
    this.notify(property, value);
  }

  /** Subscribe to preview values for a specific property.
   *  Returns an unsubscribe function. */
  subscribe(property: string, listener: Listener): () => void {
    if (!this.listeners.has(property)) {
      this.listeners.set(property, new Set());
    }
    this.listeners.get(property)!.add(listener);
    return () => {
      const set = this.listeners.get(property);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(property);
      }
    };
  }

  private notify(property: string, value: string) {
    const set = this.listeners.get(property);
    if (set) {
      for (const listener of set) listener(value);
    }
  }
}
