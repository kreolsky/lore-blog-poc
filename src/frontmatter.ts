// Optional YAML frontmatter at the start of a Lore document's content.
// Pure module: no network, no Astro imports — unit-testable.

import { load } from 'js-yaml';

export interface Frontmatter {
  status?: string;
  slug?: string;
  date?: string;
  tags?: string[];
  description?: string;
}

/** Split optional YAML frontmatter (`---\n…\n---\n`) from a Lore document body. */
export function extractFrontmatter(content: string): { fm: Frontmatter; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: {}, body: content };
  const parsed = load(m[1]);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('frontmatter is not a YAML mapping');
  }
  return { fm: parsed as Frontmatter, body: content.slice(m[0].length) };
}

/** No frontmatter (or no status) => published; status !== 'published' => skipped. */
export function isPublished(fm: Frontmatter): boolean {
  return fm.status === undefined || fm.status === 'published';
}
