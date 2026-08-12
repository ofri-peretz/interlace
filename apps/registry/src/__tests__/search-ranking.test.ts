import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  prepare,
  queryStems,
  rank,
  stem,
  type SearchIndex,
} from '@/lib/search';
// The generator's own stemmer + tokenizer. Imported, not re-implemented: this
// file's whole job is to prove the two sides agree.
import { stem as generatorStem } from '../../scripts/build-agent-surface.mjs';

/**
 * The search contract.
 *
 * Ranking is the one part of this site where "it looks fine" is not a test:
 * every query returns SOMETHING, and a silently mis-weighted field just
 * reorders the list. So the assertions below are about ORDER — which item beats
 * which, for a question a visitor would actually type — plus the two invariants
 * that can break the whole thing without any visible error:
 *
 *   1. the client stemmer must agree with the one that built the index; and
 *   2. the client must drop exactly the stopwords the indexer dropped.
 *
 * The index under test is the real generated artefact, so a component whose
 * header stops saying what it does fails here rather than in production.
 */

const index = JSON.parse(
  readFileSync(
    join(process.cwd(), 'public/data/search-index.json'),
    'utf8',
  ),
) as SearchIndex;
const prepared = prepare(index);

const names = (query: string, limit = 8) =>
  rank(index, prepared, query)
    .slice(0, limit)
    .map((r) => r.item.name);

describe('stemmer parity with the index generator', () => {
  // Every branch of the stemmer, plus the words the flagship query depends on.
  const words = [
    'measure',
    'measured',
    'measuring',
    'measurement',
    'measurements',
    'metric',
    'metrics',
    'state',
    'states',
    'loading',
    'loads',
    'counted',
    'counting',
    'entries',
    'classes',
    'analysis',
    'status',
    'accessible',
    'keyboard',
    'is',
    'us',
    'be',
    'server',
  ];

  it('produces the same stem on both sides for every branch', () => {
    for (const word of words) {
      expect(`${word} -> ${stem(word)}`).toBe(`${word} -> ${generatorStem(word)}`);
    }
  });

  it('collapses the measure/measured/measurement family', () => {
    const family = ['measure', 'measured', 'measuring', 'measurement'].map(stem);
    expect(new Set(family).size).toBe(1);
  });
});

describe('query preparation', () => {
  it('drops the stopwords the index dropped, and keeps the content words', () => {
    expect(
      queryStems(index, 'a component for showing a metric that might not have been measured'),
    ).toEqual(['show', 'metric', 'measur']);
  });

  it('returns nothing for an all-stopword query rather than matching everything', () => {
    expect(queryStems(index, 'the one that I want')).toEqual([]);
  });
});

describe('ranking — a name you already know', () => {
  it('puts the exact item first, ahead of items that merely contain the word', () => {
    expect(names('button')[0]).toBe('button');
  });

  it('finds an item from a prefix, before the stemmer has anything to say', () => {
    expect(names('accord')).toContain('accordion');
  });

  it('is stable: the same query twice gives the same order', () => {
    expect(names('empty list')).toEqual(names('empty list'));
  });
});

describe('ranking — a question, not a name', () => {
  it('"empty state when a list has no rows" leads with EmptyState', () => {
    expect(names('empty state when a list has no rows')[0]).toBe('empty-state');
  });

  it('"loading placeholder" leads with Skeleton', () => {
    expect(names('loading placeholder')[0]).toBe('skeleton');
  });

  it('"menu that works from the keyboard" surfaces both menus above everything else', () => {
    expect(names('menu that works from the keyboard').slice(0, 2).sort()).toEqual([
      'context-menu',
      'dropdown-menu',
    ]);
  });

  it('reaches the absence vocabulary from a metric question', () => {
    // The point of the whole exercise: nothing in this query is a component
    // name, and the components that answer it say "first-measurement" and
    // "the measurement strip" in their own source.
    const top = names('a component for showing a metric that might not have been measured', 6);
    expect(top).toContain('stat-strip');
    expect(top).toContain('stat-card');
  });

  it('scores a contract fact, not just prose — the state union is searchable', () => {
    // `truncated` and `first-measurement` are VALUES of the data-state union,
    // indexed as contract vocabulary. Nothing about this ranking comes from a
    // component name, and no competing registry publishes the facts it uses.
    expect(names('truncated', 3).sort()).toEqual(['data-state', 'meter', 'stat-strip']);
    expect(names('first measurement', 3).sort()).toEqual([
      'data-state',
      'meter',
      'stat-strip',
    ]);
  });
});

describe('ranking — hygiene', () => {
  it('never returns an item that matched nothing', () => {
    const ranked = rank(index, prepared, 'zzzzquux');
    expect(ranked).toEqual([]);
  });

  it('demotes the pure-logic companion below the component it serves', () => {
    const ranked = rank(index, prepared, 'meter');
    const at = (name: string) => ranked.findIndex((r) => r.item.name === name);
    expect(at('meter')).toBeGreaterThanOrEqual(0);
    expect(at('meter')).toBeLessThan(at('meter-scale'));
  });

  it('explains every hit — a match always names the field it came from', () => {
    for (const hit of rank(index, prepared, 'keyboard menu').slice(0, 10)) {
      expect(hit.matches.length).toBeGreaterThan(0);
      for (const m of hit.matches) {
        expect(['name', 'blurb', 'contract', 'docs']).toContain(m.field);
      }
    }
  });
});
