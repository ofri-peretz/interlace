#!/usr/bin/env node
/**
 * Project the concept docs into `public/data/concepts.json`.
 *
 * The seven concept pages live in `apps/storybook/src/stories/concepts/*.mdx`
 * and are authored there. Storybook is where a maintainer reads them; the
 * registry is where a BUYER lands, and until now the buyer could not see a
 * word of the doctrine that makes this system different.
 *
 * DERIVED, not forked (the alternative was a `/concepts` page of links, which
 * puts the argument one click behind the decision it is meant to inform). The
 * MDX stays the single authority: this script parses it into blocks and the
 * registry renders those blocks. Nothing is retyped, so there is no second copy
 * to keep in sync — and `--check` fails the build if the JSON drifts from the
 * MDX, which is the property a fork can never have.
 *
 * The ONE thing that is not derived is the live JSX demo. Nine `<div>` demo
 * blocks across the seven files mount real `@interlace/ui` components; copying
 * them here would fork the demo (two renders that can disagree) and is exactly
 * what the DS's own "one source" doctrine forbids. Each is rendered as a
 * labelled link into the Storybook page that runs it.
 *
 * Output shape: a flat block list per page — heading / paragraph / code / list
 * / table / rule / demo. A block list rather than an HTML string because the
 * registry styles these with its own tokens, and because `dangerouslySetInner
 * HTML` over content assembled by a regex is not a thing to ship.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(REGISTRY_ROOT, '..', '..');
const CONCEPTS_DIR = path.join(
  REPO_ROOT,
  'apps/storybook/src/stories/concepts',
);
const OUT_FILE = path.join(REGISTRY_ROOT, 'public/data/concepts.json');

const CHECK_ONLY = process.argv.includes('--check');
const rel = (p) => path.relative(REPO_ROOT, p);

const fail = (message) => {
  throw new Error(`build-concepts: ${message}`);
};

/** Storybook's `sanitize` — lowercase, non-alphanumerics collapsed to `-`. */
const sanitize = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const META_RE = /<Meta\s+title=["']([^"']+)["']\s*\/>/;

/** `| a | b |` → `['a', 'b']`, tolerating a missing leading/trailing pipe. */
const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isDivider = (line) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(line.trim());

/**
 * Parse an MDX body into blocks.
 *
 * Line-based on purpose. A real MDX compiler would give a richer tree and a
 * much larger surface for "produced something plausible from something broken";
 * every construct below either matches exactly or falls through to a paragraph,
 * and the `--check` gate catches the day that stops being good enough.
 */
