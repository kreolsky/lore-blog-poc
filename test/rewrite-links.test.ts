import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteLinks, type LoreReference, type RewriteContext } from '../src/rewrite-links.ts';
import { extractFrontmatter, isPublished } from '../src/frontmatter.ts';

const POST_A = '11111111-1111-1111-1111-111111111111';
const POST_B = '22222222-2222-2222-2222-222222222222';
const OUTSIDE = '99999999-9999-9999-9999-999999999999';
const MD_REF = 'aaaa0000-0000-0000-0000-00000000000a';
const FILE_REF = 'bbbb0000-0000-0000-0000-00000000000b';
const LORE = 'https://lore.example';

const mdRef: LoreReference = { reference_id: MD_REF, media_type: 'markdown', file_path: null, content: 'inlined ref text' };
const fileRef: LoreReference = { reference_id: FILE_REF, media_type: 'image', file_path: 'docs/pic my image.png', content: null };
const fileUrl = `${LORE}/api/public/documents/ROOT/files/${FILE_REF}/pic%20my%20image.png`;

function makeCtx(): RewriteContext {
  return {
    slugOf: (id) => (id === POST_A ? 'post-a' : id === POST_B ? 'post-b' : undefined),
    bodyOf: (id) => (id === POST_B ? 'Body of B.' : undefined),
    refOf: (id) => (id === MD_REF ? mdRef : id === FILE_REF ? fileRef : undefined),
    fileUrl: () => fileUrl,
  };
}

test('doc: link to a post in the build becomes /posts/<slug>', () => {
  assert.equal(rewriteLinks('see [t](doc:' + POST_A + ')', makeCtx()), 'see [t](/posts/post-a/)');
});

test('doc: link outside the build becomes plain text', () => {
  assert.equal(rewriteLinks('see [t](doc:' + OUTSIDE + ')', makeCtx()), 'see t');
});

test('bare uuid link resolves like doc:', () => {
  assert.equal(rewriteLinks('see [t](' + POST_A + ')', makeCtx()), 'see [t](/posts/post-a/)');
});

test('double brackets [[x]](doc:ID) are handled', () => {
  assert.equal(rewriteLinks('see [[x]](doc:' + POST_A + ')', makeCtx()), 'see [x](/posts/post-a/)');
});

test('note: link becomes plain text', () => {
  assert.equal(rewriteLinks('see [t](note:' + POST_A + ')', makeCtx()), 'see t');
});

test('![a](ref:ID) with a markdown reference inlines its content', () => {
  assert.equal(rewriteLinks('see ![a](ref:' + MD_REF + ')', makeCtx()), 'see inlined ref text');
});

test('![a](ref:ID) with a file reference becomes the public file URL with basename', () => {
  assert.equal(
    rewriteLinks('see ![a](ref:' + FILE_REF + ')', makeCtx()),
    'see ![a](<' + fileUrl + '>)',
  );
});

test('[t](ref:ID) non-embed links the file, markdown ref degrades to text', () => {
  const ctx = makeCtx();
  assert.equal(rewriteLinks('see [t](ref:' + FILE_REF + ')', ctx), 'see [t](<' + fileUrl + '>)');
  assert.equal(rewriteLinks('see [t](ref:' + MD_REF + ')', ctx), 'see t');
});

test('![a](doc:ID) embeds the target body; outside the build degrades to alt text', () => {
  const ctx = makeCtx();
  assert.equal(rewriteLinks('see ![a](doc:' + POST_B + ')', ctx), 'see Body of B.');
  assert.equal(rewriteLinks('see ![a](doc:' + OUTSIDE + ')', ctx), 'see a');
});

test('http links and #anchors are untouched', () => {
  const ctx = makeCtx();
  const http = 'see [t](https://example.com/x) and [t](http://example.com/y)';
  assert.equal(rewriteLinks(http, ctx), http);
  const anchor = 'see [t](#section)';
  assert.equal(rewriteLinks(anchor, ctx), anchor);
});

test('status filter: draft excluded, published included, no frontmatter included', () => {
  assert.equal(isPublished({ status: 'draft' }), false);
  assert.equal(isPublished({ status: 'published' }), true);
  assert.equal(isPublished({}), true);
});

test('extractFrontmatter splits frontmatter from the body', () => {
  const { fm, body } = extractFrontmatter('---\nstatus: draft\ntags: [a, b]\n---\n\n# Title\n\nBody');
  assert.equal(fm.status, 'draft');
  assert.deepEqual(fm.tags, ['a', 'b']);
  assert.equal(body, '\n# Title\n\nBody');
  const plain = extractFrontmatter('# Title\n\nBody');
  assert.deepEqual(plain.fm, {});
  assert.equal(plain.body, '# Title\n\nBody');
});
