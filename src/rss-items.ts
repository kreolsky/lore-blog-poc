// Pure RSS item builder — date rule, ordering, description fallback.
// No network, no Astro imports: unit-testable, wired into the feed by rss.xml.ts.
//
// Date rule: frontmatter date wins (an author may backdate), else the Lore
// node's created_at, else no date. Undated items sort after all dated ones
// (dated = newest first; undated keep the index page's sort_key order).

export interface RssItemInput {
  slug: string;
  title: string;
  /** Frontmatter `date` (author's choice, wins). */
  fmDate?: string;
  /** Lore public-tree node `created_at` (ISO string) — used when no fm date. */
  createdAt?: string | null;
  /** Lore public-tree node `updated_at` (ISO string), informational. */
  updated?: string | null;
  /** Lore sort_key — order for undated items. */
  order: string;
  description?: string;
  /** Fully rendered HTML of the post (feeds as item content). */
  html: string;
  /** Markdown body (description fallback source). */
  body: string;
}

export interface RssItem {
  title: string;
  link: string;
  pubDate?: Date;
  description: string;
  content: string;
}

/** Frontmatter date ?? node created_at ?? undefined. */
export function resolveDate(
  fmDate?: string,
  createdAt?: string | null,
): string | undefined {
  return fmDate ?? createdAt ?? undefined;
}

/** First paragraph of a markdown body as plain text, truncated to `max` chars. */
export function firstParagraphPlain(body: string, max = 280): string {
  const paragraphs = body.split(/\n\s*\n/);
  for (const p of paragraphs) {
    const lines = p.split('\n').filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'));
    if (lines.length === 0) continue;
    let text = lines.join(' ');
    text = text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
      .replace(/`([^`]*)`/g, '$1') // inline code
      .replace(/(\*\*|__|\*|_|~~)/g, ''); // emphasis/bold/strike
    text = text.replace(/\s+/g, ' ').trim();
    if (text === '') continue;
    if (text.length > max) text = text.slice(0, max).trimEnd() + '…';
    return text;
  }
  return '';
}

export function buildRssItems(posts: RssItemInput[]): RssItem[] {
  const item = (p: RssItemInput, date?: string): RssItem => ({
    title: p.title,
    link: `/posts/${p.slug}/`,
    ...(date ? { pubDate: new Date(date) } : {}),
    description: p.description ?? firstParagraphPlain(p.body),
    content: p.html,
  });
  // WHY parse before sorting: string order is wrong across timezone offsets and
  // between a bare frontmatter date and a full timestamp; an unparseable author
  // date fails the build naming the post instead of shipping `Invalid Date`.
  const dated = posts
    .map((p) => ({ p, date: resolveDate(p.fmDate, p.createdAt) }))
    .filter((x): x is { p: RssItemInput; date: string } => x.date !== undefined)
    .map((x) => {
      const ms = Date.parse(x.date);
      if (Number.isNaN(ms)) {
        throw new Error(`post "${x.p.slug}" (${x.p.title}): unparseable date "${x.date}" — use YYYY-MM-DD`);
      }
      return { ...x, ms };
    })
    .sort((a, b) => b.ms - a.ms)
    .map((x) => item(x.p, x.date));
  const undated = posts
    .filter((p) => resolveDate(p.fmDate, p.createdAt) === undefined)
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    .map((p) => item(p));
  return [...dated, ...undated];
}
