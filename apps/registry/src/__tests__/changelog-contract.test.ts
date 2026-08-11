import { describe, expect, it } from 'vitest';

import {
  parseChangelogMarkdown,
  parseChangeset,
  parseEntryBody,
  validate,
  // Plain .mjs build script — `allowJs` in tsconfig.json covers `scripts/**`.
} from '../../scripts/build-changelog.mjs';

/**
 * The shapes the .mjs parsers return. `allowJs` gives us the functions but no
 * types — an object literal like `{ entries: [] }` infers as `never[]`, so the
 * assertions below would not compile without naming the contract here. Kept
 * deliberately narrow: only the fields these tests assert on.
 */
type ParsedEntry = {
  summary: string;
  kind: string;
  bump: string;
  components: string[];
  migration: string | null;
  source: string;
};
type ParsedRelease = { version: string; unreleased: boolean; entries: ParsedEntry[] };

/**
 * The release notes are the upgrade path for copied source (see
 * `docs/philosophies/VERSIONING_PHILOSOPHY.md`), so the two rules that make
 * them usable — every entry names its components, every breaking entry carries
 * a migration note — are enforced by the build rather than by review. These
 * lock that enforcement.
 */

describe('parseEntryBody', () => {
  it('derives the kind from the bump when none is declared', () => {
    expect(parseEntryBody('Something.\n\nComponents: badge', 'major').kind).toBe(
      'Breaking',
    );
    expect(parseEntryBody('Something.\n\nComponents: badge', 'minor').kind).toBe(
      'Added',
    );
    expect(parseEntryBody('Something.\n\nComponents: badge', 'patch').kind).toBe(
      'Changed',
    );
  });

  it('lets an explicit Kind override the bump default', () => {
    const entry = parseEntryBody(
      'Something.\n\nKind: Changed\nComponents: badge',
      'minor',
    );
    expect(entry.kind).toBe('Changed');
  });

  it('reads a wrapped Components list', () => {
    const entry = parseEntryBody(
      'Something.\n\nComponents: badge, button,\ncard, dialog',
      'patch',
    );
    expect(entry.components).toEqual(['badge', 'button', 'card', 'dialog']);
  });

  it('treats `none` as an explicit empty list, not a missing one', () => {
    const entry = parseEntryBody('Tooling only.\n\nComponents: none', 'patch');
    expect(entry.components).toEqual([]);
    expect(entry.componentsDeclared).toBe(true);
  });

  it('keeps a multi-line migration note intact', () => {
    const entry = parseEntryBody(
      'Renamed a prop.\n\nComponents: badge\nMigration: Rename `tone` to `variant`.\nThen update every call site.',
      'major',
    );
    expect(entry.migration).toBe(
      'Rename `tone` to `variant`.\nThen update every call site.',
    );
    expect(entry.summary).toBe('Renamed a prop.');
  });
});

describe('parseChangelogMarkdown', () => {
  const markdown = [
    '# @interlace/ui',
    '',
    '## 1.1.0',
    '',
    '### Minor Changes',
    '',
    '- 1a2b3c4: Added a thing.',
    '',
    '  Components: badge',
    '',
    '## 1.0.0',
    '',
    '### Major Changes',
    '',
    '- Renamed a prop.',
    '',
    '  Components: button',
    '  Migration: Rename it.',
    '',
  ].join('\n');

  it('reads releases newest-first with their entries', () => {
    const releases = parseChangelogMarkdown(markdown) as ParsedRelease[];
    expect(releases.map((r) => r.version)).toEqual(['1.1.0', '1.0.0']);
    expect(releases[0].entries[0].components).toEqual(['badge']);
    expect(releases[1].entries[0].kind).toBe('Breaking');
    expect(releases[1].entries[0].migration).toBe('Rename it.');
  });

  it('strips the commit-hash prefix changesets writes', () => {
    const releases = parseChangelogMarkdown(markdown) as ParsedRelease[];
    expect(releases[0].entries[0].summary).toBe('Added a thing.');
  });
});

describe('parseChangeset', () => {
  it('reads the bump out of the front matter', () => {
    const entry = parseChangeset(
      ["---", "'@interlace/ui': minor", '---', '', 'A thing.', '', 'Components: badge'].join(
        '\n',
      ),
      'shiny-pandas-jam.md',
    ) as ParsedEntry;
    expect(entry).toMatchObject({ bump: 'minor', kind: 'Added' });
    expect(entry.source).toBe('.changeset/shiny-pandas-jam.md');
  });

  it('ignores a changeset for a different package', () => {
    expect(
      parseChangeset("---\n'other-pkg': minor\n---\n\nA thing.\n", 'x.md'),
    ).toBeNull();
  });
});

describe('validate', () => {
  const names = new Set(['badge', 'button']);
  const wrap = (entry: unknown) => [
    { version: '1.0.0', unreleased: false, entries: [entry] },
  ];

  it('rejects a breaking entry with no migration note', () => {
    const entry = parseEntryBody('Renamed a prop.\n\nComponents: badge', 'major');
    const errors = validate(wrap(entry), names);
    expect(errors.join('\n')).toMatch(/Migration/);
  });

  it('rejects a component name that is not a registry item', () => {
    const entry = parseEntryBody('A thing.\n\nComponents: buton', 'patch');
    expect(validate(wrap(entry), names).join('\n')).toMatch(
      /"buton" is not a registry item/,
    );
  });

  it('rejects an entry with no Components line at all', () => {
    const entry = parseEntryBody('A thing.', 'patch');
    expect(validate(wrap(entry), names).join('\n')).toMatch(/Components:/);
  });

  it('accepts a well-formed entry', () => {
    const entry = parseEntryBody(
      'Renamed a prop.\n\nComponents: badge\nMigration: Rename it.',
      'major',
    );
    expect(validate(wrap(entry), names)).toEqual([]);
  });
});
