/**
 * Comment Store — manages user comments attached to elements or areas.
 *
 * Comments are distinct from visual changes. They capture intent,
 * feedback, or instructions that the user wants to communicate to
 * AI agents alongside (or instead of) property diffs.
 */

import type { CommentDoc } from "../overlay/comment/comment-doc";
import { docToPlainText, migrateCommentIfNeeded } from "../overlay/comment/comment-doc";

// ── Types ──

export interface CommentElementTarget {
  tagName: string;
  selector: string;
  componentName: string | null;
  componentPath?: string[];
  classes: string[];
  textContent: string | null;
  source?: string;
  domPath?: string;
  /** Outline / mention color when the target was captured (e.g. draw stroke). */
  mentionColor?: string;
  /** For drawing mentions: geometry captured from the SVG path at comment/copy time. */
  drawing?: {
    orderIndex: number;
    pathData: string;
    stroke: string;
    fill: string;
    bounds: { x: number; y: number; width: number; height: number };
    pageBounds: { x: number; y: number; width: number; height: number };
  };
}

export interface Comment {
  id: number;
  text: string;
  /** Canonical structured content; plain text is a derived projection. */
  content?: CommentDoc;
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
    source?: string;
    domPath?: string;
    /** For element comments from a multi-select: all targeted elements */
    selectedElements?: CommentElementTarget[];
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

export type CommentPatch = Partial<Omit<Comment, "id" | "timestamp">>;

const STORAGE_KEY = "tuna-comments";

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
      content?: CommentDoc;
    },
  ): Comment {
    const content = opts?.content;
    const comment: Comment = {
      id: this.nextId++,
      text: content ? docToPlainText(content) : text,
      content,
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

  /** Add a comment using canonical doc content (dual-writes derived text). */
  addWithDoc(
    content: CommentDoc,
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
    return this.add(docToPlainText(content), position, type, { ...opts, content });
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

  /** Atomically update canonical content, derived text, and mention targets. */
  updateContent(
    id: number,
    content: CommentDoc,
    selectedElements: CommentElementTarget[],
  ): boolean {
    const comment = this.comments.get(id);
    if (!comment) return false;
    comment.content = content;
    comment.text = docToPlainText(content);
    if (comment.elementInfo) {
      comment.elementInfo = {
        ...comment.elementInfo,
        selectedElements,
      };
    } else if (selectedElements.length > 0) {
      const primary = selectedElements.find((target) => target.tagName !== "drawing") ?? selectedElements[0];
      comment.elementInfo = {
        tagName: primary.tagName,
        componentName: primary.componentName,
        componentPath: primary.componentPath ?? [],
        classes: primary.classes,
        textContent: primary.textContent,
        source: primary.source,
        domPath: primary.domPath,
        selectedElements,
      };
    }
    comment.timestamp = Date.now();
    this.persist();
    return true;
  }

  /** Patch comment metadata while keeping persistence and timestamps centralized. */
  patch(id: number, updates: CommentPatch): boolean {
    const comment = this.comments.get(id);
    if (!comment) return false;
    Object.assign(comment, updates);
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
  persist(): void {
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
      let migrated = false;
      for (const c of data.comments) {
        const comment = migrateCommentIfNeeded(c as Comment);
        if (comment.content && !(c as Comment).content) migrated = true;
        this.comments.set(comment.id, comment);
      }
      this.nextId = data.nextId || this.comments.size + 1;
      if (migrated) this.persist();
      return true;
    } catch {
      return false;
    }
  }
}
