/**
 * WeaveTexture: a quiet plain weave behind a section.
 *
 * Locks what the cloth promises: it is drawn on the server with nothing to
 * hydrate, it is coloured only from the strand and page tokens, the tile is
 * a real plain weave (the thread on top alternates like a checkerboard), and
 * every knob is an enum that maps to a fixed size, strength or fade.
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { WeaveTexture } from '../src/effects/weave-texture.js';

afterEach(cleanup);

const svgOf = (el: React.ReactElement) => render(el).container.querySelector('svg')!;

describe('WeaveTexture', () => {
  it('renders on the server as one pattern and one fill', () => {
    const html = renderToStaticMarkup(<WeaveTexture />);
    expect(html).toContain('<pattern');
    expect(html).toContain('data-slot="weave-texture"');
    expect(html.match(/<pattern/g)).toHaveLength(1);
  });

  it('is a server component', () => {
    const src = readFileSync(resolve(__dirname, '../src/effects/weave-texture.tsx'), 'utf8');
    expect(src).not.toMatch(/^['"]use client['"]/m);
  });

  it('is hidden, inert to the pointer and out of the tab order', () => {
    const svg = svgOf(<WeaveTexture />);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.getAttribute('class')).toContain('pointer-events-none');
    expect(svg.getAttribute('class')).toContain('absolute');
  });

  it('colours the cloth from tokens only', () => {
    const svg = svgOf(<WeaveTexture />);
    const fills = [...svg.querySelectorAll('pattern rect')].map((r) => r.getAttribute('fill'));
    expect(new Set(fills)).toEqual(new Set(['var(--strand-a)', 'var(--strand-b)']));
    const edges = [...svg.querySelectorAll('pattern line')].map((l) => l.getAttribute('stroke'));
    expect(new Set(edges)).toEqual(new Set(['var(--background)']));
  });

  it('weaves: the top thread alternates warp, weft, weft, warp across the four cells', () => {
    const svg = svgOf(<WeaveTexture />);
    const lines = [...svg.querySelectorAll('pattern line')];
    // Two edges per crossing, four crossings.
    expect(lines).toHaveLength(8);
    const vertical = lines.map((l) => l.getAttribute('x1') === l.getAttribute('x2'));
    expect(vertical).toEqual([true, true, false, false, false, false, true, true]);
  });

  it.each([
    ['fine', 16],
    ['default', 24],
    ['coarse', 40],
  ] as const)('density %s sets a %ipx tile', (density, size) => {
    const pattern = svgOf(<WeaveTexture density={density} />).querySelector('pattern')!;
    expect(pattern.getAttribute('width')).toBe(String(size));
    expect(pattern.getAttribute('patternUnits')).toBe('userSpaceOnUse');
  });

  it.each([
    ['faint', '0.06'],
    ['default', '0.1'],
    ['strong', '0.18'],
  ] as const)('strength %s sets opacity %s', (strength, opacity) => {
    const fill = svgOf(<WeaveTexture strength={strength} />).querySelector(':scope > rect')!;
    expect(fill.getAttribute('opacity')).toBe(opacity);
  });

  it('fills from its own pattern, so two textures on a page do not share one', () => {
    const { container } = render(
      <>
        <WeaveTexture density="fine" />
        <WeaveTexture density="coarse" />
      </>,
    );
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
    const fills = [...container.querySelectorAll('svg > rect')].map((r) => r.getAttribute('fill'));
    expect(fills).toEqual(ids.map((id) => `url(#${id})`));
  });

  it.each([
    ['none', null],
    ['edges', 'radial-gradient'],
    ['bottom', 'linear-gradient'],
  ] as const)('fade %s', (fade, mask) => {
    const cls = svgOf(<WeaveTexture fade={fade} />).getAttribute('class')!;
    if (mask) expect(cls).toContain(mask);
    else expect(cls).not.toContain('mask-image');
  });

  it('merges className and forwards props, but cannot be un-hidden', () => {
    const svg = svgOf(
      // @ts-expect-error aria-hidden is omitted from the props on purpose
      <WeaveTexture className="extra" data-testid="cloth" aria-hidden={false} />,
    );
    expect(svg.getAttribute('class')).toContain('extra');
    expect(svg.getAttribute('data-testid')).toBe('cloth');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
