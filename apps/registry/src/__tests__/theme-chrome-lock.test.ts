import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The registry site's half of the theme contract (Phase 8.4).
 *
 * Everything asserted here is invisible when it breaks, which is the only
 * reason to spend a test on wiring:
 *
 *   - a `<head>` script that drifts from the DS one still WORKS, in the sense
 *     that the page renders. It just renders the wrong theme for a frame on
 *     every load, and only for users who chose a non-default one — i.e. never
 *     for the person reviewing the change.
 *
 *   - a switcher missing from one header is a page where the theme system
 *     appears not to exist. `/c/<name>` is the page that matters most and is
 *     also the one page that does NOT use `SiteNav`, so "it's in the nav" is
 *     not the same statement as "it is on every page".
 *
 *   - a preview iframe that does not carry the theme across the origin
 *     boundary renders the default brand under a re-themed page. Nothing
 *     errors; the reader just concludes the theming does not work.
 *
 * Source-text assertions rather than imports: these are `.tsx` client
 * modules and this suite runs in `environment: 'node'` with no JSX
 * transform. The trade is that a rename can pass — hence matching on the
 * import specifier, which is the part a rename cannot leave behind.
 */

const SRC = resolve(__dirname, '..');
const read = (relative: string): string =>
  readFileSync(resolve(SRC, relative), 'utf8');

/** Every file that renders a persistent site header. */
const HEADERS = ['components/site-nav.tsx', 'app/c/[name]/page.tsx'];

describe('no-flash bootstrap', () => {
  const layout = read('app/layout.tsx');

  it('inlines the DS THEME_SCRIPT in <head>', () => {
    expect(layout).toContain("from '@interlace/ui/theme-script'");
    expect(layout).toContain('THEME_SCRIPT');
    expect(layout).toMatch(
      /<script\s+dangerouslySetInnerHTML=\{\{\s*__html:\s*THEME_SCRIPT\s*\}\}\s*\/>/,
    );
  });

  it('does not hand-roll a second one', () => {
    // The local script this replaced toggled `.dark` off `prefers-color-scheme`
    // and knew nothing about `data-theme` or a stored preference. A copy that
    // drifts from the registry is worse than no copy: it paints confidently,
    // and it paints the wrong brand.
    // Matched on the MECHANISM, not on the phrase: both files still discuss
    // `prefers-color-scheme` in prose, and a lock that cannot tell a comment
    // from a statement teaches people to delete the comment.
    expect(layout).not.toContain('matchMedia');
    expect(layout).not.toContain('const THEME_SCRIPT');
  });

  it('keeps suppressHydrationWarning on <html>', () => {
    // The script mutates the element React is about to hydrate. Without this,
    // React logs a hydration mismatch on every load in every consumer app.
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning/);
  });
});

describe('the switcher is on every page', () => {
  it.each(HEADERS)('%s renders <ThemeSwitcher>', (file) => {
    const source = read(file);
    expect(source).toContain("from '@interlace/ui/theme-switcher'");
    expect(source).toContain('<ThemeSwitcher');
  });

  it('uses the DS primitive rather than a bespoke control', () => {
    // A docs site whose own controls are hand-rolled is a docs site that has
    // stopped exercising what it documents.
    for (const file of HEADERS) {
      expect(read(file)).not.toMatch(/function\s+ThemeSwitcher/);
    }
  });
});

describe('previews carry the theme across the origin boundary', () => {
  const preview = read('components/story-preview.tsx');

  it('reads both axes from the same hook the switcher writes', () => {
    expect(preview).toContain("from '@interlace/ui/use-theme'");
    expect(preview).toContain('useTheme()');
  });

  it('no longer follows the OS behind the reader’s back', () => {
    // It used to query the OS directly, which is right often enough to hide
    // the bug and wrong exactly when someone uses the switcher. `useTheme`
    // already resolves the OS preference — a second `matchMedia` here would
    // be a second source of truth for the same value.
    expect(preview).not.toContain('matchMedia');
  });

  it('passes the theme to Storybook as a declared global', () => {
    // `interlaceTheme` is declared in `globalTypes`
    // (apps/storybook/.storybook/preview.ts). Storybook silently DROPS a URL
    // global it has no declaration for — which is why the scheme axis rides
    // on the `--dark` story instead.
    expect(preview).toContain('interlaceTheme:');
    expect(preview).toContain("query.set('globals'");
  });

  it('keeps the deployed Storybook as the default origin', () => {
    // The env override exists so a local registry can point at a local
    // Storybook. Production must not depend on it being set.
    expect(preview).toContain('process.env.NEXT_PUBLIC_STORYBOOK_URL');
    // `||` rather than `??`: `.env.example` ships the key EMPTY, and an empty
    // string is not nullish. `??` would take it and point every preview frame
    // at the registry's own origin.
    expect(preview).toContain("|| 'https://storybook.interlace.tools'");
    expect(preview).not.toContain('NEXT_PUBLIC_STORYBOOK_URL ??');
  });
});

describe('theme authoring docs', () => {
  const page = read('app/theme-authoring/page.tsx');

  it('derives the token manifest instead of transcribing it', () => {
    // A hand-typed list of 55 token names is a list that is wrong the first
    // time a token is added, and convincingly wrong.
    expect(page).toContain("from '@interlace/ui/theme-tokens'");
    expect(page).toContain('THEME_TOKENS.length');
  });

  it('documents the subtree selector the default theme cannot express', () => {
    expect(page).toContain("[data-theme='X'] .dark");
  });
});
