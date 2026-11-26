/**
 * `check`: what each status means, byte for byte, and how the allow list and --strict change what fails.
 */
import { describe, expect, it } from 'vitest';

import {
  aliasDir,
  candidatePaths,
  checkItems,
  classify,
  compareVersions,
  normalizeEol,
  parseAllowConfig,
  parseBanner,
  summarize,
  type CheckItem,
  type Reader,
  type Result,
} from '../src/check.js';

const banner = (v: string, name = 'button') => `// @interlace/${name} v${v} — Interlace design system.\n`;
const file = (v: string, body = 'export const a = 1;\n', name = 'button') => `${banner(v, name)}${body}`;

describe('normalizeEol', () => {
  it('makes line endings the same and changes nothing else', () => {
    expect(normalizeEol('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
    expect(normalizeEol('  a \t\n\n')).toBe('  a \t\n\n'); // no trimming
  });
});

describe('parseBanner', () => {
  it('reads the name and version from a banner line near the top', () => {
    expect(parseBanner(`'use client';\n\nimport x from 'y';\n// @interlace/live-room v1.2.3 — Interlace design system.\n`)).toEqual({
      name: 'live-room',
      version: '1.2.3',
    });
  });
  it('ignores a line that is not a comment, a version that is not x.y.z, and a file without one', () => {
    expect(parseBanner('const s = "@interlace/button v1.0.0";')).toBeNull();
    expect(parseBanner('// @interlace/button v1.0 — x')).toBeNull();
    expect(parseBanner('// @interlace/ v1.0.0')).toBeNull();
    expect(parseBanner('// @interlace/button')).toBeNull();
    expect(parseBanner('export const a = 1;')).toBeNull();
  });
  it('only reads the first lines', () => {
    expect(parseBanner(`${'x\n'.repeat(20)}// @interlace/button v1.0.0 — x`)).toBeNull();
  });
});

describe('compareVersions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('0.9.0', '1.0.0')).toBe(-1);
  });
  it('counts a version that is not x.y.z as 0.0.0', () => {
    expect(compareVersions('beta', '0.0.0')).toBe(0);
    expect(compareVersions('beta', '0.0.1')).toBe(-1);
  });
});

describe('classify', () => {
  const remote = file('3.4.0');

  it('match: the bytes are the release', () => {
    expect(classify(remote, remote, '3.4.0')).toEqual({ status: 'match' });
  });
  it('match: only the line endings differ', () => {
    expect(classify(remote.replace(/\n/g, '\r\n'), remote, '3.4.0')).toEqual({ status: 'match' });
  });
  it('missing: there is no file', () => {
    expect(classify(null, remote, '3.4.0')).toEqual({ status: 'missing' });
  });
  it('modified: the banner is the current release and the bytes differ', () => {
    expect(classify(file('3.4.0', 'export const a = 2;\n'), remote, '3.4.0')).toEqual({ status: 'modified', localVersion: '3.4.0' });
  });
  it('modified: reformatted counts as changed (trailing space, no final newline)', () => {
    expect(classify(remote.replace('= 1;', '= 1; '), remote, '3.4.0').status).toBe('modified');
    expect(classify(remote.trimEnd(), remote, '3.4.0').status).toBe('modified');
  });
  it('modified: there is no banner at all', () => {
    expect(classify('export const a = 2;\n', remote, '3.4.0')).toEqual({ status: 'modified' });
  });
  it('modified: the release has no version to compare with', () => {
    expect(classify(file('9.9.9', 'x'), remote, undefined)).toEqual({ status: 'modified' });
  });
  it('behind: the banner names an older release', () => {
    expect(classify(file('3.3.0', 'export const a = 0;\n'), remote, '3.4.0')).toEqual({ status: 'behind', localVersion: '3.3.0' });
  });
  it('ahead: the banner names a release the registry does not have', () => {
    expect(classify(file('3.5.0', 'export const a = 3;\n'), remote, '3.4.0')).toEqual({ status: 'ahead', localVersion: '3.5.0' });
    expect(classify(file('10.0.0', 'x'), remote, '9.9.9').status).toBe('ahead');
  });
});

