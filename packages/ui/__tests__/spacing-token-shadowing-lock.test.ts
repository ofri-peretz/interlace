/**
 * Spacing-token shadowing lock.
 *
 * Interlace 1.x declared `--spacing-xs … --spacing-2xl` so the DS could write
 * `gap-md`. Tailwind v4 generates utilities from theme keys by NAMESPACE, and
 * the spacing namespace also feeds `w-*`, `h-*`, `size-*` and `max-w-*`. So
 * `--spacing-sm: 1rem` silently redefined `max-w-sm` from Tailwind's 24rem to
 * 1rem — in every consumer app that installed a single Interlace component.
 *
 * Interlace 2.0 uses Tailwind's numeric scale instead (`gap-6`), which already
 * follows the `--spacing` CSS variable. This lock keeps it that way:
 *
 *   1. foundation.css declares no named `--spacing-<name>` key that collides
 *      with a Tailwind sizing name;
 *   2. no DS source writes a named spacing utility (`gap-md`, `p-sm`), which
 *      would silently mean Tailwind's container width instead.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');
const FOUNDATION = resolve(__dirname, '../styles/foundation.css');

/** Tailwind's t-shirt names — every one of them also names a container width. */
const TSHIRT = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl'];

/** Spacing utilities, where a t-shirt name would read as a width, not a gap. */
const SPACING_UTILITIES = [
  'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'ms', 'me',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  // The scroll-margin / scroll-padding family is spacing too. `scroll-mt-xl`
  // survived the 2.0 codemod in Prose and compiled to nothing at all, so
  // every heading anchor lost its offset under a sticky header.
  'scroll-m', 'scroll-mx', 'scroll-my', 'scroll-mt', 'scroll-mb', 'scroll-ml', 'scroll-mr', 'scroll-ms', 'scroll-me',
  'scroll-p', 'scroll-px', 'scroll-py', 'scroll-pt', 'scroll-pb', 'scroll-pl', 'scroll-pr', 'scroll-ps', 'scroll-pe',
  'inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end',
  'translate-x', 'translate-y', 'indent', 'border-spacing',
];

const sourceFiles = (dir: string = SRC): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

describe('spacing stays on the numeric scale', () => {
  it('foundation.css declares no t-shirt-named --spacing key', () => {
    const css = readFileSync(FOUNDATION, 'utf8');
    const declared = [...css.matchAll(/^\s*--spacing-([a-z0-9-]+)\s*:/gim)].map((m) => m[1]);
    expect(declared.filter((name) => TSHIRT.includes(name))).toEqual([]);
  });

  it('no DS source writes a named spacing utility', () => {
    const pattern = new RegExp(
      `(?<![\\w-])-?(?:${SPACING_UTILITIES.join('|')})-(?:${TSHIRT.join('|')})(?![\\w-])`,
      'g',
    );
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${file.replace(`${SRC}/`, '')}:${line} — ${match[0]}`);
      }
    }
    expect(
      offenders,
      offenders.join('\n') +
        '\n\nUse the numeric scale: xs 2 · sm 4 · md 6 · lg 10 · xl 16 · 2xl 24 (gap-md → gap-6).',
    ).toEqual([]);
  });
});
