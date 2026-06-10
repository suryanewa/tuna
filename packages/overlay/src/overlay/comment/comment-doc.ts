import type { Comment, CommentElementTarget } from "../../engine/comment-store";
import {
  getCommentElementTargets,
  getMentionColorForTarget,
  getMentionNameForTarget,
  orderTargetsBySelectors,
  parseCommentTextIntoParts,
  type CommentContentPart,
} from "./comment-draft";

export type CommentDocMention = {
  selector: string;
  label: string;
  color: string;
};

export type CommentDocPart =
  | { type: "text"; text: string }
  | { type: "mention"; mention: CommentDocMention };

export type CommentDoc = {
  version: 1;
  blocks: [{ type: "paragraph"; children: CommentDocPart[] }];
};

export type CommentEditorSnapshot = {
  text: string;
  userText: string;
  mentionSelectors: string[];
  /** Document-order parts with spacer text captured in text blocks. */
  parts: CommentContentPart[];
};

export type DocValidationResult = {
  valid: boolean;
  errors: string[];
};

export function createEmptyDoc(): CommentDoc {
  return { version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: "" }] }] };
}

export function partsToDoc(parts: CommentContentPart[]): CommentDoc {
  const children: CommentDocPart[] = parts.map((part) => {
    if (part.type === "mention") {
      return {
        type: "mention",
        mention: {
          selector: part.mention.selector,
          label: part.mention.name,
          color: part.mention.color,
        },
      };
    }
    return { type: "text", text: part.text };
  });
  return { version: 1, blocks: [{ type: "paragraph", children }] };
}

export function docToLexicalParts(doc: CommentDoc): CommentContentPart[] {
  const children = doc.blocks[0]?.children ?? [];
  return children.map((part) => {
    if (part.type === "mention") {
      return {
        type: "mention",
        mention: {
          name: part.mention.label,
          color: part.mention.color,
          selector: part.mention.selector,
        },
      };
    }
    return { type: "text", text: part.text };
  });
}

export function docToPlainText(doc: CommentDoc): string {
  const children = doc.blocks[0]?.children ?? [];
  let raw = "";
  for (const part of children) {
    if (part.type === "mention") {
      if (raw.length > 0 && !/\s$/.test(raw)) raw += " ";
      raw += `@${part.mention.label} `;
    } else {
      raw += part.text;
    }
  }
  return raw.replace(/\s+/g, " ").trim();
}

export function docToUserText(doc: CommentDoc): string {
  const children = doc.blocks[0]?.children ?? [];
  return children
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function docToMentionSelectors(doc: CommentDoc): string[] {
  const children = doc.blocks[0]?.children ?? [];
  return children
    .filter((part): part is { type: "mention"; mention: CommentDocMention } => part.type === "mention")
    .map((part) => part.mention.selector);
}

export function docToTargets(
  doc: CommentDoc,
  existingTargets: CommentElementTarget[],
): CommentElementTarget[] {
  const selectors = docToMentionSelectors(doc);
  return orderTargetsBySelectors(existingTargets, selectors);
}

export function commentToDoc(
  comment: Pick<Comment, "text" | "elementInfo" | "selector">,
): CommentDoc {
  const targets = getCommentElementTargets(comment.elementInfo, comment.selector);
  const parts = parseCommentTextIntoParts(comment.text, targets);
  return partsToDoc(parts);
}

export function getDoc(comment: Comment): CommentDoc {
  if (comment.content?.version === 1) return comment.content;
  return commentToDoc(comment);
}

export function lexicalPartsToDoc(parts: CommentContentPart[]): CommentDoc {
  return partsToDoc(parts);
}

/** One inline element mention. Its visual separator is owned by the mention token. */
export function buildMentionInsertionParts(
  mention: { name: string; color: string; selector: string },
): CommentContentPart[] {
  return [
    {
      type: "mention",
      mention: {
        name: mention.name,
        color: mention.color,
        selector: mention.selector,
      },
    },
  ];
}

/** Batch inline insertions. Each mention owns its visible separator. */
export function buildInlineMentionInsertionsParts(
  mentions: Array<{ name: string; color: string; selector: string }>,
): CommentContentPart[] {
  if (mentions.length === 0) return [];
  const parts: CommentContentPart[] = [];
  for (let index = 0; index < mentions.length; index += 1) {
    const mention = mentions[index]!;
    parts.push({
      type: "mention",
      mention: {
        name: mention.name,
        color: mention.color,
        selector: mention.selector,
      },
    });
  }
  return parts;
}

export function insertMentionsIntoDoc(
  doc: CommentDoc,
  mentions: Array<{ name: string; color: string; selector: string }>,
  insertAt = doc.blocks[0]?.children.length ?? 0,
): CommentDoc {
  const children = [...(doc.blocks[0]?.children ?? [])];
  const insertion = mentions.length === 1
    ? buildMentionInsertionParts(mentions[0]!)
    : buildInlineMentionInsertionsParts(mentions);
  const insertionDocParts: CommentDocPart[] = insertion.map((part) => {
    if (part.type === "mention") {
      return {
        type: "mention",
        mention: {
          selector: part.mention.selector,
          label: part.mention.name,
          color: part.mention.color,
        },
      };
    }
    return { type: "text", text: part.text };
  });
  children.splice(insertAt, 0, ...insertionDocParts);
  return { version: 1, blocks: [{ type: "paragraph", children }] };
}

export function lexicalSnapshotToDoc(
  snapshot: CommentEditorSnapshot,
  targets: CommentElementTarget[],
): CommentDoc {
  if (snapshot.parts.length > 0) {
    return lexicalPartsToDoc(snapshot.parts);
  }
  const orderedTargets = orderTargetsBySelectors(targets, snapshot.mentionSelectors);
  const parts = parseCommentTextIntoParts(snapshot.text, orderedTargets);
  return partsToDoc(parts);
}

export function createDocFromLeadingMentions(
  mentions: Array<{ name: string; color: string; selector: string }>,
  userText = "",
): CommentDoc {
  if (mentions.length === 0) {
    return { version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: userText }] }] };
  }
  const parts = buildInlineMentionInsertionsParts(mentions);
  if (userText.length > 0) {
    parts.push({ type: "text", text: userText });
  }
  return partsToDoc(parts);
}

