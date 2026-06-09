import { useMemo, type ReactNode } from "react";
import type { Comment } from "../../engine/comment-store";
import {
  getCommentElementTargets,
  parseCommentTextIntoParts,
  type CommentContentPart,
} from "./comment-draft";

export function getCommentTextParts(comment: Comment): CommentContentPart[] {
  const targets = getCommentElementTargets(comment.elementInfo, comment.selector);
  return parseCommentTextIntoParts(comment.text, targets);
}

export function renderCommentTextParts(container: HTMLElement, parts: CommentContentPart[]) {
  container.replaceChildren();
  for (const part of parts) {
    if (part.type === "mention") {
      const span = document.createElement("span");
      span.className = "retune-comment-mention";
      span.style.color = part.mention.color;
      span.textContent = `@${part.mention.name}`;
      container.appendChild(span);
    } else {
      container.appendChild(document.createTextNode(part.text));
    }
  }
}

export function CommentTextPreview({ comment }: { comment: Comment }): ReactNode {
  const parts = useMemo(() => getCommentTextParts(comment), [comment]);

  return parts.map((part, index) => {
    if (part.type === "mention") {
      return (
        <span
          key={index}
          className="retune-comment-mention"
          style={{ color: part.mention.color }}
        >
          @{part.mention.name}
        </span>
      );
    }
    return <span key={index}>{part.text}</span>;
  });
}
