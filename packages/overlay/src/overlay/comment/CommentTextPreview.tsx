import { useMemo, type ReactNode } from "react";
import type { Comment } from "../../engine/comment-store";
import { docToLexicalParts, getDoc } from "./comment-doc";
import type { CommentContentPart } from "./comment-draft";

export function getCommentTextParts(comment: Comment): CommentContentPart[] {
  return docToLexicalParts(getDoc(comment));
}

export function renderCommentTextParts(container: HTMLElement, parts: CommentContentPart[]) {
  container.replaceChildren();
  for (const part of parts) {
    if (part.type === "mention") {
      const span = document.createElement("span");
      span.className = "tuna-comment-mention";
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
          className="tuna-comment-mention"
          style={{ color: part.mention.color }}
        >
          @{part.mention.name}
        </span>
      );
    }
    return <span key={index}>{part.text}</span>;
  });
}
