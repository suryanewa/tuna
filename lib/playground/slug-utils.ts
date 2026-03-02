import type { Page } from "@/lib/playground/store";

/**
 * Convert a page name to a URL slug (kebab-case).
 * - Lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Trim leading/trailing hyphens
 * - If empty, return "untitled"
 */
export function nameToSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

/**
 * Given a candidate slug and a list of existing slugs,
 * return a unique slug by appending -2, -3, etc. if needed.
 */
export function ensureUniqueSlug(
  candidate: string,
  existingSlugs: string[]
): string {
  if (!existingSlugs.includes(candidate)) return candidate;
  let counter = 2;
  while (existingSlugs.includes(`${candidate}-${counter}`)) {
    counter++;
  }
  return `${candidate}-${counter}`;
}

/**
 * Find a page by slug from a pages array.
 */
export function findPageBySlug(
  pages: Page[],
  slug: string
): Page | undefined {
  return pages.find((p) => p.slug === slug);
}

/**
 * Find a page by ID from a pages array.
 */
export function findPageById(
  pages: Page[],
  id: string
): Page | undefined {
  return pages.find((p) => p.id === id);
}
