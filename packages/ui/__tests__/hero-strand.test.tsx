import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
/**
 * HeroStrand locks — the decorative contract, the dash-math contract
 * (the production-weave lessons), and the named draw-verb motion token.
 */
import { describe, expect, it } from 'vitest';

import { HeroStrand } from '../src/effects/hero-strand.js';

const html = renderToStaticMarkup(<HeroStrand data-testid="hs" />);
const woven = renderToStaticMarkup(<HeroStrand data-testid="hs" counter />);

describe('decorative contract', () => {
  it('is aria-hidden and never intercepts the pointer', () => {
    expect(html).toMatch(/aria-hidden="true"/);
    expect(html).toContain('pointer-events-none');
  });

  it('a consumer cannot un-hide the decoration through ...rest', () => {
    // aria-hidden sits AFTER the spread (review): always-decorative,
    // full stop.
    // No @ts-expect-error here on purpose: TS accepts aria-* JSX
    // attributes even against the Omit (verified empirically), which is
    // exactly why the RUNTIME guard is the enforced layer this pins.
    const overridden = renderToStaticMarkup(
      <HeroStrand data-testid="hs" aria-hidden={false} />,
    );
    expect(overridden).toMatch(/aria-hidden="true"/);
    expect(overridden).not.toMatch(/aria-hidden="false"/);
  });

  it('lead strand always; counter only when asked', () => {
    expect(html).toContain('data-slot="hero-strand-lead"');
    expect(html).not.toContain('hero-strand-counter');
    expect(woven).toContain('data-slot="hero-strand-counter"');
  });

  it('strand tokens only, never raw color', () => {
    expect(woven).toContain('stroke-strand-a');
    expect(woven).toContain('stroke-strand-b');
    expect(woven).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('dash math (interlace#56/#726 lessons)', () => {
  it('every path normalizes with pathLength=100 and a matching dasharray', () => {
    const paths = woven.match(/<path[^>]*>/g) ?? [];
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(p).toContain('pathLength="100"');
      expect(p).toContain('[stroke-dasharray:100]');
      expect(p).toContain('[stroke-dashoffset:100]');
    }
  });

  it('never uses vector-effect — Chromium screen-space dashes discard pathLength', () => {
    expect(woven).not.toContain('vector-effect');
  });

  it('the counter starts behind the lead, same verb', () => {
    expect(woven).toContain('[animation-delay:200ms]');
  });
});

describe('the draw verb is a named motion token', () => {
  const tokens = readFileSync(
    path.resolve(__dirname, '..', 'styles', 'tokens.css'),
    'utf-8',
  );

  it('paths animate via the token utility, not ad-hoc animation values', () => {
    expect(woven).toContain('animate-strand-draw');
    expect(woven).not.toContain('[animation:');
  });

  it('tokens.css defines strand-draw: 100→0 inside the 600ms ceiling', () => {
    expect(tokens).toContain('--animate-strand-draw: strand-draw 600ms');
    expect(tokens).toMatch(
      /@keyframes strand-draw \{\s*from \{\s*stroke-dashoffset: 100;\s*\}\s*to \{\s*stroke-dashoffset: 0;\s*\}/,
    );
  });
});
