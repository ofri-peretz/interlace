/**
 * Spacing-token shadowing lock.
 *
 * `foundation.css` declares `--spacing-xs … --spacing-2xl` so the DS can write
 * `gap-md`, `px-sm`, `py-xl`. Tailwind v4 generates utilities from theme keys by
 * NAMESPACE, and the spacing namespace feeds far more than gap and padding — it
 * also feeds `w-*`, `h-*`, `min-w-*`, `max-w-*`, `size-*`, `basis-*`, `inset-*`.
 *
 * So `--spacing-sm: 1rem` silently redefines `max-w-sm` from Tailwind's
 * **24rem (384px)** to **1rem (16px)**. Same for md/lg/xl/2xl. Measured in a
 * live browser against this DS: `max-w-sm` computes to `16px`.
 *
 * Nothing throws. A consumer who reaches for the single most common max-width
 * utility in the Tailwind ecosystem gets a 16px column, and every explanation
 * they try (a wrong parent, a missing flex rule, a bad breakpoint) is wrong.
 *
 * We currently dodge this by never using those utilities — `sign-in-form` uses
 * `max-w-96` for exactly the width `max-w-sm` was supposed to give. This lock
 * pins that discipline in the DS, and the paired assertion documents the
 * collision itself so the next person to add `--spacing-3xl` sees what it costs.
 *
 * NOT a bug to "fix" by renaming the spacing scale — the `gap-md` vocabulary is
 * used throughout and is the more valuable half. It is a trap to be named, and
 * to be warned about in the consumer-facing layout docs.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');
const FOUNDATION = resolve(__dirname, '../styles/foundation.css');

/** `--spacing-sm: 1rem;` → `sm`. */
function spacingScaleNames(): string[] {
  const css = readFileSync(FOUNDATION, 'utf8');
  return [...css.matchAll(/^\s*--spacing-([a-z0-9-]+)\s*:/gim)].map((m) => m[1]).sort();
}

/**
 * `max-w` ONLY — and the narrowness is the point.
 *
 * Tailwind feeds many namespaces from `--spacing-*` (`w`, `h`, `size`,
 * `min-h`, `basis`, …), but in every one of those the stock Tailwind scale is
 * ALSO spacing, so a DS spacing token adds a name rather than replacing a
 * meaning. `min-h-2xl` on the textarea is a deliberate 6rem and reads exactly
 * as written.
 *
 * `max-width` is the exception: Tailwind ships a SEPARATE, widely-known scale
 * there — `max-w-sm` is 24rem/384px in every other Tailwind codebase on earth.
 * Ours silently makes it 1rem/16px. That is the only collision where a correct
 * mental model produces a wrong result, so it is the only one worth banning.
 *
 * An over-broad version of this lock flagged the textarea's intentional
 * `min-h-2xl` and would have taught the next reader to distrust it.
 */
const SHADOWED_PREFIXES = ['max-w'];

const sourceFiles = (): string[] => {
  const { execSync } = require('child_process') as typeof import('child_process');
  return execSync(`find ${SRC} -name '*.tsx' -o -name '*.ts'`, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
};

describe('spacing tokens shadow Tailwind sizing utilities', () => {
  it('declares the scale this lock is about', () => {
    // If this fails someone renamed the scale — re-read the whole file before
    // "fixing" the assertion.
    expect(spacingScaleNames()).toEqual(['2xl', 'lg', 'md', 'sm', 'xl', 'xs']);
  });

  it('no DS source uses a sizing utility whose name collides with the spacing scale', () => {
    const names = spacingScaleNames();
    const pattern = new RegExp(
      `\\b(?:${SHADOWED_PREFIXES.join('|')})-(?:${names.join('|')})\\b`,
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
        '\n\nThese resolve to a SPACING value, not the Tailwind sizing value you expect:\n' +
        '  max-w-sm → 16px, NOT 384px.  w-lg → 40px, NOT the width scale.\n' +
        'Use an explicit value instead (`max-w-96`, `w-[420px]`) or a container token.',
    ).toEqual([]);
  });
});
