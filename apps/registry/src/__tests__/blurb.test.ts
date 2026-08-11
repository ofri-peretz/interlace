import { describe, expect, it } from 'vitest';

import { blurbFrom, describeFrom, docBlocks, headerFrom } from '../../blurb.mjs';

/**
 * Unit tests for the extraction that decides what 137 items say they are.
 *
 * `description-lock.test.ts` asserts the OUTPUT is not boilerplate; this file
 * asserts the extraction picks the right prose in the first place. Both are
 * needed: a bug here produces a description that is confidently wrong, which
 * the lock cannot tell from a good one.
 *
 * Every case below is a shape that actually occurs in `packages/ui/src/`.
 */
describe('docBlocks', () => {
  it('does not let one block swallow the next', () => {
    // The ArticleCard bug: a lazy `[\s\S]*?` body anchored past the closing
    // `*/` ran through several comments and the code between them, and the
    // published blurb became `Reaction / like count. */ reactions?: number; …`.
    const src = [
      '/** First block. */',
      'const a = 1;',
      '/** Second block. */',
      'const b = 2;',
    ].join('\n');
    expect(docBlocks(src).map((b) => b.text)).toEqual(['First block.', 'Second block.']);
  });

  it('records the code line each block precedes', () => {
    const src = '/** Doc. */\nexport const Card = () => null;';
    expect(docBlocks(src)[0].follows).toBe('export const Card = () => null;');
  });
});

describe('headerFrom', () => {
  it('accepts a doc comment that precedes the first statement', () => {
    const src = "/**\n * @interlace/ui — Thing\n *\n * What it is.\n */\nimport x from 'y';";
    expect(headerFrom(docBlocks(src), src)).toContain('What it is.');
  });

  it('rejects the first doc comment when it comes AFTER a statement', () => {
    // `badge.tsx` opens with `'use client'` then imports, and its first doc
    // comment documents a prop. Treating that as the header is how Card once
    // described itself as "When true, render a Skeleton composite".
    const src = ["import * as React from 'react';", '/** When true, render a Skeleton. */', 'loading?: boolean;'].join('\n');
    expect(headerFrom(docBlocks(src), src)).toBeNull();
  });
});

describe('blurbFrom', () => {
  it('skips the @interlace/ui title line and returns the first paragraph', () => {
    const text = '@interlace/ui — Toggle\n\nA two-state button.\nGrouped or not.\n\n## Anatomy\n\nToggle';
    expect(blurbFrom(text, 'FALLBACK')).toBe('A two-state button. Grouped or not.');
  });

  it('stops at a heading rather than absorbing the Anatomy block', () => {
    const text = '@interlace/ui — X\n\nThe summary.\n## Anatomy\ntree';
    expect(blurbFrom(text, 'FALLBACK')).toBe('The summary.');
  });

  it('stops at a table row rather than publishing the R-rule table', () => {
    const text = '@interlace/ui — X\n\nThe summary.\n| Rule | Concept |';
    expect(blurbFrom(text, 'FALLBACK')).toBe('The summary.');
  });

  it('falls back when there is no prose at all', () => {
    expect(blurbFrom('@interlace/ui — X\n\n## Anatomy\n', 'FALLBACK')).toBe('FALLBACK');
    expect(blurbFrom(null, 'FALLBACK')).toBe('FALLBACK');
  });

  it('truncates on a word boundary, not mid-word', () => {
    const long = `@interlace/ui — X\n\n${'word '.repeat(80).trim()}`;
    const out = blurbFrom(long, 'FALLBACK');
    expect(out.length).toBeLessThanOrEqual(261);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/wor…$/);
  });
});

describe('describeFrom', () => {
  it('prefers the file header over a later export doc', () => {
    const src = [
      '/**',
      ' * @interlace/ui — Card',
      ' *',
      ' * The header sentence.',
      ' */',
      "import * as React from 'react';",
      '/** The export sentence. */',
      'export const Card = () => null;',
    ].join('\n');
    expect(describeFrom(src, 'card', 'FALLBACK')).toBe('The header sentence.');
  });

  it("falls back to the component export's own doc when there is no header", () => {
    const src = [
      "import * as React from 'react';",
      '/** The export sentence, which is long enough to be a real summary. */',
      'export const Card = () => null;',
    ].join('\n');
    expect(describeFrom(src, 'card', 'FALLBACK')).toContain('The export sentence');
  });

  it('matches the export by name, so a prop doc can never win', () => {
    const src = [
      "import * as React from 'react';",
      '/** When true, render a Skeleton composite instead of the real thing. */',
      'loading?: boolean;',
      '/** A card. Groups related content on one surface with a border. */',
      'export const Card = () => null;',
    ].join('\n');
    expect(describeFrom(src, 'card', 'FALLBACK')).toContain('Groups related content');
  });

  it('returns the caller fallback for a file with no prose', () => {
    expect(describeFrom("import x from 'y';\nexport const A = 1;", 'a', 'FALLBACK')).toBe(
      'FALLBACK',
    );
  });
});
