import { describe, expect, it } from 'vitest';

import versions from '../../component-versions.json';
import {
  applyBump,
  bumpForCommit,
  compareSemver,
  deriveVersions,
  // Plain .mjs build script — `allowJs` in tsconfig.json covers `scripts/**`.
} from '../../scripts/derive-component-versions.mjs';

/**
 * Per-component versions are DERIVED from git, never hand-maintained — a
 * hand-maintained one rots the first time somebody edits a companion file. The
 * derivation rules are the contract; these lock them.
 *
 * See `docs/philosophies/VERSIONING_PHILOSOPHY.md` § "Per-component versions".
 */

describe('bumpForCommit', () => {
  it.each([
    ['feat(ui): a new primitive', '', 'minor'],
    ['fix(ui): a defect', '', 'patch'],
    ['perf(ui): faster', '', 'patch'],
    ['refactor(ui): tidy', '', 'patch'],
    ['feat(ui)!: renamed a prop', '', 'major'],
    ['feat(ui): renamed a prop', 'BREAKING CHANGE: tone is now variant', 'major'],
  ])('maps %s → %s', (subject, body, expected) => {
    expect(bumpForCommit({ subject, body })).toBe(expected);
  });

  it.each([
    ['chore(ui): reformat'],
    ['docs(ui): comment typo'],
    ['test(ui): more coverage'],
    ['ci: cache tweak'],
  ])('does not move a version for %s', (subject) => {
    // A version a consumer reads as "something changed for me" must not move
    // for a change nothing in their tree can observe.
    expect(bumpForCommit({ subject, body: '' })).toBeNull();
  });
});

describe('applyBump', () => {
  it('resets the lower fields', () => {
    expect(applyBump('1.4.2', 'major')).toBe('2.0.0');
    expect(applyBump('1.4.2', 'minor')).toBe('1.5.0');
    expect(applyBump('1.4.2', 'patch')).toBe('1.4.3');
  });
});

describe('deriveVersions', () => {
  const sourcePaths = new Map([
    ['badge', ['packages/ui/src/primitives/badge.tsx']],
    ['button', [
      'packages/ui/src/primitives/button.tsx',
      'packages/ui/src/primitives/button-variants.ts',
    ]],
  ]);

  const commits = [
    {
      hash: 'a',
      date: '2026-01-01',
      subject: 'feat: initial commit',
      body: '',
      files: [
        'packages/ui/src/primitives/badge.tsx',
        'packages/ui/src/primitives/button.tsx',
      ],
    },
    {
      hash: 'b',
      date: '2026-02-01',
      subject: 'chore(ui): reformat everything',
      body: '',
      files: ['packages/ui/src/primitives/badge.tsx'],
    },
    {
      hash: 'c',
      date: '2026-03-01',
      subject: 'feat(ui): a new button variant',
      body: '',
      files: ['packages/ui/src/primitives/button-variants.ts'],
    },
  ];

  const derived = deriveVersions({
    names: ['badge', 'button'],
    sourcePaths,
    commits,
    tags: [],
    packageVersion: '1.0.0',
  });
  const byName = Object.fromEntries(derived.map((d) => [d.name, d]));

  it('starts a shipped component at 1.0.0, never 0.x', () => {
    expect(byName.badge.version).toBe('1.0.0');
  });

  it('bumps a component when a COMPANION file changes', () => {
    // `button-variants.ts` is not a component of its own — a consumer installs
    // it inside button. Missing this is exactly how a hand-kept version rots.
    expect(byName.button.version).toBe('1.1.0');
  });

  it('does not bump for a chore commit', () => {
    expect(byName.badge.updated).toBe('2026-01-01');
  });

  it('falls back to the package version for `since` when there are no tags', () => {
    expect(byName.badge.since).toBe('1.0.0');
  });
});

describe('the committed manifest', () => {
  it('is valid semver throughout and never regresses below 1.0.0', () => {
    for (const entry of versions.components) {
      expect(entry.version, entry.name).toMatch(/^\d+\.\d+\.\d+$/);
      expect(compareSemver(entry.version, '1.0.0'), entry.name).toBeGreaterThanOrEqual(0);
    }
  });
});