describe('aliasDir and candidatePaths', () => {
  it('turns an alias into a folder, and says nothing for one it cannot read', () => {
    expect(aliasDir('@/components/ui')).toBe('components/ui');
    expect(aliasDir('~/lib/')).toBe('lib');
    expect(aliasDir('@/')).toBeNull();
    expect(aliasDir('components/ui')).toBeNull();
    expect(aliasDir(undefined)).toBeNull();
  });

  it('looks where the alias says, then where the registry says, in the root and under src', () => {
    expect(candidatePaths('components/ui/button.tsx')).toEqual(['components/ui/button.tsx', 'src/components/ui/button.tsx']);
    expect(candidatePaths('components/ui/games/room.tsx', { ui: '@/shared/ui' })).toEqual([
      'shared/ui/games/room.tsx',
      'src/shared/ui/games/room.tsx',
      'components/ui/games/room.tsx',
      'src/components/ui/games/room.tsx',
    ]);
    expect(candidatePaths('lib/utils.ts', { lib: '@/core' })[0]).toBe('core/utils.ts');
    expect(candidatePaths('hooks/use-x.ts', { hooks: '~/h' })[0]).toBe('h/use-x.ts');
    expect(candidatePaths('components/card.tsx', { components: '@/c', ui: '@/u' })[0]).toBe('c/card.tsx');
  });

  it('does not list a place twice when the alias is the registry layout', () => {
    expect(candidatePaths('components/ui/a.tsx', { ui: '@/components/ui' })).toEqual(['components/ui/a.tsx', 'src/components/ui/a.tsx']);
  });

  it('uses the registry layout when an alias cannot be read, and for a target outside the layout', () => {
    expect(candidatePaths('components/ui/a.tsx', { ui: 'nonsense' })).toEqual(['components/ui/a.tsx', 'src/components/ui/a.tsx']);
    expect(candidatePaths('docs/NOTES.md', { ui: '@/u' })).toEqual(['docs/NOTES.md', 'src/docs/NOTES.md']);
  });
});

describe('checkItems', () => {
  const button: CheckItem = {
    name: 'button',
    meta: { version: '3.4.0' },
    files: [
      { target: 'components/ui/button.tsx', content: file('3.4.0') },
      { target: 'components/ui/button-variants.ts', content: 'export const v = 1;\n' },
    ],
  };
  const card: CheckItem = {
    name: 'card',
    meta: { version: '1.0.0' },
    files: [{ target: 'components/ui/card.tsx', content: file('1.0.0', 'export const c = 1;\n', 'card') }],
  };
  const reader = (disk: Record<string, string>): Reader => (candidates) => {
    for (const c of candidates) if (c in disk) return { file: c, content: disk[c]! };
    return null;
  };

  it('reports each file of an installed item, and skips an item with none of its files here', () => {
    const results = checkItems([button, card], {}, reader({ 'components/ui/button.tsx': file('3.4.0') }));
    expect(results.map((r) => [r.file, r.item, r.status])).toEqual([
      ['components/ui/button-variants.ts', 'button', 'missing'],
      ['components/ui/button.tsx', 'button', 'match'],
    ]);
  });

  it('finds a file under src, reports the path it found, and carries the versions', () => {
    const results = checkItems([button], {}, reader({ 'src/components/ui/button.tsx': file('3.3.0', 'old\n'), 'src/components/ui/button-variants.ts': 'export const v = 1;\n' }));
    expect(results[1]).toEqual({
      file: 'src/components/ui/button.tsx',
      item: 'button',
      status: 'behind',
      localVersion: '3.3.0',
      releasedVersion: '3.4.0',
      allowed: false,
    });
  });

  it('follows an alias to where the file really is', () => {
    const results = checkItems([card], { ui: '@/shared/ui' }, reader({ 'shared/ui/card.tsx': file('1.0.0', 'export const c = 1;\n', 'card') }));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ file: 'shared/ui/card.tsx', status: 'match' });
  });

  it('checks a file that two items share once', () => {
    const shared = { target: 'components/ui/room-model.ts', content: 'export const r = 1;\n' };
    const a: CheckItem = { name: 'a', files: [shared] };
    const b: CheckItem = { name: 'b', files: [shared] };
    const results = checkItems([a, b], {}, reader({ 'components/ui/room-model.ts': 'export const r = 1;\n' }));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ item: 'a', status: 'match' });
    expect(results[0]).not.toHaveProperty('releasedVersion');
  });

  it('ignores a registry file with no target or no content', () => {
    const odd: CheckItem = { name: 'odd', files: [{ path: 'x' }, { target: 'components/ui/y.tsx' }] };
    expect(checkItems([odd, { name: 'empty' }], {}, reader({ 'components/ui/y.tsx': 'z' }))).toEqual([]);
  });

  it('sorts by file', () => {
    const results = checkItems([card, button], {}, reader({ 'components/ui/card.tsx': 'x', 'components/ui/button.tsx': 'x' }));
    const files = results.map((r) => r.file);
    expect(files).toEqual([...files].sort());
  });
});

