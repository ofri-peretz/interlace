/**
 * The bin, executed.
 *
 * Every other test in this package imports a module. That is exactly why this
 * file exists: the one defect that makes `npx interlace-ui` do NOTHING is
 * invisible to an import-based test.
 *
 * npm installs a bin as a symlink at `node_modules/.bin/<name>` and `npx` runs
 * THAT. So `process.argv[1]` is the symlink while `import.meta.url` is its
 * target, and an entry-point check that compares the two without resolving the
 * link is false for every real invocation — the process exits 0 having printed
 * nothing, which reads as "the CLI ran and had no output" rather than as a
 * bug. It shipped that way once during development and no unit test moved.
 *
 * So these run the actual built file, through an actual symlink, and read
 * stdout. `npm test` builds first (see the package's `test` script) so this can
 * never quietly become a no-op on an unbuilt tree.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(PKG_ROOT, 'dist/index.js');

let linkDir: string;
let link: string;

beforeAll(() => {
  linkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'interlace-bin-'));
  link = path.join(linkDir, 'interlace-ui');
  fs.symlinkSync(BIN, link);
});
afterAll(() => {
  fs.rmSync(linkDir, { recursive: true, force: true });
});

/** Run and return stdout; throws (failing the test) on a non-zero exit. */
const run = (entry: string, args: string[]): string =>
  execFileSync(process.execPath, [entry, ...args], { encoding: 'utf8' });

it('the built bin exists — `npm test` builds before running this', () => {
  expect(fs.existsSync(BIN), 'dist/index.js missing; did `npm run build` fail?').toBe(true);
});

describe.each([
  ['directly', () => BIN],
  ['through a symlink, as npx runs it', () => link],
])('%s', (_label, entry) => {
  it('prints the version', () => {
    expect(run(entry(), ['--version']).trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints help', () => {
    expect(run(entry(), ['--help'])).toContain('interlace-ui');
  });

  // The actual regression: not a wrong answer, an EMPTY one.
  it('produces output rather than exiting silently', () => {
    expect(run(entry(), ['--version']).length).toBeGreaterThan(0);
  });

  it('resolves our names against the registry without hitting the network', () => {
    const out = run(entry(), ['add', 'button', '--dry-run']);
    expect(out).toContain('https://ds.interlace.tools/r/button.json');
  });

  it('passes a foreign namespace and unknown flags to shadcn untouched', () => {
    const out = run(entry(), ['add', 'button', '@shadcn/input', '--overwrite', '--dry-run']);
    expect(out).toContain('@shadcn/input');
    expect(out).toContain('--overwrite');
  });
});

it('exits non-zero on an unknown command', () => {
  let code = 0;
  try {
    execFileSync(process.execPath, [link, 'instal', 'button'], { stdio: 'pipe' });
  } catch (error) {
    code = (error as { status: number }).status;
  }
  expect(code).toBe(1);
});
