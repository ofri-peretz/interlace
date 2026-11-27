import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { writeGenerated, writeGeneratedSync } from '../../scripts/lib/write-generated.mjs';

/**
 * A write that pauses halfway, so the test can look at the target file at the one moment a reader
 * could catch it torn. No clock and no loop: while `target` is set, every write to ANY path goes
 * in two halves, and between them the target is read and recorded. A writer that goes through a
 * temp file leaves the target whole at that moment; one that writes the target itself does not.
 */
const probe = vi.hoisted(() => ({ target: '', seen: [] as string[] }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    writeFile: async (path: string, data: string, enc: BufferEncoding) => {
      if (!probe.target) return real.writeFile(path, data, enc);
      const half = Math.floor(data.length / 2);
      await real.writeFile(path, data.slice(0, half), enc);
      probe.seen.push(await real.readFile(probe.target, 'utf8').catch(() => '<missing>'));
      await real.appendFile(path, data.slice(half), enc);
    },
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs')>();
  return {
    ...real,
    writeFileSync: (path: string, data: string, enc: BufferEncoding) => {
      if (!probe.target) return real.writeFileSync(path, data, enc);
      const half = Math.floor(data.length / 2);
      real.writeFileSync(path, data.slice(0, half), enc);
      let now = '<missing>';
      try {
        now = real.readFileSync(probe.target, 'utf8');
      } catch {
        /* the target does not exist yet */
      }
      probe.seen.push(now);
      real.appendFileSync(path, data.slice(half), enc);
    },
  };
});

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
    // Date the file in the past, so any write at all would move its mtime.
    const past = new Date('2020-01-01T00:00:00Z');
    utimesSync(file, past, past);
    const before = statSync(file).mtimeMs;
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

  const OLD = `${JSON.stringify('a'.repeat(1000))}\n`;
  const NEW = `${JSON.stringify('b'.repeat(1000))}\n`;

  it.each([
    ['writeGenerated', (f: string, c: string) => writeGenerated(f, c)],
    ['writeGeneratedSync', async (f: string, c: string) => writeGeneratedSync(f, c)],
  ])('%s: halfway through a rewrite the target is still the whole old file', async (_name, write) => {
    const file = join(dir, `${_name}.json`);
    await write(file, OLD);
    probe.target = file;
    probe.seen = [];
    try {
      await write(file, NEW);
    } finally {
      probe.target = '';
    }
    expect(probe.seen).toEqual([OLD]);
    expect(readFileSync(file, 'utf8')).toBe(NEW);
  });

  it.each([
    ['writeGenerated', (f: string, c: string) => writeGenerated(f, c)],
    ['writeGeneratedSync', async (f: string, c: string) => writeGeneratedSync(f, c)],
  ])('%s: a file written for the first time does not exist until it is whole', async (_name, write) => {
    const file = join(dir, `first-${_name}.json`);
    probe.target = file;
    probe.seen = [];
    try {
      await write(file, NEW);
    } finally {
      probe.target = '';
    }
    expect(probe.seen).toEqual(['<missing>']);
    expect(readFileSync(file, 'utf8')).toBe(NEW);
  });
});
