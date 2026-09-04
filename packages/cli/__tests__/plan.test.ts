import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REGISTRY,
  isOurs,
  itemUrl,
  planFromArgv,
  resolveToken,
  trimTrailingSlashes,
} from '../src/plan.js';

const R = DEFAULT_REGISTRY;

describe('isOurs — which names this CLI claims', () => {
  it.each(['button', 'background-beams-with-collision', '@interlace/theme'])(
    'claims %s',
    (token) => expect(isOurs(token)).toBe(true),
  );

  // The whole point of the passthrough rule: another registry's namespace and
  // any absolute URL stay somebody else's, so one `add` can span registries.
  it.each([
    '@shadcn/button',
    '@magic/thing',
    'https://ui.example.com/r/button.json',
    'http://localhost:3000/r/button.json',
  ])('does not claim %s', (token) => expect(isOurs(token)).toBe(false));
});

describe('trimTrailingSlashes', () => {
  it.each([
    ['https://x.dev', 'https://x.dev'],
    ['https://x.dev/', 'https://x.dev'],
    ['https://x.dev///', 'https://x.dev'],
    ['', ''],
    ['/', ''],
    ['////', ''],
  ])('%s → %s', (input, expected) => {
    expect(trimTrailingSlashes(input)).toBe(expected);
  });

  /**
   * The reason this is a hand-written scan and not `/\/+$/`: that regex is a
   * polynomial ReDoS on exactly this input, and the string comes from the
   * user's `--registry`. A linear scan returns immediately; a backtracking one
   * would not, so the timing IS the assertion.
   */
  it('is linear on a pathological run of slashes', () => {
    const evil = `https://x.dev${'/'.repeat(200_000)}`;
    const started = performance.now();
    expect(trimTrailingSlashes(evil)).toBe('https://x.dev');
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('itemUrl', () => {
  it('maps a bare name onto the registry', () => {
    expect(itemUrl(R, 'button')).toBe(`${R}/r/button.json`);
  });

  it('strips the @interlace/ alias', () => {
    expect(itemUrl(R, '@interlace/theme')).toBe(`${R}/r/theme.json`);
  });

  it('tolerates a trailing slash on the registry origin', () => {
    expect(itemUrl('https://x.dev/', 'button')).toBe('https://x.dev/r/button.json');
  });
});

describe('resolveToken', () => {
  it('rewrites ours', () => {
    expect(resolveToken(R, 'card')).toBe(`${R}/r/card.json`);
  });

  it('passes a foreign namespace through untouched', () => {
    expect(resolveToken(R, '@shadcn/button')).toBe('@shadcn/button');
  });

  it('passes flags through untouched', () => {
    expect(resolveToken(R, '--overwrite')).toBe('--overwrite');
    expect(resolveToken(R, '-y')).toBe('-y');
  });
});

describe('planFromArgv', () => {
  it('no args is a usage error that still prints help', () => {
    expect(planFromArgv([])).toEqual({ kind: 'help', exitCode: 1 });
  });

  // `interlace-ui --help | head` must not report failure.
  it('--help alone exits 0', () => {
    expect(planFromArgv(['--help'])).toEqual({ kind: 'help', exitCode: 0 });
    expect(planFromArgv(['-h'])).toEqual({ kind: 'help', exitCode: 0 });
    expect(planFromArgv(['help'])).toEqual({ kind: 'help', exitCode: 0 });
  });

  it('--help on a command explains that command instead of running it', () => {
    expect(planFromArgv(['add', '--help'])).toEqual({ kind: 'help', exitCode: 0 });
  });

  it.each([['--version'], ['-v']])('%s', (flag) => {
    expect(planFromArgv([flag])).toEqual({ kind: 'version' });
  });

  it('rejects an unknown command', () => {
    expect(planFromArgv(['instal', 'button'])).toEqual({
      kind: 'error',
      message: 'Unknown command: instal',
    });
  });

  it('list and its ls alias', () => {
    expect(planFromArgv(['list'])).toEqual({ kind: 'list', registry: R });
    expect(planFromArgv(['ls'])).toEqual({ kind: 'list', registry: R });
  });

  it('--registry overrides the origin', () => {
    expect(planFromArgv(['list', '--registry', 'http://localhost:3000'])).toEqual({
      kind: 'list',
      registry: 'http://localhost:3000',
    });
  });

  it('accepts --registry=<url> as well as --registry <url>', () => {
    expect(planFromArgv(['list', '--registry=http://localhost:3000'])).toEqual({
      kind: 'list',
      registry: 'http://localhost:3000',
    });
  });

  it('rejects an empty --registry= rather than resolving against nowhere', () => {
    expect(planFromArgv(['list', '--registry='])).toEqual({
      kind: 'error',
      message: '--registry needs a URL',
    });
  });

  it('info needs a name', () => {
    expect(planFromArgv(['info'])).toEqual({
      kind: 'error',
      message: 'info needs a component name',
    });
  });

  it('info takes the first non-flag positional', () => {
    expect(planFromArgv(['info', 'button'])).toEqual({
      kind: 'info',
      registry: R,
      name: 'button',
    });
  });

  it('add needs at least one name', () => {
    expect(planFromArgv(['add'])).toEqual({
      kind: 'error',
      message: 'add needs at least one component name',
    });
    expect(planFromArgv(['add', '--overwrite'])).toEqual({
      kind: 'error',
      message: 'add needs at least one component name',
    });
  });

  it('add resolves our names and preserves argument order', () => {
    expect(planFromArgv(['add', 'button', 'card'])).toEqual({
      kind: 'shadcn',
      registry: R,
      argv: ['add', `${R}/r/button.json`, `${R}/r/card.json`],
      dryRun: false,
      alias: false,
    });
  });

  // The compatibility promise: our registry and somebody else's in one command.
  it('add mixes our names with foreign refs and unknown flags', () => {
    expect(
      planFromArgv(['add', 'button', '@shadcn/input', 'https://x.dev/r/y.json', '--overwrite']),
    ).toMatchObject({
      kind: 'shadcn',
      argv: [
        'add',
        `${R}/r/button.json`,
        '@shadcn/input',
        'https://x.dev/r/y.json',
        '--overwrite',
      ],
    });
  });

  it('add honours --dry-run and never asks for the alias write', () => {
    expect(planFromArgv(['add', 'button', '--dry-run'])).toMatchObject({
      dryRun: true,
      alias: false,
    });
  });

  // Only `init` may touch components.json, and only after shadcn made one.
  it('init asks for the @interlace alias to be registered', () => {
    expect(planFromArgv(['init'])).toEqual({
      kind: 'shadcn',
      registry: R,
      argv: ['init'],
      dryRun: false,
      alias: true,
    });
  });

  it('init forwards its own flags to shadcn', () => {
    expect(planFromArgv(['init', '-y', '--src-dir'])).toMatchObject({
      argv: ['init', '-y', '--src-dir'],
    });
  });

  it('reports a missing --registry value instead of guessing', () => {
    expect(planFromArgv(['list', '--registry'])).toEqual({
      kind: 'error',
      message: '--registry needs a URL',
    });
    // A flag where the URL should be is the same mistake, and swallowing the
    // next flag as if it were a URL would be worse than saying so.
    expect(planFromArgv(['list', '--registry', '--dry-run'])).toMatchObject({ kind: 'error' });
  });
});
