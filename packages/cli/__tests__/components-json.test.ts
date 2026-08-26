import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ALIAS, ensureRegistryAlias } from '../src/components-json.js';
import { DEFAULT_REGISTRY } from '../src/plan.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'interlace-cli-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const write = (contents: string) =>
  fs.writeFileSync(path.join(dir, 'components.json'), contents);
const read = () => fs.readFileSync(path.join(dir, 'components.json'), 'utf8');

describe('ensureRegistryAlias', () => {
  it('adds the alias when components.json has no registries at all', async () => {
    write(JSON.stringify({ style: 'new-york', aliases: { ui: '@/components/ui' } }, null, 2));

    const result = await ensureRegistryAlias(dir, DEFAULT_REGISTRY);

    expect(result).toEqual({
      status: 'added',
      alias: `${DEFAULT_REGISTRY}/r/{name}.json`,
    });
    expect(JSON.parse(read()).registries).toEqual({
      [ALIAS]: `${DEFAULT_REGISTRY}/r/{name}.json`,
    });
  });

  it('preserves every other key and every other registry', async () => {
    write(
      JSON.stringify(
        {
          style: 'new-york',
          aliases: { ui: '@/components/ui' },
          registries: { '@acme': 'https://acme.dev/r/{name}.json' },
        },
        null,
        2,
      ),
    );

    await ensureRegistryAlias(dir, DEFAULT_REGISTRY);
    const after = JSON.parse(read());

    expect(after.style).toBe('new-york');
    expect(after.aliases).toEqual({ ui: '@/components/ui' });
    expect(after.registries['@acme']).toBe('https://acme.dev/r/{name}.json');
  });

  // Rule 1: someone who repointed @interlace at a fork or a preview deploy
  // meant it, and quietly restoring production would be the worst kind of help.
  it('never overwrites an existing @interlace entry', async () => {
    write(
      JSON.stringify({ registries: { [ALIAS]: 'https://fork.example/r/{name}.json' } }, null, 2),
    );

    const result = await ensureRegistryAlias(dir, DEFAULT_REGISTRY);

    expect(result).toEqual({ status: 'already-present' });
    expect(JSON.parse(read()).registries[ALIAS]).toBe('https://fork.example/r/{name}.json');
  });

  // Rule 2: a successful install must not be undone by a cosmetic convenience.
  it('reports rather than throws when there is no components.json', async () => {
    await expect(ensureRegistryAlias(dir, DEFAULT_REGISTRY)).resolves.toEqual({
      status: 'no-config',
    });
  });

  it('reports rather than throws when components.json is malformed', async () => {
    write('{ not json');

    await expect(ensureRegistryAlias(dir, DEFAULT_REGISTRY)).resolves.toEqual({
      status: 'unparsable',
    });
    // and leaves the broken file exactly as it found it
    expect(read()).toBe('{ not json');
  });

  it('writes shadcn-style formatting so the diff is one line', async () => {
    write(`${JSON.stringify({ style: 'new-york' }, null, 2)}\n`);

    await ensureRegistryAlias(dir, DEFAULT_REGISTRY);

    expect(read().endsWith('\n')).toBe(true);
    expect(read()).toContain('\n  "registries": {');
  });

  it('normalises a trailing slash on the registry origin', async () => {
    write('{}');

    const result = await ensureRegistryAlias(dir, 'https://x.dev/');

    expect(result).toEqual({ status: 'added', alias: 'https://x.dev/r/{name}.json' });
  });
});
