export function getPlainTextFromEditableHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

export function setElementPlainTextWithLineBreaks(element: HTMLElement, text: string): void {
  const nodes: Node[] = [];
  const lines = text.split("\n");

  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      nodes.push(element.ownerDocument.createElement("br"));
    }
    if (line) {
      nodes.push(element.ownerDocument.createTextNode(line));
    }
  }

  element.replaceChildren(...nodes);
}