const parseBlocks = (body, storybookId) => {
  const lines = body.split('\n');
  const blocks = [];
  const seenIds = new Map();

  const headingId = (text) => {
    const base = sanitize(text) || 'section';
    const n = (seenIds.get(base) ?? 0) + 1;
    seenIds.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // ─── fenced code ─────────────────────────────────────────────────────
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      const lang = fence[1] || null;
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      if (i >= lines.length) fail('unterminated code fence');
      i++; // closing fence
      blocks.push({ type: 'code', lang, code: code.join('\n') });
      continue;
    }

    // ─── live demo (a JSX island that mounts real components) ────────────
    if (/^<div\b/.test(line)) {
      const start = i;
      while (i < lines.length && !/^<\/div>/.test(lines[i])) i++;
      if (i >= lines.length) {
        fail(`unterminated <div> demo starting at line ${start + 1}`);
      }
      i++; // closing tag
      blocks.push({ type: 'demo', storybookId });
      continue;
    }

    // ─── heading ─────────────────────────────────────────────────────────
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({
        type: 'heading',
        depth: heading[1].length,
        text,
        id: headingId(text),
      });
      i++;
      continue;
    }

    // ─── horizontal rule ─────────────────────────────────────────────────
    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }

    // ─── blockquote ──────────────────────────────────────────────────────
    // 14 of them across the seven files, and every one is a load-bearing
    // statement of the rule the section is about. Parsed as paragraphs they
    // rendered with a literal "> " in front.
    if (/^>\s?/.test(line)) {
      const quoted = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, '').trim());
        i++;
      }
      blocks.push({ type: 'quote', text: quoted.join(' ').trim() });
      continue;
    }

    // ─── table ───────────────────────────────────────────────────────────
    if (/^\|/.test(line) && isDivider(lines[i + 1] ?? '')) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    // ─── list ────────────────────────────────────────────────────────────
    const bullet = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) {
          items.push({ depth: Math.floor(m[1].length / 2), text: m[3].trim() });
          i++;
          continue;
        }
        // A wrapped continuation line belongs to the item above it.
        if (/^\s+\S/.test(lines[i]) && items.length > 0) {
          items[items.length - 1].text += ` ${lines[i].trim()}`;
          i++;
          continue;
        }
        break;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // ─── paragraph ───────────────────────────────────────────────────────
    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4}\s|```|\||---+\s*$|<div\b|>\s?|\s*([-*]|\d+\.)\s)/.test(
        lines[i],
      )
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      continue;
    }
    // Nothing matched and nothing consumed — bail rather than spin.
    fail(`could not classify line ${i + 1}: ${JSON.stringify(line)}`);
  }

  return blocks;
};

/** Strip the inline markdown a lead sentence may carry. */
const plain = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1');

/**
 * MDX is JSX, so the authors write `&amp;` where they mean `&`. JSX decodes it
 * on render; a JSON block list has no such step, so it is decoded here — the
 * alternative is a page that literally says "Color &amp; theming".
 */
const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};
const decode = (text) =>
  text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m]);

/**
 * Rewrite Storybook's own `?path=/docs/<id>` links.
 *
 * Inside Storybook those are relative and work; pasted onto ds.interlace.tools
 * they resolve to `/concepts/?path=…` and 404. A link whose target is one of
 * these seven pages becomes the registry route; anything else becomes an
 * absolute link into the deployed Storybook rather than a dead relative one.
 */
const STORYBOOK_URL = 'https://storybook.interlace.tools';
const rewriteLinks = (text, slugByStoryId) =>
  text.replace(/\((\?path=\/docs\/([a-z0-9-]+(?:--[a-z0-9-]+)?))\)/g, (_m, _q, id) => {
    const slug = slugByStoryId.get(id);
    return slug ? `(/concepts/${slug})` : `(${STORYBOOK_URL}/?path=/docs/${id})`;
  });

/** Walk every string a block carries, in place. */
const mapBlockText = (block, fn) => {
  if (
    block.type === 'paragraph' ||
    block.type === 'heading' ||
    block.type === 'quote'
  ) {
    block.text = fn(block.text);
  } else if (block.type === 'list') {
    for (const item of block.items) item.text = fn(item.text);
  } else if (block.type === 'table') {
    block.head = block.head.map(fn);
    block.rows = block.rows.map((row) => row.map(fn));
  }
  // `code` is deliberately untouched — an entity inside a fence is literal.
};

export const buildConcepts = async () => {
  const files = (await readdir(CONCEPTS_DIR))
    .filter((f) => f.endsWith('.mdx'))
    .sort();
  if (files.length === 0) fail(`no .mdx files in ${rel(CONCEPTS_DIR)}`);

  const pages = [];
  for (const file of files) {
    // eslint-disable-next-line node-security/no-zip-slip
    const full = path.join(CONCEPTS_DIR, file);
    const raw = await readFile(full, 'utf8');

    const meta = META_RE.exec(raw);
    if (!meta) fail(`no <Meta title> in ${rel(full)}`);
    const storyTitle = meta[1];
    const storybookId = `${sanitize(storyTitle)}--docs`;

    // Everything before and including `<Meta/>` is Storybook wiring: the
    // component imports the demos need and the title. Neither is content.
    const body = raw.slice(meta.index + meta[0].length);

    const blocks = parseBlocks(body, storybookId);
    const h1 = blocks.find((b) => b.type === 'heading' && b.depth === 1);
    if (!h1) fail(`no H1 in ${rel(full)}`);

    // The lead is card copy and a meta description, so it has to stand alone.
    // Four of the seven pages open with a colon-terminated fragment ("Two
    // ideas carry this whole section:") that introduces a list — true to the
    // page, useless out of context. Take the first paragraph that is a
    // sentence, and fall back to the first paragraph if none is.
    const paragraphs = blocks.filter(
      (b) => b.type === 'paragraph' || b.type === 'quote',
    );
    const lead =
      paragraphs.find((p) => p.text.length >= 80 && !p.text.endsWith(':')) ??
      paragraphs[0];

    // `Concepts/Color & Theming` → `color-theming`; `Concepts` → `overview`.
    const slug =
      storyTitle === 'Concepts'
        ? 'overview'
        : sanitize(storyTitle.replace(/^Concepts\//, ''));

    pages.push({
      slug,
      title: decode(h1.text),
      storyTitle,
      storybookId,
      file: rel(full),
      lead: lead ? plain(decode(lead.text)) : '',
      // The H1 is the page title, rendered by the route — keeping it in the
      // block list too would print it twice.
      blocks: blocks.filter((b) => b !== h1),
    });
  }

  // Cross-page links are only resolvable once every page's id is known.
  const slugByStoryId = new Map(pages.map((p) => [p.storybookId, p.slug]));
  for (const page of pages) {
    for (const block of page.blocks) {
      mapBlockText(block, (text) => rewriteLinks(decode(text), slugByStoryId));
    }
    page.headings = page.blocks
      .filter((b) => b.type === 'heading' && b.depth === 2)
      .map(({ id, text }) => ({ id, text: plain(text) }));
  }

  // Overview first — it is the page that frames the other six.
  pages.sort((a, b) =>
    a.slug === 'overview' ? -1 : b.slug === 'overview' ? 1 : 0,
  );

  return {
    generatedAt: new Date().toISOString(),
    source: rel(CONCEPTS_DIR),
    pages,
  };
};

const withoutTimestamp = (doc) => {
  const { generatedAt: _generatedAt, ...rest } = doc;
  return JSON.stringify(rest, null, 2);
};

const main = async () => {
  const doc = await buildConcepts();

  if (CHECK_ONLY) {
    let existing;
    try {
      existing = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    } catch {
      console.error(
        `build-concepts --check: ${rel(OUT_FILE)} is missing. Run ` +
          '`node scripts/build-concepts.mjs`.',
      );
      process.exit(1);
    }
    if (withoutTimestamp(existing) !== withoutTimestamp(doc)) {
      console.error(
        `build-concepts --check: ${rel(OUT_FILE)} is stale — the concept MDX ` +
          'changed since it was generated. Run `node scripts/build-concepts.mjs` ' +
          'and commit the result.',
      );
      process.exit(1);
    }
    console.log('build-concepts --check: up to date');
    return;
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  const blocks = doc.pages.reduce((n, p) => n + p.blocks.length, 0);
  console.log(
    `build-concepts: ${doc.pages.length} pages, ${blocks} blocks → ${rel(OUT_FILE)}`,
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