export function createDocFromTargets(
  targets: CommentElementTarget[],
  spanMentionCount: number,
  userText = "",
): CommentDoc {
  const leading = targets.slice(0, spanMentionCount);
  const mentions = leading.map((target, index) => ({
    name: getMentionNameForTarget(target, targets),
    color: getMentionColorForTarget(target, index),
    selector: target.selector,
  }));
  return createDocFromLeadingMentions(mentions, userText);
}

export function applyTextTransaction(
  doc: CommentDoc,
  transaction: { insert?: string; replaceUserText?: string },
): CommentDoc {
  const children = [...(doc.blocks[0]?.children ?? [])];
  if (transaction.replaceUserText !== undefined) {
    const withoutText: CommentDocPart[] = children.filter((part) => part.type !== "text");
    withoutText.push({ type: "text", text: transaction.replaceUserText });
    return { version: 1, blocks: [{ type: "paragraph", children: withoutText }] };
  }
  if (transaction.insert) {
    const last = children[children.length - 1];
    if (last?.type === "text") {
      children[children.length - 1] = { type: "text", text: last.text + transaction.insert };
    } else {
      children.push({ type: "text", text: transaction.insert });
    }
    return { version: 1, blocks: [{ type: "paragraph", children }] };
  }
  return doc;
}

export function validateDoc(
  doc: CommentDoc,
  targets: CommentElementTarget[] = [],
): DocValidationResult {
  const errors: string[] = [];
  const children = doc.blocks[0]?.children ?? [];

  if (doc.version !== 1) {
    errors.push(`unsupported doc version: ${doc.version}`);
  }

  if (children.length === 0) {
    errors.push("document must have at least one child part");
  }

  const targetSelectors = new Set(targets.map((target) => target.selector));
  for (const part of children) {
    if (part.type !== "mention") continue;
    if (targets.length > 0 && !targetSelectors.has(part.mention.selector)) {
      errors.push(`mention selector not in targets: ${part.mention.selector}`);
    }
    if (!part.mention.label.trim()) {
      errors.push("mention label must not be empty");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function migrateCommentIfNeeded(comment: Comment): Comment {
  if (comment.content?.version === 1) {
    const projected = docToPlainText(comment.content);
    if (comment.text !== projected) {
      return { ...comment, text: projected };
    }
    return comment;
  }
  const content = commentToDoc(comment);
  return {
    ...comment,
    content,
    text: docToPlainText(content),
  };
}

export function cloneDoc(doc: CommentDoc): CommentDoc {
  return JSON.parse(JSON.stringify(doc)) as CommentDoc;
}
