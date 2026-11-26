import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { writeGenerated, writeGeneratedSync } from '../../scripts/lib/write-generated.mjs';

/**
 * The pre-push runs `registry#build` (whose prebuild regenerates public/) at the
 * same time as the test tasks that read public/, here and in @interlace/ui. A
 * generator that truncates a file and then fills it lets a test read half of it,
 * which failed the push at random and passed when the test ran alone. Every
 * generator therefore writes through `scripts/lib/write-generated.mjs`: nothing
 * when the content is the same, and a rename into place when it is not.
 */

const SCRIPTS = join(process.cwd(), 'scripts');

/** Scripts that write somewhere no test reads: the scratch app of the install e2e. */
const NOT_GENERATORS = new Set(['e2e-install.mjs']);

const generators = readdirSync(SCRIPTS).filter(
  (name) => name.endsWith('.mjs') && !NOT_GENERATORS.has(name),
);

describe('registry generators write atomically', () => {
  it.each(generators)('%s writes only through writeGenerated', (name) => {
    const source = readFileSync(join(SCRIPTS, name), 'utf8');
    expect(
      source.match(/\bwriteFile(Sync)?\s*\(/g) ?? [],
      `${name} calls writeFile directly. Use writeGenerated (or writeGeneratedSync) from ` +
        `./lib/write-generated.mjs, so a test reading the file mid-build never sees half of it.`,
    ).toEqual([]);
  });
});

describe('writeGenerated', () => {
  const dir = mkdtempSync(join(tmpdir(), 'write-generated-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('leaves a file alone when the content is the same', async () => {
    const file = join(dir, 'same.json');
    writeFileSync(file, '{}\n');
    const before = statSync(file).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    expect(await writeGenerated(file, '{}\n')).toBe(false);
    expect(writeGeneratedSync(file, '{}\n')).toBe(false);
    expect(statSync(file).mtimeMs).toBe(before);
  });

  it('replaces a changed file and leaves no temp file behind', async () => {
    const file = join(dir, 'nested/changed.json');
    expect(await writeGenerated(file, '{"a":1}\n')).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('{"a":1}\n');
    expect(writeGeneratedSync(file, '{"a":2}\n')).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('{"a":2}\n');
    expect(readdirSync(join(dir, 'nested'))).toEqual(['changed.json']);
  });

  it('never shows a reader a partial file while it rewrites', async () => {
    const file = join(dir, 'big.json');
    const versions = ['a', 'b'].map((c) => `${JSON.stringify(c.repeat(2_000_000))}\n`);
    await writeGenerated(file, versions[0]);
    let writing = true;
    const seen = new Set<number>();
    const reader = (async () => {
      while (writing) {
        seen.add(readFileSync(file, 'utf8').length);
        await new Promise((r) => setImmediate(r));
      }
    })();
    for (let i = 1; i <= 20; i++) await writeGenerated(file, versions[i % 2]);
    writing = false;
    await reader;
    expect([...seen]).toEqual([versions[0].length]);
  });
});
