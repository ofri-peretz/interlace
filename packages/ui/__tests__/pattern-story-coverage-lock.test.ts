/**
 * Pattern Storybook Coverage Lock.
 *
 * The primitive layer already has this gate (`storybook-coverage-lock`); the
 * pattern layer did not, and drifted — eight of the twenty-nine patterns had
 * no story at all when Phase 1.3 opened.
 *
 * Why it matters more for patterns than for primitives: Storybook is where
 * addon-a11y runs axe and where the dark-theme decorator paints the other
 * colour scheme. A primitive with no story is one unchecked element. A
 * pattern with no story is an entire composed surface — a hero, a footer, a
 * card grid — that no automated check has ever rendered. Those are exactly
 * the surfaces where contrast and landmark bugs hide, because they only
 * appear once the parts are assembled.
 *
 * Story files live under `stories/blocks/` rather than `stories/patterns/`.
 * That is a naming holdover from when the source directory was `blocks/`
 * (now fourteen deprecated re-export shims). The lock encodes the mapping
 * rather than pretending it doesn't exist — renaming the story directory is
 * a separate change with its own Storybook-URL fallout.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const PATTERNS_DIR = join(REPO_ROOT, 'packages/ui/src/patterns');
const STORIES_DIR = join(REPO_ROOT, 'apps/storybook/src/stories/blocks');

/**
 * Patterns whose story lives elsewhere, with the reason. Keep this empty if
 * you can — an entry here is a pattern the coverage number is lying about.
 */
const STORY_ELSEWHERE: Record<string, string> = {};

const kebabToPascal = (name: string) =>
  name
    .replace(/\.tsx?$/, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/**
 * Names whose Pascal form isn't a plain word-by-word capitalisation —
 * acronyms the DS spells in caps.
 */
const PASCAL_OVERRIDES: Record<string, string> = {
  'faq.tsx': 'FAQ',
  'cta-section.tsx': 'CTASection',
};

const expectedStoryName = (file: string) =>
  PASCAL_OVERRIDES[file] ?? kebabToPascal(file);

const listPatterns = () =>
  readdirSync(PATTERNS_DIR).filter((f) => f.endsWith('.tsx'));

const listStories = () =>
  readdirSync(STORIES_DIR).filter((f) => f.endsWith('.stories.tsx'));

describe('Storybook pattern coverage (a11y + dark-mode enforcement surface)', () => {
  it('every pattern has a matching story', () => {
    const stories = new Set(
      listStories().map((f) => f.replace(/\.stories\.tsx$/, '')),
    );

    const missing = listPatterns()
      .filter((file) => !STORY_ELSEWHERE[file])
      .filter((file) => !stories.has(expectedStoryName(file)))
      .map(
        (file) =>
          `${file} → expected apps/storybook/src/stories/blocks/${expectedStoryName(file)}.stories.tsx`,
      );

    expect(
      missing,
      `Patterns with no story. Without one, axe and the dark-theme ` +
        `decorator never render this surface:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('no orphan story without a backing pattern', () => {
    const patterns = new Set(listPatterns().map(expectedStoryName));
    const orphans = listStories()
      .map((f) => f.replace(/\.stories\.tsx$/, ''))
      .filter((base) => !patterns.has(base))
      .map((base) => `${base}.stories.tsx — no matching file in packages/ui/src/patterns/`);

    expect(orphans, orphans.join('\n')).toEqual([]);
  });

  it('stories import from patterns/, not the deprecated blocks/ alias', () => {
    // `packages/ui/src/blocks/*` is fourteen one-line re-export shims kept
    // for external consumers. Storybook is not an external consumer — if the
    // DS's own showcase still reaches through the alias, the alias can never
    // be retired, because "nothing references it" will never become true.
    const { readFileSync } = require('fs') as typeof import('fs');
    // Match an IMPORT, not the string anywhere in the file. A bare
    // `includes('@interlace/ui/blocks/')` also matches the deprecation NOTE in
    // a comment — which is how this lock failed a story that imports from
    // `patterns/` perfectly well and merely documents what it no longer uses.
    // Same lesson the ESLint rules learned: match the construct, not the
    // printed source, because comments and identifiers look identical to a
    // substring search.
    const IMPORTS_BLOCKS_ALIAS =
      /^\s*(?:import|export)[^\n]*?from\s*['"]@interlace\/ui\/blocks\/[^'"]+['"]/m;
    const offenders = listStories().filter((file) =>
      IMPORTS_BLOCKS_ALIAS.test(
        readFileSync(join(STORIES_DIR, file), 'utf8'),
      ),
    );

    expect(
      offenders,
      `Stories importing through the deprecated blocks/ alias:\n` +
        `${offenders.join('\n')}\n\nSwap to @interlace/ui/patterns/<name>.`,
    ).toEqual([]);
  });
});
