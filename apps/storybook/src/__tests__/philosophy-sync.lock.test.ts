/**
 * Drift gate for the philosophy projection.
 *
 * `docs/philosophies/*_PHILOSOPHY.md` is the single source of truth.
 * `scripts/sync-philosophies.ts` projects each one into
 * `apps/storybook/src/stories/philosophy/<slug>.mdx`, embedding a SHA-256
 * prefix of the source in the generated header.
 *
 * This test fails when a source `.md` is edited without re-running the
 * generator — the source's current hash won't match the projected one.
 *
 * Why it exists: these docs were copied into this repo from the eslint
 * monorepo WITHOUT the generator, so for months the mirrors carried an
 * "AUTO-GENERATED — run `npm run sync:philosophies`" banner naming a script
 * that did not exist here, and drifted by hand. A banner is not a gate.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SRC_DIR = path.join(REPO_ROOT, 'docs/philosophies');
const SB_DIR = path.join(REPO_ROOT, 'apps/storybook/src/stories/philosophy');

function slugFromFilename(file: string): string {
  return file
    .replace(/_PHILOSOPHY\.md$/, '')
    .toLowerCase()
    .replace(/_/g, '-');
}

const SOURCE_FILES = fs
  .readdirSync(SRC_DIR)
  .filter((f) => /^[A-Z][A-Z0-9_]*_PHILOSOPHY\.md$/.test(f))
  .sort();

describe('philosophy projection drift', () => {
  it('finds the philosophy sources', () => {
    // A floor, not a lock — new philosophies are expected. This only
    // catches "the source directory moved and everything silently passed".
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(25);
  });

  for (const file of SOURCE_FILES) {
    const slug = slugFromFilename(file);
    const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
    const expectedHash = createHash('sha256')
      .update(raw)
      .digest('hex')
      .slice(0, 12);

    it(`${slug}: storybook projection exists and matches source hash`, () => {
      const target = path.join(SB_DIR, `${slug}.mdx`);
      expect(
        fs.existsSync(target),
        `missing storybook projection: ${slug}.mdx — run \`npm run sync:philosophies\``,
      ).toBe(true);
      expect(
        fs.readFileSync(target, 'utf-8'),
        `${slug}.mdx drifted from ${file} — run \`npm run sync:philosophies\``,
      ).toContain(`hash: ${expectedHash}`);
    });
  }

  it('has no orphaned projections', () => {
    // The mirror of the drift check: a generated page whose source was
    // renamed or deleted keeps rendering stale doctrine forever, and the
    // per-source loop above can never see it.
    const expected = new Set(SOURCE_FILES.map(slugFromFilename));
    const orphans = fs
      .readdirSync(SB_DIR)
      .filter((f) => f.endsWith('.mdx') && f !== 'Index.mdx')
      .map((f) => f.replace(/\.mdx$/, ''))
      .filter((slug) => !expected.has(slug));
    expect(
      orphans,
      `projection(s) with no source in docs/philosophies/ — delete them or restore the source`,
    ).toEqual([]);
  });

  it('storybook index is present', () => {
    expect(fs.existsSync(path.join(SB_DIR, 'Index.mdx'))).toBe(true);
  });
});
