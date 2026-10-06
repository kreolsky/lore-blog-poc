# lore-blog-poc

A static blog built with [Astro](https://astro.build) from a [Lore](https://github.com/kreolsky/lore-knowledge-creator) subtree that is published for anonymous reading.

You write in Lore. At build time Astro pulls every published document through Lore's public read-only API and turns it into plain HTML pages plus an RSS feed. The running site needs neither Lore nor a server: it is a folder of static files.

This is a proof of concept. It answers one question: is "a blog written in Lore" worth building properly?

## How it works

```
Lore subtree (shared publicly)
        │  anonymous GET, build time only
        ▼
src/lore-loader.ts ── tree + documents + references
        │  frontmatter, link rewriting, dates
        ▼
Astro content collection "lore"
        │
        ▼
dist/  index.html · posts/<slug>/index.html · rss.xml
```

The loader reads four public endpoints and nothing else:

| Endpoint | Used for |
|---|---|
| `GET /api/public/documents/{root}/tree` | Document structure, titles, order, `created_at` / `updated_at` |
| `GET /api/public/documents/{id}` | Document body (markdown) |
| `GET /api/public/documents/{root}/references` | Attached files and text references |
| `GET /api/public/documents/{root}/files/{ref}/{name}` | File URLs for images and downloads |

No token and no write access are involved. Anything the build can read, anyone holding the public link can read too.

## Quick start

Requirements: Node.js 23.6 or newer (the tests run TypeScript directly; built and tested on Node 25).

```sh
git clone https://github.com/kreolsky/lore-blog-poc.git
cd lore-blog-poc
npm install
cp .env.example .env      # then edit it, see below
npm run build             # fetches from Lore, writes dist/
npm run preview           # serves dist/ at http://localhost:4321
```

## Configuration

All three variables are required. A missing one stops the build with a message naming it. Values come from the process environment first, then from `.env`.

| Variable | Meaning | Example |
|---|---|---|
| `LORE_URL` | Base URL of the Lore instance | `https://lore.nnp.space` |
| `LORE_ROOT` | Id of the document whose subtree is the blog | `f4645829-3613-4eb8-8bb4-13f83594a225` |
| `SITE_URL` | Public URL of the blog itself; RSS links must be absolute | `https://blog.example.com` |

Environment variables override `.env`, so one checkout can build several blogs:

```sh
LORE_ROOT=<another-root-id> SITE_URL=https://other.example.com npm run build
```

## How to publish a blog from Lore

1. In Lore, create a document that will be the blog's root. Its own text is not shown anywhere; it only holds the posts.
2. Put posts under it as child documents. A document with text becomes a post.
3. To group posts, create an empty document under the root and put posts inside it. An empty document with children becomes a category; its title is the category heading on the index page.
4. Open the root document's Access settings and create a public link with the subtree scope. Everything under the root becomes readable without login.
5. Copy the root document's id from its URL (`/docs/<id>`) into `LORE_ROOT`.
6. Run `npm run build`.

Posts appear in the same order as in the Lore document tree. Only one level of categories is used: a post's category is its direct parent, unless that parent is the root.

## How to control a post

Add an optional YAML block at the very top of the document:

```yaml
---
status: published
slug: why-coop-games-work
date: 2026-10-01
tags: [game design, coop]
description: One or two sentences shown in the RSS feed.
---

# Post title

Text…
```

| Field | Effect | When absent |
|---|---|---|
| `status` | Anything other than `published` keeps the post out of the build | Post is published |
| `slug` | URL becomes `/posts/<slug>/` | The Lore document id; stays stable when the post is renamed |
| `date` | Post date, written as `YYYY-MM-DD` | The document's creation date from Lore |
| `tags` | Stored with the post (not rendered yet) | Empty |
| `description` | RSS item description | The first paragraph, plain text, up to 280 characters |

Notes:

- The first `# Heading` of the document is dropped from the body, because the page renders the Lore title itself.
- A block that is not valid YAML, or not a key–value mapping, fails the build.
- A date that cannot be parsed fails the build with the post's slug and title in the message. Use `YYYY-MM-DD`.
- The YAML block is visible in the Lore editor as ordinary text.

### How to keep a draft out of the blog

Set `status: draft` (or any value other than `published`). The build log lists every skipped post.

### How to backdate a post

Set `date:`. It always wins over Lore's creation date.

## Links, images and embeds

Lore's own link syntax is rewritten during the build:

| In Lore | On the blog |
|---|---|
| `[text](doc:ID)` or `[text](ID)` | Link to `/posts/<slug>/` if that document is a published post, otherwise plain `text` |
| `[text](note:…)` | Plain `text`; notes are never published |
| `![alt](ref:ID)` to an image or file | Image or link pointing at Lore's public file URL |
| `![alt](ref:ID)` to a text reference | The reference's text, inlined |
| `![alt](doc:ID)` | The target post's text, inlined one level deep |
| `http…`, `#anchor`, `mailto:` | Unchanged |

Images are not copied into `dist/`. They are loaded from Lore when a reader opens the page, so Lore must stay reachable and the subtree must stay public.

## RSS

The feed is at `/rss.xml` and is linked from every page's `<head>`, so most readers find it from the site URL.

- Dated posts come first, newest first, ordered by the actual instant (timezones included). Undated posts follow in tree order.
- Each item carries the title, an absolute link, the date, a description and the full rendered HTML.
- If Lore does not provide dates and no post has a `date:` field, items have no `pubDate`. Readers still detect new posts by their link.

## How to deploy

Any static host works: GitHub Pages, Cloudflare Pages, Netlify, an nginx folder. The deliverable is `dist/`.

- Set `SITE_URL` to the final public address before building, or RSS links will point at the wrong host.
- There is no rebuild on edit. A change in Lore appears on the site after the next build. The simplest setup is a scheduled CI job, for example hourly, plus a manual "run now" button.
- Keep `.env` out of git (it already is); configure the three variables in the CI environment instead.

## How to verify a build

```sh
npm test                                  # unit tests: link rewriting, frontmatter, dates, RSS
npm run build                             # the log ends with "lore: N posts from …"
python3 -c "import xml.dom.minidom as m; print(len(m.parse('dist/rss.xml').getElementsByTagName('item')))"
```

The post count in the build log and the number of RSS items should match the number of non-empty, non-draft documents in the subtree.

## Project layout

| Path | Role |
|---|---|
| `src/lore-loader.ts` | Fetches the subtree and fills the content collection |
| `src/frontmatter.ts` | YAML block parsing, `status` filter |
| `src/rewrite-links.ts` | Lore link syntax → blog links |
| `src/rss-items.ts` | Feed items: date rule, ordering, descriptions |
| `src/format-date.ts` | The one date formatter used by pages |
| `src/content.config.ts` | Collection schema and environment reading |
| `src/pages/index.astro` | Index: posts grouped by category, with dates |
| `src/pages/posts/[slug].astro` | Post page with date and table of contents |
| `src/pages/rss.xml.ts` | RSS endpoint |
| `test/` | Unit tests (`node --test`) |

## Limitations

- Builds are manual or scheduled; nothing triggers them from Lore.
- Images are hot-linked to Lore, not bundled.
- No tag pages, search, pagination, Atom or JSON Feed.
- Only one level of categories.
- The page text is in Russian (`lang="ru"`, Russian date format, "Содержание" for the table of contents); change it in `src/layouts/Base.astro`, `src/format-date.ts` and `src/pages/posts/[slug].astro`.
