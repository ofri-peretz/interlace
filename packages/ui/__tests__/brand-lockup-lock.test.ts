/**
 * Brand Lockup Lock
 *
 * Every *.interlace.tools surface renders the SAME brand header: the locked
 * two-bar mark (viewBox 0 0 100 100, two rx-14 bars rotated −30°) + the
 * lowercase monospace wordmark "interlace". Canonical component:
 * `packages/ui/src/patterns/brand-logo.tsx`; bar fills read the
 * `--brand-mark-bar-o/g` custom properties (the cross-repo contract — the
 * eslint docs site defines the same two names).
 *
 * This lock pins the wiring, not the pixels:
 *  - the registry nav consumes BrandLogo (no hand-copied SVG drift),
 *  - the landing nav carries the locked geometry + token fills,
 *  - both token layers define the bar fills in light AND dark,
 *  - the Storybook manager lockup keeps the wordmark.
 *
 * Mirrors `nav-brand-lock.test.tsx` in the eslint repo. If you're changing
 * the mark itself, that's a brand decision — update every consumer and the
 * eslint repo in the same campaign, then update this lock.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf8');

describe('brand lockup lock', () => {
  it('brand-logo.tsx keeps the locked geometry + token fills', () => {
    const src = read('packages/ui/src/patterns/brand-logo.tsx');
    expect(src).toContain('rotate(-30 50 50)');
    expect(src).toContain('var(--brand-mark-bar-o)');
    expect(src).toContain('var(--brand-mark-bar-g)');
    expect(src).toMatch(/lowercase[^"']*"/);
    expect(src).toMatch(/>\s*interlace\s*<\/span>/);
  });

  it('registry nav renders the shared BrandLogo', () => {
    const nav = read('apps/registry/src/components/site-nav.tsx');
    expect(nav).toContain("from '@interlace/ui/patterns/brand-logo'");
    expect(nav).toContain('<BrandLogo');
  });

  it('landing nav carries the locked mark + wordmark', () => {
    const layout = read('apps/landing/src/lib/layout.shared.tsx');
    expect(layout).toContain('rotate(-30 50 50)');
    expect(layout).toContain('var(--brand-mark-bar-o)');
    expect(layout).toContain('interlace');
  });

  it('both token layers define the bar fills in light and dark', () => {
    const theme = read('packages/ui/styles/interlace-theme.css');
    // Brand layer: one light + one dark value per bar.
    expect(theme.match(/--interlace-brand-mark-bar-o:/g)?.length).toBe(2);
    expect(theme.match(/--interlace-brand-mark-bar-g:/g)?.length).toBe(2);
    // Semantics layer: the unprefixed cross-repo names.
    expect(theme).toContain(
      '--brand-mark-bar-o: var(--interlace-brand-mark-bar-o)',
    );

    const landing = read('apps/landing/src/app/global.css');
    expect(landing.match(/--brand-mark-bar-o:/g)?.length).toBe(2);
    expect(landing.match(/--brand-mark-bar-g:/g)?.length).toBe(2);
  });

  it('storybook manager lockup keeps the wordmark', () => {
    const svg = read('apps/storybook/public/interlace-mark.svg');
    expect(svg).toContain('rotate(-30 50 50)');
    expect(svg).toContain('>interlace</text>');

    const theme = read('apps/storybook/.storybook/theme.ts');
    expect(theme).toContain("brandTitle: 'interlace'");
  });
});
