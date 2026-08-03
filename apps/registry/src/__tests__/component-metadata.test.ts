import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  extractA11yNotes,
  extractPropsTables,
  extractVariants,
} from '@/lib/component-metadata';

/**
 * The props table and the a11y notes are the two things on a component page a
 * consumer will actually trust — and both are regex-parsed out of source. These
 * lock the parse against the REAL shipped sources (via the registry JSON), so a
 * refactor in `packages/ui` that silently empties a page's API table fails here.
 */

// Anchored on this file, not cwd — so the suite passes whether it's run from
// the workspace (`npm test`) or the repo root (`vitest --root apps/registry`).
const R = join(dirname(fileURLToPath(import.meta.url)), '../../public/r');

/** Mirrors `loadEnrichedItem`: metadata reads EVERY file the item ships. */
const sourceOf = async (name: string) => {
  const item = JSON.parse(await readFile(join(R, `${name}.json`), 'utf8'));
  return (item.files as Array<{ content: string }>)
    .map((f) => f.content)
    .join('\n');
};

describe('extractPropsTables', () => {
  it('reads own props, the DOM element, and the cva composition', async () => {
    const tables = extractPropsTables(await sourceOf('badge'));
    const badge = tables.find((t) => t.typeName === 'BadgeProps');

    expect(badge).toBeDefined();
    expect(badge!.extendsElement).toBe('span');
    expect(badge!.hasVariantProps).toBe(true);

    const loading = badge!.props.find((p) => p.name === 'loading');
    expect(loading).toMatchObject({ type: 'boolean', required: false });
    // The doc comment is the whole point — a table of bare names is noise.
    expect(loading!.description).toMatch(/Skeleton/i);
  });

  it('finds a props table for the large majority of shipped components', async () => {
    const index = JSON.parse(await readFile(join(R, 'index.json'), 'utf8'));
    const components = index.items.filter(
      (i: { name: string; meta?: { tier: string } }) =>
        (i.meta?.tier === 'primitive' || i.meta?.tier === 'pattern') &&
        // `*-variants` items are cva definitions, not components — they export
        // a class-name builder and have no props interface by construction, so
        // they belong in neither side of this ratio.
        !i.name.endsWith('-variants'),
    );
    const withTable: string[] = [];
    for (const item of components) {
      const tables = extractPropsTables(await sourceOf(item.name));
      if (tables.some((t) => t.props.length > 0)) withTable.push(item.name);
    }
    // Ratchet, not a fixed list: if a parser change drops coverage, this fails.
    expect(withTable.length / components.length).toBeGreaterThan(0.8);
  });
});

describe('extractVariants', () => {
  it('reads every option and the default', async () => {
    const variants = extractVariants(await sourceOf('badge'));
    const variant = variants.find((v) => v.name === 'variant');
    expect(variant?.options).toContain('destructive');
    expect(variant?.defaultValue).toBe('default');
  });

  it('reads a cva that lives in a companion file', async () => {
    // `button.tsx` imports its cva from `button-variants.ts`; both ship in the
    // item, and reading only the first file showed the page zero variants.
    const variants = extractVariants(await sourceOf('button'));
    expect(variants.length).toBeGreaterThan(0);
  });

  it('handles several variant groups in one cva', async () => {
    const names = extractVariants(await sourceOf('typography')).map(
      (v) => v.name,
    );
    expect(names).toEqual(expect.arrayContaining(['variant', 'tone']));
  });

  it('is not blinded by a comment between two options', () => {
    // The primitives carry rationale comments inside their cva blocks (badge's
    // `destructive` explains why it drops shadcn's dark tint). Options are
    // anchored on the preceding comma, so a comment used to hide the option
    // after it — badge silently lost `destructive`, `outline`, `ghost`, `link`.
    const source = `const v = cva('', {
      variants: {
        variant: {
          default: 'a',
          // a rationale comment, the kind our primitives actually carry
          destructive: 'b',
          /* and a block one */
          outline: 'c',
        },
      },
      defaultVariants: { variant: 'default' },
    });`;
    expect(extractVariants(source)[0].options).toEqual([
      'default',
      'destructive',
      'outline',
    ]);
  });

  it('returns nothing when there is no cva', () => {
    expect(extractVariants('export const x = 1;')).toEqual([]);
  });
});

describe('extractA11yNotes', () => {
  it('reports the focus-ring contract and reduced-motion gating', async () => {
    const notes = extractA11yNotes(await sourceOf('badge'));
    expect(notes.hasFocusRing).toBe(true);
  });

  it('names the Base UI primitive that owns focus + dismissal', async () => {
    const notes = extractA11yNotes(await sourceOf('dialog'));
    expect(notes.baseUi).toBeTruthy();
  });

  it('does not invent aria attributes or roles', async () => {
    const source = "const x = <span className='p-2' />;";
    const notes = extractA11yNotes(source);
    expect(notes.ariaAttributes).toEqual([]);
    expect(notes.roles).toEqual([]);
    expect(notes.respectsReducedMotion).toBe(false);
  });
});
