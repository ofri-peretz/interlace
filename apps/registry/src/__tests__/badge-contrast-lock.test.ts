import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Light-mode contrast lock for the tinted category / status chips.
 *
 * The registry has no live-page axe gate (unlike `apps/landing`, which runs
 * `@axe-core/playwright` in `e2e/a11y.spec.ts`), so nothing here would have
 * caught this and nothing would catch it coming back. It came back once
 * already: every chip shipped `text-<hue>-600` on its own `bg-<hue>-500/10`
 * tint, which measures 2.94–3.98:1 on the real page — under the 4.5:1 AA floor
 * for body text. Six of nine hues failed. Dark mode was always fine
 * (`-300`, 9.35–11.66:1), which is exactly why it survived review: the site
 * boots dark, so the broken mode is the one nobody looks at.
 *
 * Measured on the built page at `--color-<hue>-500` at 10% over white:
 *
 *   hue       -600    -700    (AA floor 4.5)
 *   amber     2.96    4.66
 *   emerald   3.32    4.87
 *   teal      3.34    4.88
 *   cyan      3.31    4.82
 *   sky       3.63    5.29
 *   pink      3.98    5.18
 *   rose      3.91    5.21
 *   blue      4.66    —       (passed at -600, moved for consistency)
 *   violet    5.20    —       (passed at -600, moved for consistency)
 *
 * So: `-700` is the floor for light-mode text on a `/10` tint of its own hue.
 * This asserts the rung rather than the ratio because the rung is what a
 * future edit will get wrong — recomputing contrast needs a browser, and a
 * unit test that cannot measure should lock the decision, not re-derive it.
 */

const SRC = resolve(__dirname, '..');
const read = (relative: string): string =>
  readFileSync(resolve(SRC, relative), 'utf8');

/** Every file painting a tinted chip with hue-scale text. */
const CHIP_FILES = [
  'components/category-badge.tsx',
  'components/min-viewport-badge.tsx',
  'components/client-server-badge.tsx',
];

/** Hue scales used for tinted chips (excludes semantic tokens like `primary`). */
const HUE = '(?:emerald|amber|rose|sky|teal|cyan|blue|violet|pink)';

describe('tinted chip contrast', () => {
  for (const file of CHIP_FILES) {
    describe(file, () => {
      const source = read(file);

      it('uses no light-mode hue text lighter than -700', () => {
        // Unprefixed `text-<hue>-<n>` — i.e. the LIGHT mode value. A `dark:`
        // prefix is matched and skipped, since dark mode uses -300 by design.
        const offenders = [
          ...source.matchAll(new RegExp(`(^|[^:\\w-])text-(${HUE})-(\\d{3})`, 'g')),
        ]
          .map((m) => ({ hue: m[2], rung: Number(m[3]), text: `text-${m[2]}-${m[3]}` }))
          .filter((m) => m.rung < 700);

        expect(
          offenders.map((o) => o.text),
          `${file}: light-mode chip text below the -700 floor. ` +
            'These fail WCAG AA (4.5:1) on their own /10 tint — see the table ' +
            'at the top of this file.',
        ).toEqual([]);
      });

      it('still pairs every light rung with a dark: counterpart', () => {
        const light = [
          ...source.matchAll(new RegExp(`(^|[^:\\w-])text-(${HUE})-\\d{3}`, 'g')),
        ].length;
        const dark = [
          ...source.matchAll(new RegExp(`dark:text-(${HUE})-\\d{3}`, 'g')),
        ].length;

        // A light-only chip inherits the page foreground in dark mode, which
        // is how a hue silently stops being a hue.
        expect(dark, `${file}: ${light} light rung(s) but ${dark} dark rung(s)`).toBe(
          light,
        );
      });
    });
  }
});
