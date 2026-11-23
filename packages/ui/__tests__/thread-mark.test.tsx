/**
 * ThreadMark: the thread drawn as a state.
 *
 * Locks what each state draws (two strands only when woven, one strand when
 * loose or cut), that the mark is always hidden and never carries meaning on
 * its own, that only `drawing` moves, and that sizes are a fixed enum.
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { ThreadMark, type ThreadMarkState } from '../src/primitives/thread-mark.js';

afterEach(cleanup);

const svgOf = (el: React.ReactElement) => render(el).container.querySelector('svg')!;
const strokes = (svg: SVGSVGElement) =>
  [...svg.querySelectorAll('path')].map((p) => p.getAttribute('class') ?? '');

describe('ThreadMark', () => {
  it('is a server component', () => {
    const src = readFileSync(resolve(__dirname, '../src/primitives/thread-mark.tsx'), 'utf8');
    expect(src).not.toMatch(/^['"]use client['"]/m);
    expect(renderToStaticMarkup(<ThreadMark />)).toContain('data-slot="thread-mark"');
  });

  it('defaults to a woven mark at md', () => {
    const svg = svgOf(<ThreadMark />);
    expect(svg.getAttribute('data-state')).toBe('woven');
    expect(svg.getAttribute('class')).toContain('h-5');
  });

  it('weaves two strands, one of each colour, knotted at both ends', () => {
    const svg = svgOf(<ThreadMark state="woven" />);
    const classes = strokes(svg);
    expect(classes).toHaveLength(2);
    expect(classes[0]).toContain('stroke-strand-a');
    expect(classes[1]).toContain('stroke-strand-b');
    expect(classes.join(' ')).not.toContain('animate-');
    expect(svg.querySelectorAll('circle')).toHaveLength(2);
  });

  it('loops the woven pair only while drawing', () => {
    const classes = strokes(svgOf(<ThreadMark state="drawing" />));
    expect(classes).toHaveLength(2);
    for (const c of classes) expect(c).toContain('animate-strand-loop');
  });

  it.each(['loose', 'cut'] as const)(
    'draws %s as a single strand in strand-a, never strand-b, and still',
    (state) => {
      const classes = strokes(svgOf(<ThreadMark state={state} />)).join(' ');
      expect(classes).toContain('stroke-strand-a');
      expect(classes).not.toContain('strand-b');
      expect(classes).not.toContain('animate-');
    },
  );

  it('leaves a loose end: one knot, not two', () => {
    expect(svgOf(<ThreadMark state="loose" />).querySelectorAll('circle')).toHaveLength(1);
    expect(svgOf(<ThreadMark state="cut" />).querySelectorAll('circle')).toHaveLength(2);
  });

  it.each([
    ['sm', 'h-3'],
    ['md', 'h-5'],
    ['lg', 'h-12'],
  ] as const)('size %s', (size, cls) => {
    expect(svgOf(<ThreadMark size={size} />).getAttribute('class')).toContain(cls);
  });

  it.each(['woven', 'drawing', 'loose', 'cut'] satisfies ThreadMarkState[])(
    '%s is hidden from assistive tech and cannot be un-hidden',
    (state) => {
      const svg = svgOf(
        // @ts-expect-error aria-hidden is omitted from the props on purpose
        <ThreadMark state={state} aria-hidden={false} className="extra" data-testid="m" />,
      );
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
      expect(svg.getAttribute('class')).toContain('extra');
      expect(svg.getAttribute('data-testid')).toBe('m');
    },
  );

  it('colours from tokens only', () => {
    const src = readFileSync(resolve(__dirname, '../src/primitives/thread-mark.tsx'), 'utf8');
    expect(src).not.toMatch(/#[0-9a-f]{3,8}\b|oklch\(|rgb\(/i);
  });
});
