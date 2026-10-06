// Astro Content Layer object loader over a Lore subtree shared for anonymous reading.
// Consumes the public API as-is (read-only GETs):
//   {url}/api/public/documents/{root}/tree          — {nodes, scope, root_id, project_name}
//   {url}/api/public/documents/{id}                 — {document_id, title, content, tables_json, headings}
//   {url}/api/public/documents/{root}/references    — {references}
//   {url}/api/public/documents/{root}/files/{ref}/{basename(file_path)} — file download

import type { Loader } from 'astro/loaders';
import { extractFrontmatter, isPublished, type Frontmatter } from './frontmatter.ts';
import { rewriteLinks, type LoreReference } from './rewrite-links.ts';

interface TreeNode {
  id: string;
  title: string;
  parent_id: string | null;
  sort_key: string;
  // Absent until the Lore change exposing them reaches prod — posts are then
  // simply undated (optional here on purpose).
  created_at?: string | null;
  updated_at?: string | null;
}

interface TreeResponse {
  nodes: TreeNode[];
  scope: string;
  root_id: string;
  project_name: string;
}

interface DocResponse {
  document_id: string;
  title: string;
  content: string;
  tables_json: string;
  headings: { level: number; text: string; line?: number }[];
}

interface RefsResponse {
  references: (LoreReference & { reference_id: string })[];
}

export interface LoreLoaderOptions {
  url: string;
  root: string;
}

interface Post {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string | null;
  categoryOrder: string | null;
  order: string;
  createdAt: string | null;
  updatedAt: string | null;
  fm: Frontmatter;
  headings: { depth: number; text: string }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Lore public API answered ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

export function loreLoader({ url, root }: LoreLoaderOptions): Loader {
  return {
    name: 'lore',
    async load({ store, renderMarkdown, generateDigest, logger, parseData }) {
      const base = url.replace(/\/+$/, '');

      const tree = await getJson<TreeResponse>(`${base}/api/public/documents/${root}/tree`);
      const nodeById = new Map(tree.nodes.map((n) => [n.id, n]));
      const docs = await Promise.all(
        tree.nodes
          .filter((n) => n.id !== root)
          .map((n) => getJson<DocResponse>(`${base}/api/public/documents/${n.id}`)),
      );
      const refsResp = await getJson<RefsResponse>(`${base}/api/public/documents/${root}/references`);
      const refById = new Map(refsResp.references.map((r) => [r.reference_id, r]));

      const fileUrl = (ref: LoreReference): string =>
        `${base}/api/public/documents/${root}/files/${ref.reference_id}/${encodeURIComponent((ref.file_path ?? '').split('/').pop() ?? '')}`;

      const posts: Post[] = [];
      for (const doc of docs) {
        const node = nodeById.get(doc.document_id);
        if (!node) continue;
        if (!doc.content || doc.content.trim() === '') continue; // folder (category), not a post
        const { fm, body: stripped } = extractFrontmatter(doc.content);
        if (!isPublished(fm)) {
          logger.info(`skipped (status=${fm.status}): ${doc.title}`);
          continue;
        }
        const body = stripped.replace(/^\s*# [^\n]*(?:\n|$)/, '').replace(/^\n+/, '');
        const parent = node.parent_id ? nodeById.get(node.parent_id) : undefined;
        const inFolder = parent !== undefined && parent.id !== root;
        posts.push({
          id: doc.document_id,
          slug: fm.slug === undefined ? doc.document_id : String(fm.slug),
          title: doc.title,
          body,
          category: inFolder ? parent.title : null,
          categoryOrder: inFolder ? parent.sort_key : null,
          order: node.sort_key,
          createdAt: node.created_at ?? null,
          updatedAt: node.updated_at ?? null,
          fm,
          headings: doc.headings.map((h) => ({ depth: h.level, text: h.text })),
        });
      }

      const postById = new Map(posts.map((p) => [p.id, p]));
      const rewriteCtx = {
        slugOf: (id: string) => postById.get(id)?.slug,
        bodyOf: (id: string) => postById.get(id)?.body,
        refOf: (id: string) => refById.get(id),
        fileUrl,
      };

      store.clear();
      for (const p of posts) {
        const body = rewriteLinks(p.body, rewriteCtx);
        const data = await parseData({
          id: p.slug,
          data: {
            title: p.title,
            category: p.category,
            categoryOrder: p.categoryOrder,
            order: p.order,
            tags: p.fm.tags ?? [],
            description: p.fm.description,
            date: p.fm.date ?? p.createdAt ?? undefined,
            updated: p.updatedAt ?? undefined,
            headings: p.headings,
          },
        });
        store.set({
          id: p.slug,
          data,
          body,
          rendered: await renderMarkdown(body),
          digest: generateDigest(body),
        });
      }
      logger.info(`lore: ${posts.length} posts from "${tree.project_name}" (${tree.scope})`);
    },
  };
}
