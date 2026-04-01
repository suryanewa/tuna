/**
 * Comment Store — manages user comments attached to elements or areas.
 *
 * Comments are distinct from visual changes. They capture intent,
 * feedback, or instructions that the user wants to communicate to
 * AI agents alongside (or instead of) property diffs.
 */

// ── Types ──

export interface Comment {
  id: number;
  text: string;
  /** Marker position (where the user clicked / drag ended) */
  position: { x: number; y: number };
  type: "element" | "area";
  /** For element comments: CSS selector of the target */
  selector?: string;
  /** For element comments: click offset relative to the element's top-left */
  anchorOffset?: { x: number; y: number };
  /** For area comments: bounding box of the selected region, stored as page coordinates */
  area?: { x: number; y: number; width: number; height: number };
  /** For area comments: scroll position at creation time */
  areaScroll?: { x: number; y: number };
  /** Element context (captured at comment creation time) */
  elementInfo?: {
    tagName: string;
    componentName: string | null;
    componentPath: string[];
    classes: string[];
    textContent: string | null;
    /** For area comments: elements found within the selected region */
    containedElements?: Array<{
      tagName: string;
      selector: string;
      componentName: string | null;
      textContent: string | null;
    }>;
  };
  timestamp: number;
}

const STORAGE_KEY = "retune-comments";

// ── Comment Store ──

export class CommentStore {
  private comments: Map<number, Comment> = new Map();
  private nextId = 1;

  /** Add a new comment. Returns the created comment. */
  add(
    text: string,
    position: { x: number; y: number },
    type: "element" | "area",
    opts?: {
      selector?: string;
      anchorOffset?: { x: number; y: number };
      area?: { x: number; y: number; width: number; height: number };
      areaScroll?: { x: number; y: number };
      elementInfo?: Comment["elementInfo"];
    },
  ): Comment {
    const comment: Comment = {
      id: this.nextId++,
      text,
      position,
      type,
      selector: opts?.selector,
      anchorOffset: opts?.anchorOffset,
      area: opts?.area,
      areaScroll: opts?.areaScroll,
      elementInfo: opts?.elementInfo,
      timestamp: Date.now(),
    };
    this.comments.set(comment.id, comment);
    this.persist();
    return comment;
  }

  /** Update an existing comment's text. */
  update(id: number, text: string): boolean {
    const comment = this.comments.get(id);
    if (!comment) return false;
    comment.text = text;
    comment.timestamp = Date.now();
    this.persist();
    return true;
  }

  /** Delete a comment. */
  delete(id: number): boolean {
    const deleted = this.comments.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  /** Get a single comment by ID. */
  get(id: number): Comment | undefined {
    return this.comments.get(id);
  }

  /** Get all comments, ordered by ID (creation order). */
  getAll(): Comment[] {
    return Array.from(this.comments.values()).sort((a, b) => a.id - b.id);
  }

  /** Get comments for a specific element selector. */
  getBySelector(selector: string): Comment[] {
    return this.getAll().filter(
      (c) => c.type === "element" && c.selector === selector,
    );
  }

  /** Get the total number of comments. */
  get count(): number {
    return this.comments.size;
  }

  /** Clear all comments. */
  clear(): void {
    this.comments.clear();
    this.nextId = 1;
    this.persist();
  }

  /** Persist to localStorage. */
  private persist(): void {
    try {
      const data = {
        comments: this.getAll(),
        nextId: this.nextId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable
    }
  }

  /** Restore from localStorage. */
  restore(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.comments || !Array.isArray(data.comments)) return false;
      this.comments.clear();
      for (const c of data.comments) {
        this.comments.set(c.id, c);
      }
      this.nextId = data.nextId || this.comments.size + 1;
      return true;
    } catch {
      return false;
    }
  }
}
