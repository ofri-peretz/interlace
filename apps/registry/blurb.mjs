/**
 * The one-sentence "what is this for" line, read off the component's own prose.
 *
 * ─── The defect this closes ───────────────────────────────────────────────
 *
 * 128 of 137 items shipped `description: "@interlace/ui — accordion
 * (shadcn-compatible)."` — a sentence that names the item and then says
 * nothing. That field is not decoration. It is what `shadcn add` prints in the
 * adopter's terminal, what the shadcn directory lists us under, what every card
 * on the storefront shows, and what an agent reads when it is choosing between
 * two components. For 93% of the catalogue all four of those surfaces said the
 * same empty thing.
 *
 * The prose already existed. Every component opens with a header explaining
 * exactly what it is — Toggle's says "a two-state button (pressed /
 * not-pressed) and a grouped form thereof" — and `build-agent-surface.mjs` was
 * already extracting it, under the name `blurb`, into `agent-index.json`. So
 * the good sentence was being computed and then published to the one surface
 * an adopter never looks at, while the item they DO see kept the boilerplate.
 *
 * This module is that extraction, moved to where both generators can call it.
 * `build-registry.mjs` now sets `description` from it, and
 * `build-agent-surface.mjs` reads `description` back rather than deriving its
 * own — so the terminal, the directory, the storefront and the agent index all
 * say the same sentence, and there is exactly one place that decides what it
 * is.
 *
 * ─── Why derived and not authored ─────────────────────────────────────────
 *
 * 137 hand-written descriptions is a list that is wrong within a month, and it
 * re-states what the component's header already says — so the two drift and a
 * reader has no way to know which is current. The header is the source of
 * truth because it is the thing a maintainer actually edits when the component
 * changes.
 */

/** Strip JSDoc `*` gutters and normalise blank lines. */
export const stripJsdoc = (s) =>
  s
    .replace(/^[ \t]*\*[ \t]?/gm, '')
    .replace(/\r/g, '')
    .trim();

/**
 * Every `/** … *\/` block in the source, with the code line that follows it.
 *
 * `[\s\S]*?` is NOT good enough for the body: anchored to something after the
 * closing `*\/`, a lazy any-char run happily swallows several comments and the
 * code between them — which is how ArticleCard's blurb once became the literal
 * text `Reaction / like count. *\/ reactions?: number; …`.
 * `(?:[^*]|\*(?!\/))*` cannot cross a comment boundary.
 */
const DOC_BLOCK_RE = /\/\*\*((?:[^*]|\*(?!\/))*)\*\/[ \t]*\n?([^\n]*)/g;

export const docBlocks = (src) =>
  [...src.matchAll(DOC_BLOCK_RE)].map((m) => ({
    text: stripJsdoc(m[1]),
    follows: m[2],
    index: m.index,
  }));

/**
 * The FILE header, if this component has one.
 *
 * Not simply "the first doc comment": 59 of 137 items have no header at all
 * (`badge.tsx` opens with `'use client'` and goes straight to imports), and for
 * those the first doc comment is a prop's — which is how an early version of
 * this decided that Card was "When true, render a Skeleton composite".
 * A header is a doc comment that precedes the first statement in the file.
 */
const PROLOGUE_RE = /^[ \t]*(?:import|export|const|function|type|interface|class)\s/m;

export const headerFrom = (blocks, src) => {
  const first = blocks[0];
  if (!first) return null;
  const firstStatement = src.search(PROLOGUE_RE);
  return firstStatement === -1 || first.index < firstStatement ? first.text : null;
};

/** PascalCase name this item's main export is expected to carry. */
const pascal = (name) =>
  name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

/**
 * The doc comment attached to the component's own export, for the items that
 * document there instead of at the top of the file. Matched on the export NAME
 * so a `loading?: boolean` prop doc can never be mistaken for the component's.
 */
export const exportDocFrom = (blocks, name) => {
  const want = pascal(name).toLowerCase();
  for (const block of blocks) {
    const exported = /^\s*export\s+(?:const|function)\s+([A-Z]\w*)/.exec(block.follows);
    if (exported && exported[1].toLowerCase() === want) return block.text;
  }
  return null;
};

/**
 * Last resort: the first doc comment that documents a DECLARATION rather than a
 * prop.
 *
 * The discriminator is what follows the comment. `loading?: boolean;` is an
 * object member — its doc describes one prop and reads as nonsense as a
 * component summary ("When true, render a Skeleton composite…"). A comment
 * followed by `const containerVariants = cva(` or `function Card(` is about the
 * component, and for the two dozen items with no file header it is the only
 * prose anyone wrote.
 */
const MEMBER_FOLLOWER_RE = /^\s*\w+\??\s*:/;
/** Boilerplate opener on every `MIN_VIEWPORT` doc; the sentence after it is the real one. */
const MIN_VIEWPORT_PREAMBLE = /^Minimum viable viewport \(CSS px\)[^.]*\.\s*/;

export const declarationDocFrom = (blocks) => {
  for (const block of blocks) {
    if (MEMBER_FOLLOWER_RE.test(block.follows)) continue;
    const text = block.text.replace(MIN_VIEWPORT_PREAMBLE, '');
    if (text.length >= 40) return text;
  }
  return null;
};

/**
 * The first real prose PARAGRAPH of a doc comment, flattened to one line.
 *
 * Stops at the first heading, table row or blank line, because everything after
 * that is the Anatomy block and the R-rule table — structure, not a sentence.
 */
export const blurbFrom = (text, fallback) => {
  if (!text) return fallback;
  const para = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    // Skip the `@interlace/ui — Name` title line and anything before real prose.
    if (para.length === 0) {
      if (!line) continue;
      if (/^@interlace\//.test(line)) continue;
      if (/^#{1,6}\s/.test(line)) continue;
      if (/^\|/.test(line)) continue;
    }
    if (!line) {
      if (para.length) break;
      continue;
    }
    if (/^#{1,6}\s/.test(line) || /^\|/.test(line)) break;
    para.push(line);
  }
  const prose = para.join(' ').replace(/\s+/g, ' ').trim();
  if (!prose) return fallback;
  return prose.length > 260
    ? `${prose.slice(0, 257).replace(/[\s,;:]+\S*$/, '')}…`
    : prose;
};

/**
 * The published description for one item's source, in descending order of
 * authority: file header → the component export's own doc → any declaration's
 * doc → the caller's boilerplate.
 *
 * `fallback` is required rather than defaulted: the eight items with no prose
 * at all still need a valid `description`, and what that says is the caller's
 * business (a lib util and a primitive word it differently).
 */
export const describeFrom = (src, name, fallback) => {
  const blocks = docBlocks(src);
  return blurbFrom(
    headerFrom(blocks, src) ?? exportDocFrom(blocks, name) ?? declarationDocFrom(blocks),
    fallback,
  );
};
