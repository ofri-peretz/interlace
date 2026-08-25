/**
 * InterlaceWeave locks — the brand gesture's contract (R26).
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InterlaceWeave } from '../src/effects/interlace-weave.js';

describe('InterlaceWeave static markup', () => {
  const html = renderToStaticMarkup(<InterlaceWeave data-testid="w" />);

  it('is decorative: aria-hidden and pointer-events-none', () => {
    expect(html).toContain('aria-hidden');
    expect(html).toContain('pointer-events-none');
  });

  it('draws two strands in the brand token pair, never raw color', () => {
    expect(html).toContain('stroke-strand-a');
    expect(html).toContain('stroke-strand-b');
    // strand-b exists so the weave never strokes chart-2 (emerald = the
    // success status hue; status colors are never decorative)
    expect(html).not.toContain('chart-2');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('strand B starts at the opposite corner (the weave crossing)', () => {
    expect(html).toContain('rotate-180');
    expect(html).toContain('origin-center');
  });

  it('reveals on hover AND focus-within, and respects reduced motion', () => {
    expect(html).toContain('group-hover/weave:[stroke-dashoffset:0]');
    expect(html).toContain('group-focus-within/weave:[stroke-dashoffset:0]');
    expect(html).toContain('motion-reduce:transition-none');
  });

  it('rest state is truly hidden — parking offset sits inside the gap', () => {
    // Pattern position is (s + offset); with dash 55 / gap 155 the
    // blank-at-rest offsets are [55, 110], POSITIVE. Three prior cuts
    // shipped visibly drawn at rest (modular 100-period pattern, then
    // two sign-flipped parks) — every one caught only by rendering.
    expect(html).toContain('[stroke-dasharray:55_155]');
    expect(html).toContain('[stroke-dashoffset:55]');
    expect(html).not.toContain('[stroke-dashoffset:-');
  });

  it('geometry is unscaled px — pathLength stays honored for dashes', () => {
    // No viewBox → no scale transform. With a scaled viewBox +
    // non-scaling-stroke, Chromium computes dashes in screen space and
    // the pathLength-unit dash math silently breaks (caught by render).
    expect(html).not.toContain('viewBox');
    expect(html).not.toContain('non-scaling-stroke');
    // Underscore form: Tailwind arbitrary values encode the spaces that
    // calc() requires around the operator — calc(100%-2px) is invalid CSS.
    expect(html).toContain('[width:calc(100%_-_2px)]');
  });

  it('normalizes path units so the dash math is size-independent', () => {
    expect(html.match(/pathLength="100"/g)?.length).toBe(2);
  });
});
