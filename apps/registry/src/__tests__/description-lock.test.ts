import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const R_DIR = path.join(process.cwd(), 'public', 'r');

const loadAll = async () => {
  const names = (
    JSON.parse(await readFile(path.join(R_DIR, 'index.json'), 'utf8')) as {
      items: { name: string }[];
    }
  ).items.map((i) => i.name);
  return Promise.all(
    names.map(async (name) =>
      JSON.parse(
        await readFile(path.join(R_DIR, `${name}.json`), 'utf8'),
      ) as { name: string; title: string; description: string },
    ),
  );
};

/**
 * `description` is the sentence four different surfaces show, and it was empty
 * on 93% of the catalogue.
 *
 * It is what `shadcn add` prints in the adopter's terminal, what the shadcn
 * directory lists us under, what every card on the storefront shows, and what
 * an agent reads out of `agent-index.json` when it is choosing between two
 * components. For 128 of 137 items all four said `"@interlace/ui — accordion
 * (shadcn-compatible)."` — the item's own name, restated, plus a compatibility
 * claim.
 *
 * `blurb.mjs` now derives it from the component's file header, which is the
 * only copy of that sentence a maintainer actually edits when the component
 * changes. This lock is what stops it regressing, and the regression it guards
 * against is not "someone deletes the derivation" — it is "someone adds a
 * component without a header", which is how all 128 got there in the first
 * place. That failure is silent: the build passes, the item installs, and the
 * only symptom is a card that says nothing.
 */
describe('every item describes itself', () => {
  it('never falls back to the generated boilerplate', async () => {
    const items = await loadAll();
    const boilerplate = items.filter((i) =>
      /\(shadcn-compatible\)\.$/.test(i.description ?? ''),
    );
    expect(
      boilerplate.map((i) => i.name),
      'these components have no prose to derive a description from — write a file header (see packages/ui/src/primitives/toggle.tsx)',
    ).toEqual([]);
  });

  it('says something the name does not already say', async () => {
    const items = await loadAll();
    // A description that is just the title, or the title plus a few words, is
    // the boilerplate wearing different clothes. Six words is the floor at
    // which a sentence can carry a fact.
    const thin = (await Promise.all(items)).filter((i) => {
      const words = (i.description ?? '').trim().split(/\s+/).filter(Boolean);
      return words.length < 6;
    });
    expect(thin.map((i) => `${i.name}: ${i.description}`)).toEqual([]);
  });

  it('is prose, not a heading or a table row that leaked out of the header', async () => {
    const items = await loadAll();
    // The extraction walks a Markdown-ish doc comment, so the way it fails is
    // by picking up structure instead of a sentence. `@interlace/ui — …` is
    // NOT in this list: the five `registry:lib` items open that way by
    // convention and their descriptions are hand-written and good.
    const malformed = items.filter((i) => {
      const d = (i.description ?? '').trim();
      return d.startsWith('|') || d.startsWith('#');
    });
    expect(malformed.map((i) => `${i.name}: ${i.description}`)).toEqual([]);
  });
});
