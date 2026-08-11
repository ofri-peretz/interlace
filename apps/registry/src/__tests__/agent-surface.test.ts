import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The machine-readable surface: `llms.txt`, `/.well-known/agent-skills/`, and
 * `data/agent-index.json`.
 *
 * These files exist to be read by something that cannot ask a follow-up
 * question. The failure mode that matters is therefore not "the page looks
 * wrong" but "the file confidently describes a registry that does not exist" —
 * a name that 404s, an install command with the wrong origin, a count that
 * drifted from the catalogue. Every assertion below is about that class of lie.
 *
 * Drift itself is caught by `node scripts/build-agent-surface.mjs --check`,
 * which is wired into `npm run build:check` and into `build-registry.mjs`'s
 * spawn list. This file asserts the SHAPE that check is protecting.
 */

const PUBLIC = join(process.cwd(), 'public');
const HOMEPAGE = 'https://ds.interlace.tools';

const read = (rel: string) => readFileSync(join(PUBLIC, rel), 'utf8');
const readJson = (rel: string) => JSON.parse(read(rel));

const itemNames = readdirSync(join(PUBLIC, 'r'))
  .filter((f) => f.endsWith('.json') && !['index.json', 'registry.json'].includes(f))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const agentIndex = readJson('data/agent-index.json') as {
  registry: { itemCount: number; homepage: string };
  fieldGuide: Record<string, string>;
  facets: Record<string, Record<string, number>>;
  items: Array<{
    name: string;
    summary: string;
    rendering: 'server' | 'client';
    minViewport: number | null;
    keyboard: { handled: boolean; baseUi: string | null; keys: string[] };
    states: Array<{ name: string; values: string[] }>;
    version: string | null;
    install: string;
    docs: string;
    item: string;
    registryDependencies: string[];
  }>;
};

describe('agent-index.json', () => {
  it('covers exactly the registry, item for item', () => {
    expect(agentIndex.items.map((i) => i.name).sort()).toEqual(itemNames);
    expect(agentIndex.registry.itemCount).toBe(itemNames.length);
  });

  it('points every URL at this registry and nowhere else', () => {
    for (const item of agentIndex.items) {
      expect(item.item).toBe(`${HOMEPAGE}/r/${item.name}.json`);
      expect(item.docs).toBe(`${HOMEPAGE}/c/${item.name}`);
      // A BARE name in an install command resolves against ui.shadcn.com and
      // installs somebody else's component. The absolute URL is not cosmetic.
      expect(item.install).toBe(`npx shadcn@latest add ${HOMEPAGE}/r/${item.name}.json`);
    }
  });

  it('never names a registry dependency that does not exist', () => {
    const known = new Set(itemNames);
    for (const item of agentIndex.items) {
      for (const dep of item.registryDependencies) expect(known.has(dep)).toBe(true);
    }
  });

  it('publishes the contract facts an agent filters on, for every item', () => {
    for (const item of agentIndex.items) {
      expect(['server', 'client']).toContain(item.rendering);
      expect(item.minViewport === null || item.minViewport > 0).toBe(true);
      expect(typeof item.keyboard.handled).toBe('boolean');
      expect(Array.isArray(item.keyboard.keys)).toBe(true);
      expect(Array.isArray(item.states)).toBe(true);
      // `null` is allowed (the registry's own drift gate fails on it), a
      // hallucinated version is not.
      expect(item.version === null || /^\d+\.\d+\.\d+/.test(item.version)).toBe(true);
    }
  });

  it('claims keyboard support only where the source shows it', () => {
    for (const item of agentIndex.items) {
      if (item.keyboard.keys.length > 0 || item.keyboard.baseUi) {
        expect(item.keyboard.handled).toBe(true);
      }
    }
    // And the claim is not vacuous: some items really do handle keys.
    expect(
      agentIndex.items.filter((i) => i.keyboard.keys.length > 0).length,
    ).toBeGreaterThan(0);
  });

  it('documents every field it publishes', () => {
    for (const field of ['meta.client', 'meta.minViewport', 'keyboard', 'states']) {
      expect(agentIndex.fieldGuide[field]).toBeTruthy();
    }
  });

  it('has facet tallies that add up to the catalogue', () => {
    const sum = (o: Record<string, number>) =>
      Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(agentIndex.facets.rendering)).toBe(itemNames.length);
    expect(sum(agentIndex.facets.keyboard)).toBe(itemNames.length);
    expect(sum(agentIndex.facets.tier)).toBe(itemNames.length);
  });
});

