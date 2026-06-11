import {
  $applyNodeReplacement,
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
} from "lexical";

export type SerializedMentionNode = SerializedTextNode & {
  name: string;
  color: string;
  selector: string;
};

export class MentionNode extends TextNode {
  __name: string;
  __color: string;
  __selector: string;

  static getType(): string {
    return "retune-mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__name, node.__color, node.__selector, node.__key);
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    return $createMentionNode(
      serializedNode.name,
      serializedNode.color,
      serializedNode.selector,
    ).updateFromJSON(serializedNode);
  }

  constructor(name: string, color: string, selector: string, key?: NodeKey) {
    super(`@${name}`, key);
    this.__name = name;
    this.__color = color;
    this.__selector = selector;
    // NOTE: Do not call setMode() here. The constructor runs during clone()
    // (via $cloneWithProperties), and setMode() calls getWritable() which
    // clones again — causing infinite recursion. Token mode is preserved
    // across clones by TextNode.afterCloneFrom; we only set it at creation
    // time in $createMentionNode below.
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = "retune-comment-mention";
    dom.style.color = this.__color;
    dom.dataset.mention = "true";
    dom.dataset.mentionSelector = this.__selector;
    dom.contentEditable = "false";
    return dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const shouldReplace = super.updateDOM(prevNode, dom, config);
    if (prevNode.__color !== this.__color) {
      dom.style.color = this.__color;
    }
    if (prevNode.__selector !== this.__selector) {
      dom.dataset.mentionSelector = this.__selector;
    }
    return shouldReplace;
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      name: this.__name,
      color: this.__color,
      selector: this.__selector,
    };
  }

  getSelector(): string {
    return this.getLatest().__selector;
  }

  getName(): string {
    return this.getLatest().__name;
  }

  getColor(): string {
    return this.getLatest().__color;
  }
}

export function $createMentionNode(name: string, color: string, selector: string): MentionNode {
  const node = new MentionNode(name, color, selector);
  node.setMode("token");
  return $applyNodeReplacement(node);
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}