const result = (file: string, status: Result['status']): Result => ({ file, item: 'i', status, allowed: false });

describe('summarize', () => {
  const all: Result[] = [
    result('a', 'match'),
    result('b', 'behind'),
    result('c', 'modified'),
    result('d', 'ahead'),
    result('e', 'missing'),
  ];

  it('counts every status, and fails on modified, ahead and missing', () => {
    const { summary } = summarize(all, {}, false);
    expect(summary.counts).toEqual({ match: 1, behind: 1, modified: 1, ahead: 1, missing: 1 });
    expect(summary.failing.map((r) => r.file)).toEqual(['c', 'd', 'e']);
    expect(summary.ok).toBe(false);
  });

  it('does not fail on a file that is behind, unless strict', () => {
    const only = [result('a', 'match'), result('b', 'behind')];
    expect(summarize(only, {}, false).summary.ok).toBe(true);
    const strict = summarize(only, {}, true).summary;
    expect(strict.ok).toBe(false);
    expect(strict.failing.map((r) => r.file)).toEqual(['b']);
  });

  it('never fails on an allowed file, and says why', () => {
    const { results, summary } = summarize(all, { c: 'edited on purpose', d: '', e: '' }, false);
    expect(summary.ok).toBe(true);
    expect(results.find((r) => r.file === 'c')).toMatchObject({ allowed: true, reason: 'edited on purpose' });
    expect(results.find((r) => r.file === 'd')).toMatchObject({ allowed: true });
    expect(results.find((r) => r.file === 'd')).not.toHaveProperty('reason');
    expect(results.find((r) => r.file === 'a')?.allowed).toBe(false);
  });

  it('writes the path the way the results do: forward slashes, no ./', () => {
    const { summary } = summarize([result('src/a.tsx', 'modified')], { './src\\a.tsx': '' }, false);
    expect(summary.ok).toBe(true);
  });

  it('tells you when an allowed file matches a release again', () => {
    const { summary } = summarize([result('a', 'match'), result('c', 'modified')], { a: 'was ahead', c: '' }, false);
    expect(summary.stale).toEqual(['a']);
    expect(summary.ok).toBe(true);
  });

  it('ignores allowed paths it did not check, and inherited names', () => {
    const { summary } = summarize([result('constructor', 'modified')], { other: 'x' }, false);
    expect(summary.failing).toHaveLength(1);
  });

  it('is ok with nothing to check', () => {
    expect(summarize([], {}, true).summary.ok).toBe(true);
  });
});

describe('parseAllowConfig', () => {
  it('reads a map of file to reason, and a plain list', () => {
    expect(parseAllowConfig('{"allow":{"a.tsx":"pr 227","b.tsx":3}}')).toEqual({ 'a.tsx': 'pr 227', 'b.tsx': '' });
    expect(parseAllowConfig('{"allow":["a.tsx",4,"b.tsx"]}')).toEqual({ 'a.tsx': '', 'b.tsx': '' });
  });
  it('is an empty list when there is none, and null for text that is not JSON', () => {
    expect(parseAllowConfig('{}')).toEqual({});
    expect(parseAllowConfig('{"allow":"a"}')).toEqual({});
    expect(parseAllowConfig('null')).toEqual({});
    expect(parseAllowConfig('{nope')).toBeNull();
  });
});
