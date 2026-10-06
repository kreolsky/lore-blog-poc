import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDate,
  firstParagraphPlain,
  buildRssItems,
  type RssItemInput,
} from '../src/rss-items.ts';

function post(partial: Partial<RssItemInput>): RssItemInput {
  return {
    slug: 'x',
    title: 'X',
    order: 'a0',
    html: '<p>rendered</p>',
    body: 'Some body text.',
    ...partial,
  };
}

test('date rule: frontmatter date beats created_at', () => {
  assert.equal(
    resolveDate('2024-01-01', '2026-05-05T10:00:00+00:00'),
    '2024-01-01',
  );
});

test('date rule: created_at used when no frontmatter date', () => {
  assert.equal(resolveDate(undefined, '2026-05-05T10:00:00+00:00'), '2026-05-05T10:00:00+00:00');
});

test('date rule: neither yields undefined', () => {
  assert.equal(resolveDate(undefined, null), undefined);
  assert.equal(resolveDate(undefined, undefined), undefined);
});

test('pubDate only when a date exists', () => {
  const items = buildRssItems([
    post({ slug: 'dated', fmDate: '2026-01-01' }),
    post({ slug: 'undated' }),
  ]);
  const bySlug = Object.fromEntries(items.map((i) => [i.link, i]));
  assert.ok(bySlug['/posts/dated/'].pubDate instanceof Date);
  assert.equal(bySlug['/posts/undated/'].pubDate, undefined);
});

test('ordering: dated newest first, undated after them in order', () => {
  const items = buildRssItems([
    post({ slug: 'undated-b', order: 'b0' }),
    post({ slug: 'old', fmDate: '2020-01-01' }),
    post({ slug: 'newest', createdAt: '2026-06-01T00:00:00+00:00' }),
    post({ slug: 'undated-a', order: 'a0' }),
    post({ slug: 'middle', fmDate: '2023-01-01' }),
  ]);
  assert.deepEqual(
    items.map((i) => i.link),
    [
      '/posts/newest/',
      '/posts/middle/',
      '/posts/old/',
      '/posts/undated-a/',
      '/posts/undated-b/',
    ],
  );
});

test('description: frontmatter description wins', () => {
  const [item] = buildRssItems([post({ description: 'hand written' })]);
  assert.equal(item.description, 'hand written');
});

test('description: falls back to the first paragraph of the body, plain text', () => {
  const [item] = buildRssItems([
    post({ body: '# heading\n\nFirst **bold** and [link](https://x) text.\n\nSecond paragraph.' }),
  ]);
  assert.equal(item.description, 'First bold and link text.');
});

test('description: first paragraph truncated to 280 chars', () => {
  const long = 'word '.repeat(100);
  const [item] = buildRssItems([post({ body: `${long}\n\nsecond` })]);
  assert.ok(item.description.length <= 281); // 280 + ellipsis
  assert.ok(item.description.endsWith('…'));
});

test('item carries title, link and full rendered html as content', () => {
  const [item] = buildRssItems([post({ slug: 's', title: 'T', html: '<p>full</p>' })]);
  assert.equal(item.title, 'T');
  assert.equal(item.link, '/posts/s/');
  assert.equal(item.content, '<p>full</p>');
});

test('firstParagraphPlain: plain module helper, markdown stripped', () => {
  assert.equal(
    firstParagraphPlain('# h\n\n`code` and ![img](u) and *em*'),
    'code and img and em',
  );
});

test('ordering compares instants, not strings (timezone offsets)', () => {
  // 23:00+03:00 is 20:00Z — EARLIER than 21:00Z, though it sorts later as a string.
  const items = buildRssItems([
    post({ slug: 'plus3', createdAt: '2026-10-05T23:00:00+03:00' }),
    post({ slug: 'utc', createdAt: '2026-10-05T21:00:00+00:00' }),
  ]);
  assert.deepEqual(items.map((i) => i.link), ['/posts/utc/', '/posts/plus3/']);
});

test('ordering: a bare frontmatter date sorts with full timestamps by instant', () => {
  const items = buildRssItems([
    post({ slug: 'day', fmDate: '2026-10-06' }),
    post({ slug: 'evening-before', createdAt: '2026-10-05T22:00:00+00:00' }),
    post({ slug: 'later-that-day', createdAt: '2026-10-06T12:00:00+00:00' }),
  ]);
  assert.deepEqual(
    items.map((i) => i.link),
    ['/posts/later-that-day/', '/posts/day/', '/posts/evening-before/'],
  );
});

test('an unparseable date fails the build naming the post', () => {
  assert.throws(
    () => buildRssItems([post({ slug: 'bad-post', title: 'Плохая дата', fmDate: '1 октября' })]),
    /bad-post.*1 октября|1 октября.*bad-post/,
  );
});