describe('llms.txt', () => {
  const llms = read('llms.txt');

  it('follows the convention: H1, then a blockquote summary', () => {
    const lines = llms.split('\n');
    expect(lines[0].startsWith('# ')).toBe(true);
    expect(lines.some((l) => l.startsWith('> '))).toBe(true);
  });

  it('lists every registry item exactly once', () => {
    for (const name of itemNames) {
      const links = llms.split(`(${HOMEPAGE}/c/${name})`).length - 1;
      expect(`${name}:${links}`).toBe(`${name}:1`);
    }
  });

  it('gives each item an install command and a contract line', () => {
    for (const name of itemNames) {
      expect(llms).toContain(`npx shadcn@latest add ${HOMEPAGE}/r/${name}.json`);
    }
  });

  it('points at the machine-readable index, not just at prose', () => {
    expect(llms).toContain(`${HOMEPAGE}/data/agent-index.json`);
    expect(llms).toContain(`${HOMEPAGE}/.well-known/agent-skills/index.json`);
    expect(llms).toContain(`${HOMEPAGE}/r/registry.json`);
  });
});

describe('/.well-known/agent-skills/', () => {
  const manifest = readJson('.well-known/agent-skills/index.json') as {
    skills: Array<{ id: string; name: string; description: string; url: string; path: string }>;
    index: string;
    llmsTxt: string;
  };

  it('describes what an agent can DO, in three skills', () => {
    expect(manifest.skills.map((s) => s.id).sort()).toEqual([
      'discover-interlace-components',
      'install-interlace-component',
      'read-interlace-contract',
    ]);
  });

  it('has a real SKILL.md behind every entry, with front matter', () => {
    for (const skill of manifest.skills) {
      const body = read(skill.path);
      expect(body.startsWith('---\n')).toBe(true);
      expect(body).toContain(`name: ${skill.name}`);
      expect(skill.url).toBe(`${HOMEPAGE}/${skill.path}`);
      // A skill that tells an agent to fetch something must say WHERE.
      expect(body).toContain(HOMEPAGE);
      expect(body.length).toBeGreaterThan(500);
    }
  });

  it('links the two indexes an agent needs first', () => {
    expect(manifest.index).toBe(`${HOMEPAGE}/data/agent-index.json`);
    expect(manifest.llmsTxt).toBe(`${HOMEPAGE}/llms.txt`);
  });

  it('only cites item names that exist — the worked examples are generated', () => {
    const known = new Set(itemNames);
    for (const skill of manifest.skills) {
      const body = read(skill.path);
      for (const [, name] of body.matchAll(
        new RegExp(`${HOMEPAGE}/r/([a-z][a-z0-9-]*)\\.json`, 'g'),
      )) {
        if (name === '<name>' || name === 'registry') continue;
        expect(`${skill.id} cites ${name}`).toBe(
          known.has(name) ? `${skill.id} cites ${name}` : `${skill.id} cites a real item`,
        );
      }
    }
  });
});

describe('search-index.json', () => {
  const index = readJson('data/search-index.json') as {
    docs: number;
    stopwords: string[];
    df: Record<string, number>;
    items: Array<{ name: string; blurb: string; terms: string; facets: string[] }>;
  };

  it('indexes every item', () => {
    expect(index.items.map((i) => i.name).sort()).toEqual(itemNames);
    expect(index.docs).toBe(itemNames.length);
  });

  it('gives every item real terms and a non-empty blurb', () => {
    for (const item of index.items) {
      expect(item.terms.split(' ').length).toBeGreaterThan(4);
      expect(item.blurb.trim().length).toBeGreaterThan(10);
      // The blurb is read out of a JSDoc block; a stray comment terminator in
      // it means the extractor ran past a comment boundary.
      expect(item.blurb).not.toContain('*/');
    }
  });

  it('ships the stopword list the ranker has to reuse', () => {
    expect(index.stopwords.length).toBeGreaterThan(50);
    expect(index.stopwords).toContain('the');
  });

  it('has a df entry for every term any item carries', () => {
    for (const item of index.items) {
      for (const term of item.terms.split(' ')) {
        expect(`${term}:${index.df[term] !== undefined}`).toBe(`${term}:true`);
      }
    }
  });
});
