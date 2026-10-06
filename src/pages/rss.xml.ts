import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { buildRssItems, type RssItemInput } from '../rss-items.ts';
import type { CollectionEntry } from 'astro:content';

export async function GET(context: { site: URL }) {
  const posts: CollectionEntry<'lore'>[] = await getCollection('lore');
  const items = buildRssItems(
    posts.map((p): RssItemInput => {
      const d = p.data as {
        title: string;
        order: string;
        date?: string;
        updated?: string;
        description?: string;
      };
      const body: string = p.body ?? '';
      return {
        slug: p.id,
        title: d.title,
        fmDate: d.date, // already fm.date ?? created_at in the loader
        order: d.order,
        description: d.description,
        html: p.rendered?.html ?? '',
        body,
      };
    }),
  );
  return rss({
    title: 'Lore Blog PoC',
    description: 'Блог, собранный из публичного поддерева Lore',
    site: context.site,
    items,
  });
}
