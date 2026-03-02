import type { Page } from "./store";

export const INTERNAL_LINK_PREFIX = "page:";

export type ParsedLink =
  | { type: "external"; url: string; target: "_self" | "_blank" }
  | { type: "page"; pageId: string }
  | { type: "broken-page"; pageId: string };

/** Check if a URL is an internal page link */
export function isInternalLink(url: string): boolean {
  return url.startsWith(INTERNAL_LINK_PREFIX);
}

/** Extract page ID from an internal link URL */
export function parseInternalLink(url: string): string | null {
  if (!isInternalLink(url)) return null;
  return url.slice(INTERNAL_LINK_PREFIX.length);
}

/** Create an internal link URL from a page ID */
export function createInternalLink(pageId: string): string {
  return `${INTERNAL_LINK_PREFIX}${pageId}`;
}

/** Resolve a link URL to a ParsedLink */
export function resolveLink(url: string, target: "_self" | "_blank", pages: Page[]): ParsedLink {
  if (!isInternalLink(url)) {
    return { type: "external", url, target };
  }
  const pageId = url.slice(INTERNAL_LINK_PREFIX.length);
  const exists = pages.some(p => p.id === pageId);
  return exists
    ? { type: "page", pageId }
    : { type: "broken-page", pageId };
}
