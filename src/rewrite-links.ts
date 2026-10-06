// Pure markdown link rewriter: turns Lore's doc:/ref:/note: links into static-blog
// links. Grammar mirrors lore's frontend/src/components/editor/link-patterns.ts
// (single or double brackets). No network, no Astro imports — unit-testable.

export interface LoreReference {
  reference_id: string;
  media_type: string;
  file_path: string | null;
  content: string | null;
}

export interface RewriteContext {
  /** slug of a post included in this build, by Lore document id */
  slugOf(id: string): string | undefined;
  /** raw body (frontmatter + title stripped) of a post, by document id */
  bodyOf(id: string): string | undefined;
  /** reference by id */
  refOf(id: string): LoreReference | undefined;
  /** public file URL for a file-backed reference */
  fileUrl(ref: LoreReference): string;
}

const LINK = /(!?)\[{1,2}([^\]]+)\]{1,2}\(([^)]+)\)\]?/g;

export function rewriteLinks(md: string, ctx: RewriteContext): string {
  return md.replace(LINK, (match, bang: string, text: string, target: string) => {
    if (target.startsWith('http') || target.startsWith('#') || target.startsWith('mailto:')) {
      return match;
    }
    if (target.startsWith('note:')) {
      return text;
    }
    if (target.startsWith('ref:')) {
      const ref = ctx.refOf(target.slice(4));
      if (!ref) return text;
      if (bang) {
        if (ref.media_type === 'markdown') return (ref.content ?? '').trim();
        return `![${text}](<${ctx.fileUrl(ref)}>)`;
      }
      if (ref.media_type === 'markdown') return text;
      return `[${text}](<${ctx.fileUrl(ref)}>)`;
    }
    const id = target.replace(/^doc:/, '');
    const slug = ctx.slugOf(id);
    if (slug === undefined) return text;
    if (bang) return (ctx.bodyOf(id) ?? '').trim();
    return `[${text}](/posts/${slug}/)`;
  });
}
