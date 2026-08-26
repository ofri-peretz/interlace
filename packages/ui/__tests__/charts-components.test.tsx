/**
 * charts/* components — the rendered contract.
 *
 * `charts-scale.test.ts` proves the numbers. This proves the things a reader
 * actually receives: the accessible name, the data table behind the picture,
 * the keyboard path to every value, and the fact that direction is never
 * communicated by colour alone.
 *
 * The bar these are written to (learned the hard way in this repo's 1.1/1.2
 * waves): axe reads an SVG as one opaque node and cannot press a key, so a
 * chart can score green while its values are unreachable. Everything below is
 * a thing axe would not have caught.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Delta, toneFor } from '../src/charts/delta.js';
import { Distribution, type DistributionBin } from '../src/charts/distribution.js';
import { MetricTable } from '../src/charts/metric-table.js';
import { RadialWeave } from '../src/charts/radial-weave.js';
import { SeriesTable } from '../src/charts/series-table.js';
import { Sparkline } from '../src/charts/sparkline.js';
import { TimeSeries } from '../src/charts/time-series.js';
import type { Point } from '../src/charts/scale.js';

afterEach(cleanup);

/**
 * jsdom implements no `PointerEvent`, so `fireEvent.pointerMove` dispatches a
 * bare `Event` and every coordinate arrives `undefined` — the handler silently
 * no-ops and the test passes for the wrong reason.
 *
 * The component is correct to use pointer events (they cover mouse, touch and
 * pen in one path); the environment is what is missing. Minimal shim rather
 * than a dependency: only the coordinate fields the crosshair reads.
 */
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

const series = (...values: (number | null)[]): Point[] =>
  values.map((v, i) => ({ t: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`, v }));

/** jsdom gives every element a 0×0 box, which would make pointer math a no-op. */
function withLayout(width = 900) {
  return vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ left: 0, top: 0, width, height: 220, right: width, bottom: 220, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
}

/* ── Sparkline ──────────────────────────────────────────────────────────── */

describe('Sparkline', () => {
  it('names the trend in words, so direction survives without colour', () => {
    render(<Sparkline points={series(10, 20)} label="Views" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('up 10');
  });

  it('leaves the accessibility tree entirely when decorative', () => {
    // In a MetricTable row the value and delta cells already announce this.
    // A second announcement is noise, not redundancy.
    const { container } = render(<Sparkline points={series(1, 2)} decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('reserves its footprint when there is no trend to draw, so the table does not reflow', () => {
    const { container } = render(<Sparkline points={series(5)} width={90} height={22} />);
    const placeholder = container.querySelector('[data-slot="sparkline-empty"]');
    expect(placeholder).not.toBeNull();
    expect((placeholder as HTMLElement).style.width).toBe('90px');
  });

  it('renders nothing plottable for an empty series rather than throwing', () => {
    const { container } = render(<Sparkline points={[]} />);
    expect(container.querySelector('[data-slot="sparkline-empty"]')).not.toBeNull();
  });

  it('marks a decline so the tone class and data attribute agree', () => {
    render(<Sparkline points={series(20, 5)} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('data-direction')).toBe('down');
    expect(svg.getAttribute('class')).toContain('text-viz-negative');
  });

  it('paints a flat series neutral — it is neither a win nor a loss', () => {
    // It used to render green, which quietly congratulated the reader for a
    // metric that had not moved, AND disagreed with the neutral "–" its own
    // Delta shows in the same row.
    render(<Sparkline points={series(7, 7)} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('data-direction')).toBe('flat');
    expect(svg.getAttribute('class')).toContain('text-viz-neutral');
  });

  it('keeps the caller className alongside the DS classes', () => {
    render(<Sparkline points={series(1, 2)} className="mx-2" />);
    const cls = screen.getByRole('img').getAttribute('class') ?? '';
    expect(cls).toContain('mx-2');
    expect(cls).toContain('align-middle');
  });

  it('honours polarity, so a row cannot say "good" and "bad" at the same time', () => {
    // Before this, Sparkline coloured purely by direction: an inverse-polarity
    // row rendered a RED line beside a GREEN delta. Every unit test passed and
    // it was obvious the moment anyone looked at the table.
    render(<Sparkline points={series(84, 19)} polarity="inverse" label="Open issues" />);
    expect(screen.getByRole('img').getAttribute('class')).toContain('text-viz-positive');
  });

  it('reserves the exact inline cell while loading, so the column does not reflow', () => {
    // A spinner here would collapse the cell and shift every row beside it the
    // moment the metric arrives.
    const { container } = render(<Sparkline points={[]} loading />);
    const skeleton = container.querySelector('[data-slot="sparkline"]');
    expect(skeleton?.getAttribute('class')).toContain('w-[90px]');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('forwards a ref to the svg element', () => {
    const ref = { current: null as SVGSVGElement | null };
    render(<Sparkline points={series(1, 2)} ref={ref} />);
    expect(ref.current?.tagName.toLowerCase()).toBe('svg');
  });
});

/* ── Delta ──────────────────────────────────────────────────────────────── */

describe('Delta', () => {
  it('maps direction to tone under normal polarity', () => {
    expect(toneFor('up', 'normal')).toBe('good');
    expect(toneFor('down', 'normal')).toBe('bad');
    expect(toneFor('flat', 'normal')).toBe('flat');
  });

  it('inverts tone for metrics where down is good', () => {
    // The bug this prevents: a dashboard painting rising latency green.
    expect(toneFor('up', 'inverse')).toBe('bad');
    expect(toneFor('down', 'inverse')).toBe('good');
    expect(toneFor('flat', 'inverse')).toBe('flat');
  });

  it('says why there is no comparison instead of showing a bare dash', () => {
    render(<Delta points={series(5)} />);
    expect(screen.getByText('Not enough data to compare')).toBeTruthy();
  });

  it('announces a full sentence while the glyph and digits stay decorative', () => {
    const { container } = render(<Delta points={series(100, 150)} unit="views" />);
    expect(screen.getByText(/up 50 views, 50.0%, from 100 to 150/)).toBeTruthy();
    // Screen readers must not hear "▲ + 1 5 0" before the sentence.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(2);
  });

  it('carries direction in a glyph as well as a colour', () => {
    const { container: up } = render(<Delta points={series(1, 2)} />);
    expect(up.textContent).toContain('▲');
    cleanup();
    const { container: down } = render(<Delta points={series(2, 1)} />);
    expect(down.textContent).toContain('▼');
    cleanup();
    const { container: flat } = render(<Delta points={series(2, 2)} />);
    expect(flat.textContent).toContain('–');
  });

  it('uses a real minus sign, not a hyphen, for a decrease', () => {
    const { container } = render(<Delta points={series(10, 4)} />);
    expect(container.textContent).toContain('−6');
  });

  it('suppresses the percentage when asked', () => {
    const { container } = render(<Delta points={series(100, 150)} percent={false} />);
    expect(container.querySelector('[data-slot="delta"]')?.textContent).not.toContain('(');
  });

  it('omits the percentage when the baseline is zero rather than printing Infinity', () => {
    const { container } = render(<Delta points={series(0, 9)} />);
    expect(container.textContent).not.toContain('Infinity');
    expect(container.textContent).not.toContain('%');
  });

  it('says "unchanged" for a flat series', () => {
    render(<Delta points={series(3, 3)} unit="views" />);
    expect(screen.getByText('unchanged views')).toBeTruthy();
  });

  it('reflects the tone decision in a data attribute callers can style on', () => {
    const { container } = render(<Delta points={series(1, 5)} polarity="inverse" />);
    expect(container.querySelector('[data-slot="delta"]')?.getAttribute('data-tone')).toBe('bad');
  });

  it('keeps the caller className on both the populated and empty forms', () => {
    const { container } = render(<Delta points={series(1)} className="ml-1" />);
    expect(container.querySelector('[data-slot="delta-empty"]')?.getAttribute('class')).toContain('ml-1');
  });

  it('forwards a ref', () => {
    const ref = { current: null as HTMLSpanElement | null };
    render(<Delta points={series(1, 2)} ref={ref} />);
    expect(ref.current?.getAttribute('data-slot')).toBe('delta');
  });
});

/* ── SeriesTable ────────────────────────────────────────────────────────── */

describe('SeriesTable', () => {
  it('is a real table with scoped headers, not a grid of divs', () => {
    render(<SeriesTable caption="Views" series={[{ label: 'Views', points: series(1, 2) }]} hidden={false} />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Date' })).toBeTruthy();
    expect(within(table).getAllByRole('rowheader').map((h) => h.textContent)).toEqual([
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  it('is present to a screen reader but out of the layout by default', () => {
    const { container } = render(
      <SeriesTable caption="Views" series={[{ label: 'Views', points: series(1, 2) }]} />,
    );
    expect(container.querySelector('[data-slot="series-table"]')?.getAttribute('class')).toContain('sr-only');
    // Still queryable — sr-only is not `hidden`.
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('spells out a gap instead of using an em dash a screen reader skips', () => {
    render(<SeriesTable caption="Views" series={[{ label: 'Views', points: series(1, null, 3) }]} />);
    expect(screen.getByText('No data')).toBeTruthy();
  });

  it('aligns two series on a shared date axis even when one starts late', () => {
    render(
      <SeriesTable
        caption="Both"
        hidden={false}
        series={[
          { label: 'A', points: series(1, 2, 3) },
          { label: 'B', points: [{ t: '2026-08-03T00:00:00Z', v: 9 }] },
        ]}
      />,
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
    // B is absent on the first two days — both gaps are spelled out.
    expect(screen.getAllByText('No data')).toHaveLength(2);
  });

  it('accepts a custom key column label', () => {
    render(<SeriesTable caption="c" keyLabel="Week" series={[{ label: 'A', points: series(1) }]} />);
    expect(screen.getByRole('columnheader', { name: 'Week' })).toBeTruthy();
  });

  it('forwards a ref and merges className', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<SeriesTable ref={ref} className="mt-4" caption="c" series={[{ label: 'A', points: series(1) }]} />);
    expect(ref.current?.className).toContain('mt-4');
  });
});

/* ── TimeSeries ─────────────────────────────────────────────────────────── */

describe('TimeSeries', () => {
  it('explains why it cannot plot rather than rendering an empty box', () => {
    render(<TimeSeries points={[]} />);
    expect(screen.getByText(/No data yet/)).toBeTruthy();
    expect(screen.getByText(/cannot be back-filled/)).toBeTruthy();
  });

  it('says how many points it has when there is one', () => {
    render(<TimeSeries points={series(5)} />);
    expect(screen.getByText(/Only 1 point so far/)).toBeTruthy();
  });

  it('keeps the caller className on the empty state', () => {
    const { container } = render(<TimeSeries points={[]} className="mb-6" />);
    expect(container.querySelector('[data-slot="time-series-empty"]')?.className).toContain('mb-6');
  });

  it('tells the reader the keyboard works, in the accessible name', () => {
    render(<TimeSeries points={series(1, 2, 3)} label="Views" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('arrow keys');
  });

  it('ships the underlying data as a table, so the chart is lossless', () => {
    render(<TimeSeries points={series(1, 2)} label="Views" unit="views" />);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Views — full data (views)')).toBeTruthy();
  });

  it('can show that table visibly', () => {
    const { container } = render(<TimeSeries points={series(1, 2)} showTable />);
    expect(container.querySelector('[data-slot="series-table"]')?.className).not.toContain('sr-only');
  });

  it('renders no caption when unlabelled', () => {
    const { container } = render(<TimeSeries points={series(1, 2)} />);
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('reads out a value under arrow-key control — the path axe cannot test', async () => {
    const user = userEvent.setup();
    render(<TimeSeries points={series(10, 20, 30)} label="Views" unit="views" />);
    const svg = screen.getByRole('img');
    svg.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('2026-08-02 · 20 views')).toBeTruthy();
  });

  it('steps back, and clamps at the first point instead of wrapping', async () => {
    const user = userEvent.setup();
    render(<TimeSeries points={series(10, 20, 30)} />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowRight}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(screen.getByText('2026-08-01 · 10')).toBeTruthy();
  });

  it('jumps to either end with Home and End', async () => {
    const user = userEvent.setup();
    render(<TimeSeries points={series(10, 20, 30)} />);
    screen.getByRole('img').focus();
    await user.keyboard('{End}');
    expect(screen.getByText('2026-08-03 · 30')).toBeTruthy();
    await user.keyboard('{Home}');
    expect(screen.getByText('2026-08-01 · 10')).toBeTruthy();
  });

  it('clears the crosshair on Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<TimeSeries points={series(10, 20)} />);
    screen.getByRole('img').focus();
    await user.keyboard('{End}');
    await user.keyboard('{Escape}');
    expect(container.querySelector('output')?.textContent).toBe('');
  });

  it('draws in through a clip whose resting state is fully revealed', () => {
    const { container } = render(<TimeSeries points={series(1, 2, 3)} />);
    const rect = container.querySelector('clipPath rect');
    // The reveal is the from-only `weave-reveal` keyframe: no animation at
    // all (this very jsdom run, reduced motion) rests at the open state.
    expect(rect?.getAttribute('class')).toContain('animate-weave-reveal');
    expect(rect?.getAttribute('class')).toContain('origin-left');
    // The plotted series is clipped by THAT rect's clipPath, not by luck.
    const id = container.querySelector('clipPath')?.getAttribute('id');
    expect(container.querySelector(`[clip-path="url(#${id})"] path`)).not.toBeNull();
  });

  it('replays the reveal by geometry VALUE, never by array identity', () => {
    const { container, rerender } = render(<TimeSeries points={series(1, 2, 3)} />);
    const before = container.querySelector('clipPath rect');
    // Same values in a fresh array — the normal parent re-render. The rect
    // must keep its DOM node, or every unrelated state change replays the draw.
    rerender(<TimeSeries points={series(1, 2, 3)} />);
    expect(container.querySelector('clipPath rect')).toBe(before);
    // A different y domain is a different weave: the rect remounts, which is
    // what restarts the CSS animation.
    rerender(<TimeSeries points={series(4, 5, 6)} />);
    expect(container.querySelector('clipPath rect')).not.toBe(before);
  });

  it('resets the crosshair when the geometry changes — old slots pair with old dates', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<TimeSeries points={series(10, 20, 30)} />);
    screen.getByRole('img').focus();
    await user.keyboard('{End}');
    expect(container.querySelector('output')?.textContent).toBe('2026-08-03 · 30');
    // One point fewer: slot 2 now names a date that does not exist. The
    // readout must empty rather than announce a stale pairing.
    rerender(<TimeSeries points={series(10, 20)} />);
    expect(container.querySelector('output')?.textContent).toBe('');
  });

  it('the crosshair glides on a transform transition, clamped for reduced motion', async () => {
    const user = userEvent.setup();
    const { container } = render(<TimeSeries points={series(10, 20, 30)} />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowRight}');
    const crosshair = container.querySelector(
      'g[transform^="translate("][class*="transition-transform"]',
    );
    expect(crosshair).not.toBeNull();
    expect(crosshair?.getAttribute('class')).toContain('motion-reduce:transition-none');
  });

  it('leaves unrelated keys to the page — a focused chart is not a keyboard trap', async () => {
    const user = userEvent.setup();
    const { container } = render(<TimeSeries points={series(10, 20)} />);
    screen.getByRole('img').focus();
    await user.keyboard('a');
    expect(container.querySelector('output')?.textContent).toBe('');
  });

  it('resolves a pointer position to the same point the keyboard would', () => {
    const spy = withLayout(900);
    const { container } = render(<TimeSeries points={series(10, 20, 30)} />);
    fireEvent.pointerMove(screen.getByRole('img'), { clientX: 900 });
    expect(container.querySelector('output')?.textContent).toContain('2026-08-03');
    spy.mockRestore();
  });

  it('ignores pointer movement when the chart has no layout box', () => {
    // A chart inside a collapsed/hidden parent must not divide by zero.
    const { container } = render(<TimeSeries points={series(10, 20)} />);
    fireEvent.pointerMove(screen.getByRole('img'), { clientX: 50 });
    expect(container.querySelector('output')?.textContent).toBe('');
  });

  it('clears the crosshair when the pointer leaves and when focus leaves', () => {
    const spy = withLayout(900);
    const { container } = render(<TimeSeries points={series(10, 20, 30)} />);
    const svg = screen.getByRole('img');
    fireEvent.pointerMove(svg, { clientX: 900 });
    fireEvent.pointerLeave(svg);
    expect(container.querySelector('output')?.textContent).toBe('');
    fireEvent.pointerMove(svg, { clientX: 900 });
    fireEvent.blur(svg);
    expect(container.querySelector('output')?.textContent).toBe('');
    spy.mockRestore();
  });

  it('draws an annotation on the matching day, with its kind in the label', () => {
    const { container } = render(
      <TimeSeries
        points={series(1, 2, 3)}
        annotations={[{ t: '2026-08-02T09:00:00Z', label: 'Shipped v2', kind: 'release' }]}
      />,
    );
    expect(container.querySelector('[data-annotation-kind="release"]')).not.toBeNull();
    // `getByTitle` only walks `svg > title`; ours is nested on the mark itself,
    // which is what makes it the shape's accessible name rather than the chart's.
    expect(container.querySelector('[data-annotation-kind="release"] title')?.textContent).toBe(
      '2026-08-02 — release: Shipped v2',
    );
  });

  it('defaults an untyped annotation to action rather than dropping it', () => {
    const { container } = render(
      <TimeSeries points={series(1, 2)} annotations={[{ t: '2026-08-01', label: 'Did a thing' }]} />,
    );
    expect(container.querySelector('[data-annotation-kind="action"]')).not.toBeNull();
  });

  it('renders each annotation kind with a distinct shape, not just a distinct hue', () => {
    // Hue alone is invisible in greyscale and to colour-blind readers.
    const { container } = render(
      <TimeSeries
        points={series(1, 2, 3)}
        annotations={[
          { t: '2026-08-01', label: 'a', kind: 'publish' },
          { t: '2026-08-02', label: 'b', kind: 'release' },
          { t: '2026-08-03', label: 'c', kind: 'action' },
        ]}
      />,
    );
    const shapes = [...container.querySelectorAll('[data-annotation-kind] path')].map((p) =>
      p.getAttribute('d'),
    );
    expect(new Set(shapes).size).toBe(3);
  });

  it('silently skips an annotation whose day is not in the series', () => {
    // A release from before the window is not an error; it is just off-screen.
    const { container } = render(
      <TimeSeries points={series(1, 2)} annotations={[{ t: '2020-01-01', label: 'ancient' }]} />,
    );
    expect(container.querySelector('[data-annotation-kind]')).toBeNull();
  });

  it('shows a chart-shaped placeholder while loading, not the empty-state copy', () => {
    // "No data yet" while the request is still in flight is a false statement
    // the reader has no way to check.
    const { container } = render(<TimeSeries points={[]} loading />);
    expect(container.querySelector('[data-slot="time-series"]')).not.toBeNull();
    expect(screen.queryByText(/No data yet/)).toBeNull();
  });

  it('keeps the caller className on the loading placeholder', () => {
    const { container } = render(<TimeSeries points={[]} loading className="mt-3" />);
    expect(container.querySelector('[data-slot="time-series"]')?.getAttribute('class')).toContain('mt-3');
  });

  it('forwards a ref to the figure', () => {
    const ref = { current: null as HTMLElement | null };
    render(<TimeSeries points={series(1, 2)} ref={ref} />);
    expect(ref.current?.getAttribute('data-slot')).toBe('time-series');
  });
});

/* ── TimeSeries — the x axis ────────────────────────────────────────────── */

/**
 * The labels themselves are HTML rather than SVG text because SVG text scales
 * with the `viewBox`: at a 320 viewport the plot is 288px against a 900-unit
 * box, so `text-xs` inside it paints at 4px. Measured in Chrome — jsdom reports
 * every box as 0×0 and would have scored the illegible version green.
 *
 * What jsdom CAN prove is everything below: that the labels exist, that they
 * are the slots `axisSlots` chose, that each has a tick to point at, and that
 * the ones dropped below `sm` are the middles rather than the ends.
 */
describe('TimeSeries x axis', () => {
  const axisSpans = (container: HTMLElement) => [
    ...container.querySelectorAll('[data-slot="time-series-axis"] span'),
  ];

  it('labels the horizontal scale at all — a shape with no x axis is not a chart', () => {
    const { container } = render(<TimeSeries points={series(1, 2, 3)} />);
    expect(axisSpans(container).map((s) => s.textContent)).toEqual(['08-01', '08-02', '08-03']);
  });

  it('caps the labels and keeps both ends, however long the series', () => {
    const { container } = render(
      <TimeSeries points={series(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)} />,
    );
    const labels = axisSpans(container).map((s) => s.textContent);
    expect(labels).toEqual(['08-01', '08-04', '08-08', '08-11', '08-14']);
  });

  it('drops the MIDDLE labels below sm, never an end — the ends are the range', () => {
    const { container } = render(
      <TimeSeries points={series(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)} />,
    );
    const hidden = axisSpans(container).map((s) => (s.className || '').includes('hidden'));
    expect(hidden).toEqual([false, true, false, true, false]);
  });

  it('keeps every label when there are few enough that none can collide', () => {
    const { container } = render(<TimeSeries points={series(1, 2, 3)} />);
    expect(axisSpans(container).every((s) => !(s.className || '').includes('hidden'))).toBe(true);
  });

  it('gives every label a tick to point at, so the position is not approximate', () => {
    const { container } = render(<TimeSeries points={series(1, 2, 3, 4, 5, 6, 7, 8)} />);
    expect(container.querySelectorAll('[data-slot="time-series-tick"]')).toHaveLength(
      axisSpans(container).length,
    );
  });

  it('stays out of the accessibility tree — the dates are in the table and the readout', () => {
    // Announcing "08-01 08-04 08-08" before the chart is noise; the same dates
    // are already reachable as row headers, in full.
    const { container } = render(<TimeSeries points={series(1, 2, 3)} />);
    expect(
      container.querySelector('[data-slot="time-series-axis"]')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('drops the year from the label but never from the caption', () => {
    // 10-character labels are what makes five of them collide at 320.
    const { container } = render(<TimeSeries points={series(1, 2, 3)} label="Views" />);
    expect(axisSpans(container)[0].textContent).toBe('08-01');
    expect(container.querySelector('figcaption')?.textContent).toContain('2026-08-01');
  });
});

/* ── TimeSeries — more than one series ──────────────────────────────────── */

const other = (...values: (number | null)[]): Point[] =>
  values.map((v, i) => ({ t: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`, v }));

describe('TimeSeries with compare', () => {
  const lines = (container: HTMLElement) => [
    ...container.querySelectorAll('[data-slot="time-series-plot"] g > path[stroke-width]'),
  ];

  it('draws a line per series, and `points` alone still means one line', () => {
    const { container: one } = render(<TimeSeries points={series(1, 2, 3)} />);
    expect(one.querySelector('[data-slot="time-series"]')?.getAttribute('data-series-count')).toBe(
      '1',
    );
    cleanup();
    const { container: two } = render(
      <TimeSeries points={series(1, 2, 3)} compare={[{ points: other(4, 5, 6), label: 'B' }]} />,
    );
    expect(two.querySelector('[data-slot="time-series"]')?.getAttribute('data-series-count')).toBe(
      '2',
    );
    expect(lines(two)).toHaveLength(2);
  });

  it('separates the lines by DASH as well as by hue', () => {
    // Two lines that differ only in `--chart-1` vs `--chart-2` are one line in
    // a greyscale print and to a red-green colour-blind reader.
    const { container } = render(
      <TimeSeries points={series(1, 2, 3)} compare={[{ points: other(4, 5, 6), label: 'B' }]} />,
    );
    const dashes = lines(container).map((p) => p.getAttribute('stroke-dasharray'));
    expect(dashes[0]).toBeNull();
    expect(dashes[1]).toBeTruthy();
    const hues = lines(container).map((p) => p.getAttribute('class'));
    expect(new Set(hues).size).toBe(2);
  });

  it('gives every drawable series a distinct dash AND a distinct token', () => {
    const points = series(1, 2, 3);
    const { container } = render(
      <TimeSeries
        points={points}
        compare={[
          { points: other(4, 5, 6), label: 'B' },
          { points: other(7, 8, 9), label: 'C' },
          { points: other(10, 11, 12), label: 'D' },
          { points: other(13, 14, 15), label: 'E' },
        ]}
      />,
    );
    const drawn = lines(container);
    expect(new Set(drawn.map((p) => p.getAttribute('stroke-dasharray')))).toHaveProperty('size', 5);
    expect(new Set(drawn.map((p) => p.getAttribute('class')))).toHaveProperty('size', 5);
  });

  it('names each line in a legend, so identity is never carried by colour alone', () => {
    const { container } = render(
      <TimeSeries
        points={series(1, 2, 3)}
        label="Downloads"
        compare={[{ points: other(4, 5, 6), label: 'Stars' }]}
      />,
    );
    const legend = container.querySelector('[data-slot="time-series-legend"]')!;
    expect(legend.textContent).toContain('Downloads');
    expect(legend.textContent).toContain('Stars');
  });

  it('repeats the line dash in the legend swatch, not just the colour', () => {
    const { container } = render(
      <TimeSeries points={series(1, 2, 3)} compare={[{ points: other(4, 5, 6), label: 'B' }]} />,
    );
    const swatches = [
      ...container.querySelectorAll('[data-slot="time-series-legend"] svg line'),
    ].map((l) => l.getAttribute('stroke-dasharray'));
    const plotted = lines(container).map((p) => p.getAttribute('stroke-dasharray'));
    expect(swatches).toEqual(plotted);
  });

  it('draws no legend for one series — it would restate the caption beneath it', () => {
    const { container } = render(<TimeSeries points={series(1, 2)} label="Downloads" />);
    expect(container.querySelector('[data-slot="time-series-legend"]')).toBeNull();
  });

  it('drops the area fill once there are two lines', () => {
    // Two translucent fills overlap into a third colour that belongs to
    // neither series and reads as a value.
    const { container: one } = render(<TimeSeries points={series(1, 2, 3)} />);
    expect(one.querySelector('path[class*="fill-chart-1"]')).not.toBeNull();
    cleanup();
    const { container: two } = render(
      <TimeSeries points={series(1, 2, 3)} compare={[{ points: other(4, 5, 6), label: 'B' }]} />,
    );
    expect(two.querySelector('path[class*="fill-chart-1"]')).toBeNull();
  });

  it('adds a COLUMN to the one data table rather than shipping a second table', () => {
    render(
      <TimeSeries
        points={series(1, 2)}
        label="Downloads"
        compare={[{ points: other(4, 5), label: 'Stars' }]}
      />,
    );
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Date',
      'Downloads',
      'Stars',
    ]);
  });

  it('describes every series in the accessible name, not only the first', () => {
    render(
      <TimeSeries
        points={series(10, 20)}
        label="Downloads"
        compare={[{ points: other(90, 40), label: 'Stars' }]}
      />,
    );
    const name = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(name).toContain('Downloads: 2 points');
    expect(name).toContain('Stars: 2 points');
    expect(name).toContain('down 50');
  });

  it('reads out every series from ONE live region, under keyboard control', async () => {
    // The alternative — a hover tooltip with its own copy of these numbers — is
    // a surface that can be right while the live region is wrong, and only a
    // sighted mouse user would ever find out.
    const user = userEvent.setup();
    const { container } = render(
      <TimeSeries
        points={series(10, 20, 30)}
        label="Downloads"
        unit="downloads"
        compare={[{ points: other(1, 2, 3), label: 'Stars', unit: 'stars' }]}
      />,
    );
    expect(container.querySelectorAll('output')).toHaveLength(1);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('output')?.textContent).toBe(
      '2026-08-02 · Downloads 20 downloads · Stars 2 stars',
    );
  });

  it('keeps the single-series readout unnamed — the caption already names it', () => {
    const user = userEvent.setup();
    render(<TimeSeries points={series(10, 20)} label="Downloads" unit="downloads" />);
    screen.getByRole('img').focus();
    return user.keyboard('{End}').then(() => {
      expect(screen.getByText('2026-08-02 · 20 downloads')).toBeTruthy();
    });
  });

  it('omits the unit for a series that has none, rather than printing "undefined"', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TimeSeries
        points={series(10, 20)}
        label="Downloads"
        compare={[{ points: other(1, 2), label: 'Stars' }]}
      />,
    );
    screen.getByRole('img').focus();
    await user.keyboard('{End}');
    expect(container.querySelector('output')?.textContent).toBe(
      '2026-08-02 · Downloads 20 · Stars 2',
    );
  });

  it('says "no data" for a day a series did not measure, instead of borrowing a neighbour', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TimeSeries
        points={series(10, 20, 30)}
        label="Downloads"
        compare={[{ points: [{ t: '2026-08-03T00:00:00Z', v: 7 }], label: 'Stars' }]}
      />,
    );
    screen.getByRole('img').focus();
    await user.keyboard('{Home}');
    expect(container.querySelector('output')?.textContent).toBe(
      '2026-08-01 · Downloads 10 · Stars no data',
    );
  });

  it('draws a crosshair dot only for the series that HAVE a reading there', async () => {
    // A dot on the segment that bridges a gap is an invented value.
    const user = userEvent.setup();
    const { container } = render(
      <TimeSeries
        points={series(10, 20, 30)}
        compare={[{ points: [{ t: '2026-08-03T00:00:00Z', v: 7 }], label: 'Stars' }]}
      />,
    );
    const svg = screen.getByRole('img');
    svg.focus();
    await user.keyboard('{Home}');
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    await user.keyboard('{End}');
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('widens the axis to the union of both series, so nothing plotted is off-scale', () => {
    const { container } = render(
      <TimeSeries
        points={[{ t: '2026-08-03T00:00:00Z', v: 5 }, { t: '2026-08-04T00:00:00Z', v: 6 }]}
        label="Downloads"
        compare={[{ points: series(1, 2, 3), label: 'Stars' }]}
      />,
    );
    expect(container.querySelector('figcaption')?.textContent).toContain('2026-08-01 → 2026-08-04');
  });

  it('judges "not enough data" on the PRIMARY series, not the union', () => {
    // A comparison series with fourteen readings does not rescue a headline
    // metric that has one — drawing it alone under that caption would credit
    // one metric with another's shape.
    render(
      <TimeSeries
        points={series(5)}
        label="Downloads"
        compare={[{ points: other(1, 2, 3), label: 'Stars' }]}
      />,
    );
    expect(screen.getByText(/Only 1 point so far/)).toBeTruthy();
  });

  it('spells an unlabelled primary the same word everywhere — legend, readout, table', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TimeSeries points={series(10, 20)} compare={[{ points: other(1, 2), label: 'Stars' }]} />,
    );
    expect(container.querySelector('[data-slot="time-series-legend"]')?.textContent).toContain(
      'Value',
    );
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeTruthy();
    screen.getByRole('img').focus();
    await user.keyboard('{Home}');
    expect(container.querySelector('output')?.textContent).toContain('Value 10');
  });

  it('captions the table with every series once there is more than one', () => {
    render(
      <TimeSeries
        points={series(1, 2)}
        label="Downloads"
        unit="downloads"
        compare={[{ points: other(3, 4), label: 'Stars' }]}
      />,
    );
    expect(screen.getByText('Downloads, Stars — full data')).toBeTruthy();
  });

  it('resolves a pointer to the same slot the keyboard reaches, with two series', () => {
    const spy = withLayout(900);
    const { container } = render(
      <TimeSeries points={series(10, 20, 30)} compare={[{ points: other(1, 2, 3), label: 'B' }]} />,
    );
    fireEvent.pointerMove(screen.getByRole('img'), { clientX: 900 });
    const byPointer = container.querySelector('output')?.textContent;
    fireEvent.pointerLeave(screen.getByRole('img'));
    screen.getByRole('img').focus();
    fireEvent.keyDown(screen.getByRole('img'), { key: 'End' });
    expect(container.querySelector('output')?.textContent).toBe(byPointer);
    spy.mockRestore();
  });
});

describe('TimeSeries beyond the palette', () => {
  const six = Array.from({ length: 5 }, (_, i) => ({
    points: other(i + 1, i + 2, i + 3),
    label: `S${i + 1}`,
  }));

  it('draws five and refuses the sixth — the palette is five tokens and five dashes', () => {
    // Repeating a colour AND a dash produces two lines a reader cannot tell
    // apart, which is worse than a line that is not drawn.
    const { container } = render(<TimeSeries points={series(1, 2, 3)} label="P" compare={six} />);
    expect(
      container.querySelector('[data-slot="time-series"]')?.getAttribute('data-series-count'),
    ).toBe('5');
    expect(
      container.querySelectorAll('[data-slot="time-series-plot"] g > path[stroke-width]'),
    ).toHaveLength(5);
  });

  it('keeps the undrawn series in the data table — the cap is a drawing limit', () => {
    render(<TimeSeries points={series(1, 2, 3)} label="P" compare={six} />);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Date',
      'P',
      'S1',
      'S2',
      'S3',
      'S4',
      'S5',
    ]);
  });

  it('says in the legend how many series are missing from the picture', () => {
    const { container } = render(<TimeSeries points={series(1, 2, 3)} label="P" compare={six} />);
    expect(container.querySelector('[data-slot="time-series-legend"]')?.textContent).toContain(
      '1 more not plotted',
    );
  });

  it('says nothing about missing series when none are missing', () => {
    const { container } = render(
      <TimeSeries points={series(1, 2, 3)} label="P" compare={six.slice(0, 2)} />,
    );
    expect(container.querySelector('[data-slot="time-series-legend"]')?.textContent).not.toContain(
      'not plotted',
    );
  });

  it('excludes an undrawn series from the y domain it cannot be read against', () => {
    const { container } = render(
      <TimeSeries
        points={series(1, 2, 3)}
        label="P"
        compare={[...six, { points: other(9_000, 9_001, 9_002), label: 'Huge' }]}
      />,
    );
    // 9,000 would otherwise flatten all five drawn lines against an axis whose
    // top belongs to a series that is not on the chart.
    expect(container.querySelector('[data-slot="time-series-readout"]')?.textContent).not.toContain(
      '9,002',
    );
  });
});

/* ── MetricTable ────────────────────────────────────────────────────────── */

const rows = [
  { key: 'views', label: 'Views', points: series(100, 120, 150) },
  { key: 'latency', label: 'Latency', points: series(90, 120), polarity: 'inverse' as const, unit: 'ms' },
];

describe('MetricTable', () => {
  it('is a real table — each metric is a row header, each date a column header', () => {
    render(<MetricTable rows={rows} caption="Metrics" />);
    expect(screen.getByRole('rowheader', { name: 'Views' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Metric' })).toBeTruthy();
  });

  it('says nothing about selection when there is no handler', () => {
    const { container } = render(<MetricTable rows={rows} caption="Metrics" />);
    expect(container.querySelector('[data-slot="metric-table-row"]')?.getAttribute('tabindex')).toBeNull();
    expect(screen.queryByText(/can be selected to plot it/)).toBeNull();
  });

  it('tells a screen-reader user that rows are selectable, and how', () => {
    render(<MetricTable rows={rows} caption="Metrics" onSelect={() => {}} />);
    expect(screen.getByText(/press Enter or Space on a focused row/)).toBeTruthy();
  });

  it('selects on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MetricTable rows={rows} caption="Metrics" onSelect={onSelect} />);
    await user.click(screen.getByRole('rowheader', { name: 'Views' }));
    expect(onSelect).toHaveBeenCalledWith('views');
  });

  it('selects from the keyboard with Enter and Space — a click handler alone is not enough', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(<MetricTable rows={rows} caption="Metrics" onSelect={onSelect} />);
    const row = container.querySelector('[data-slot="metric-table-row"]') as HTMLElement;
    row.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys so typing does not select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(<MetricTable rows={rows} caption="Metrics" onSelect={onSelect} />);
    (container.querySelector('[data-slot="metric-table-row"]') as HTMLElement).focus();
    await user.keyboard('{ArrowDown}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the selected row for assistive tech, not only with a background colour', () => {
    const { container } = render(
      <MetricTable rows={rows} caption="Metrics" selected="views" onSelect={() => {}} />,
    );
    const row = container.querySelector('[data-slot="metric-table-row"]')!;
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.getAttribute('data-selected')).toBe('true');
  });

  it('spells out a gap in a row instead of leaving a bare dash', () => {
    render(<MetricTable caption="c" rows={[{ key: 'a', label: 'A', points: series(1, null, 3) }]} />);
    expect(screen.getByText('No data')).toBeTruthy();
  });

  it('shows only the most recent columns but keeps the full history in the sparkline', () => {
    const long = { key: 'a', label: 'A', points: series(1, 2, 3, 4, 5) };
    render(<MetricTable rows={[long]} caption="c" maxColumns={2} />);
    // 2 date columns + Metric + trend + Change
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  });

  it('abbreviates large numbers so a dense row still fits', () => {
    render(<MetricTable caption="c" rows={[{ key: 'a', label: 'A', points: series(12_400, 13_000) }]} />);
    expect(screen.getByText('12.4k')).toBeTruthy();
  });

  it('honours per-row polarity, so a latency rise reads as bad', () => {
    const { container } = render(<MetricTable rows={rows} caption="Metrics" />);
    const tones = [...container.querySelectorAll('[data-slot="delta"]')].map((d) =>
      d.getAttribute('data-tone'),
    );
    expect(tones).toEqual(['good', 'bad']);
  });

  it('passes polarity down to the sparkline, so the row reads consistently', () => {
    const { container } = render(<MetricTable rows={rows} caption="Metrics" />);
    const sparks = [...container.querySelectorAll('[data-slot="sparkline"]')].map((s) =>
      s.getAttribute('class'),
    );
    // Latency rose, and rising latency is bad — the line must agree with the delta.
    expect(sparks[1]).toContain('text-viz-negative');
  });

  it('renders a row-shaped placeholder while loading, not an empty table', () => {
    const { container } = render(<MetricTable rows={[]} caption="c" loading />);
    expect(container.querySelector('[data-slot="metric-table"]')).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('forwards a ref and merges className', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<MetricTable ref={ref} className="mt-8" rows={rows} caption="c" />);
    expect(ref.current?.className).toContain('mt-8');
  });
});

/* ── The error state, across every chart that fetches ───────────────────── */

/**
 * Finding 2 from the control-room conversion: these components had `loading`,
 * had "no data", and had no way at all to say **the request failed**.
 *
 * That is not a missing nicety. `DATA_STATES` ranks `error` above `empty`
 * precisely because they are different claims: "no data yet" is a statement
 * about the METRIC, and a reader is entitled to act on it — to stop waiting,
 * to go and publish something. A failed fetch is a statement about the
 * REQUEST, and licenses none of that. Rendering the first while the second is
 * true is the exact defect `absence-vocabulary.test.tsx` was written for.
 */
describe('charts — a failed fetch is not an empty result', () => {
  it('TimeSeries says the history is unknown, not absent', () => {
    render(<TimeSeries points={[]} error={new Error('ECONNRESET')} label="Views" />);
    expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/i);
    // The empty-state copy must not appear: it claims the metric has no history.
    expect(screen.queryByText(/No data yet/)).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/not an empty series/i);
  });

  it('TimeSeries keeps loading ABOVE error — nothing is known yet', () => {
    const { container } = render(<TimeSeries points={[]} loading error="boom" />);
    expect(container.querySelector('[data-slot="time-series"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('TimeSeries folds the caller noun into the error sentence', () => {
    render(<TimeSeries points={[]} error="x" announce={{ noun: 'downloads' }} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Downloads could not be loaded/);
  });

  it('TimeSeries merges className and forwards a ref on the error state', () => {
    const ref = { current: null as HTMLElement | null };
    const { container } = render(
      <TimeSeries points={[]} error="x" className="mb-4" ref={ref} />,
    );
    const box = container.querySelector('[data-slot="time-series-error"]')!;
    expect(box.className).toContain('mb-4');
    expect(box.getAttribute('data-state')).toBe('error');
    expect(ref.current).toBe(box);
  });

  it('Sparkline holds its cell and announces the failure, unlike the empty form', () => {
    // The empty placeholder is `aria-hidden` because the row's other cells
    // already say there is no trend. Nothing else in the row knows the fetch
    // failed, so this one has to say it.
    const { container } = render(<Sparkline points={[]} error="x" width={90} height={22} />);
    const cell = container.querySelector('[data-slot="sparkline-error"]') as HTMLElement;
    expect(cell.style.width).toBe('90px');
    expect(cell.textContent).toMatch(/could not be loaded/i);
    expect(container.querySelector('[data-slot="sparkline-empty"]')).toBeNull();
  });

  it('Sparkline still prefers the skeleton while the request is in flight', () => {
    const { container } = render(<Sparkline points={[]} loading error="x" />);
    expect(container.querySelector('[data-slot="sparkline-error"]')).toBeNull();
  });

  it('MetricTable refuses to render as a table with no rows', () => {
    // An empty <tbody> under a real <caption> reads as "you track nothing",
    // which is a claim about the reader rather than about the request.
    render(<MetricTable rows={[]} caption="Metrics" error="x" />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/not a table with nothing in it/i);
  });

  it('MetricTable keeps the skeleton while loading, error or not', () => {
    const { container } = render(<MetricTable rows={[]} caption="c" loading error="x" />);
    expect(container.querySelector('[data-slot="metric-table"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('MetricTable merges className and forwards a ref on the error state', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<MetricTable rows={[]} caption="c" error="x" className="mt-2" ref={ref} />);
    expect(ref.current?.className).toContain('mt-2');
    expect(ref.current?.getAttribute('data-slot')).toBe('metric-table-error');
  });
});

/* ── SeriesTable — a categorical axis is not a calendar ─────────────────── */

describe('SeriesTable with a categorical axis', () => {
  const weekdays = [
    { t: 'Thu', v: 3 },
    { t: 'Fri', v: 4 },
    { t: 'Sat', v: 5 },
  ];

  it('keeps the caller order instead of sorting the week into alphabetical', () => {
    // Sorted, this reads Fri, Sat, Thu — a week that does not exist, and one
    // that disagrees with the chart directly above it.
    render(
      <SeriesTable
        axis="category"
        caption="By weekday"
        keyLabel="Weekday"
        hidden={false}
        series={[{ label: 'Reads', points: weekdays }]}
      />,
    );
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual([
      'Thu',
      'Fri',
      'Sat',
    ]);
  });

  it('does not truncate a long bin name to ten characters', () => {
    // `day()` is a date-shaped assumption: it would leave "Wednesday ".
    render(
      <SeriesTable
        axis="category"
        caption="c"
        hidden={false}
        series={[{ label: 'Reads', points: [{ t: 'Wednesday morning', v: 1 }] }]}
      />,
    );
    expect(screen.getByRole('rowheader', { name: 'Wednesday morning' })).toBeTruthy();
  });

  it('still aligns two series on the union of their bins', () => {
    render(
      <SeriesTable
        axis="category"
        caption="c"
        hidden={false}
        series={[
          { label: 'A', points: weekdays },
          { label: 'B', points: [{ t: 'Sat', v: 9 }] },
        ]}
      />,
    );
    expect(screen.getAllByText('No data')).toHaveLength(2);
  });

  it('leaves the default axis chronological and sorted', () => {
    render(
      <SeriesTable
        caption="c"
        hidden={false}
        series={[
          {
            label: 'A',
            points: [
              { t: '2026-08-03T00:00:00Z', v: 1 },
              { t: '2026-08-01T00:00:00Z', v: 2 },
            ],
          },
        ]}
      />,
    );
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual([
      '2026-08-01',
      '2026-08-03',
    ]);
  });
});

/* ── Distribution ───────────────────────────────────────────────────────── */

/**
 * The component extracted from the one dashboard element that could NOT be
 * converted onto this design system: a 24-bin audience clock.
 *
 * What it needed and `TimeSeries` could not express: an axis of names rather
 * than dates, marks that do not interpolate between samples that have no
 * in-between, a reference distribution to read the observed one against, and a
 * bin that was never measured looking different from a bin that measured zero.
 */
const hours = (...values: (number | null)[]): DistributionBin[] =>
  values.map((v, i) => ({ label: `${String(i).padStart(2, '0')}:00`, v }));

describe('Distribution', () => {
  const bars = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-slot="distribution-bar"]')];
  const gaps = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-slot="distribution-gap"]')];

  it('draws one bar per measured bin, in the order given', () => {
    const { container } = render(<Distribution bins={hours(3, 1, 2)} label="Reads" />);
    expect(bars(container)).toHaveLength(3);
    expect(
      container.querySelector('[data-slot="distribution"]')?.getAttribute('data-bin-count'),
    ).toBe('3');
  });

  it('hatches an unmeasured bin rather than leaving the slot blank', () => {
    // The defect this exists to prevent: a bar of height zero and a bar that
    // was never drawn are the same picture.
    const { container } = render(<Distribution bins={hours(3, null, 2)} />);
    expect(bars(container)).toHaveLength(2);
    expect(gaps(container)).toHaveLength(1);
    expect(gaps(container)[0].getAttribute('data-state')).toBe('not-counted');
    expect(gaps(container)[0].getAttribute('fill')).toMatch(/^url\(#distribution-hatch-/);
  });

  it('draws a measured zero as a zero-length bar — a different mark from the hatch', () => {
    const { container } = render(<Distribution bins={hours(0, 5)} />);
    expect(bars(container)).toHaveLength(2);
    expect(gaps(container)).toHaveLength(0);
    expect(bars(container)[0].getAttribute('height')).toBe('0');
  });

  it('counts the unmeasured bins in the accessible name, where a hatch cannot go', () => {
    render(<Distribution bins={hours(1, null, 2)} label="Reads" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      '1 bin not measured',
    );
  });

  it('gives every instance its own hatch id, so two charts cannot share one pattern', () => {
    const { container } = render(
      <>
        <Distribution bins={hours(1, null)} />
        <Distribution bins={hours(2, null)} />
      </>,
    );
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.getAttribute('id'));
    expect(new Set(ids).size).toBe(2);
    // No `:` — React's generated ids are legal in an id and awkward in a url().
    expect(ids.every((id) => !id!.includes(':'))).toBe(true);
  });

  it('publishes the peak rather than making every caller re-derive it', () => {
    const { container } = render(<Distribution bins={hours(1, 9, 2)} />);
    expect(
      container.querySelector('[data-slot="distribution"]')?.getAttribute('data-peak-bin'),
    ).toBe('1');
  });

  it('claims no peak when nothing at all was measured', () => {
    const { container } = render(<Distribution bins={hours(null, null)} />);
    expect(
      container.querySelector('[data-slot="distribution"]')?.getAttribute('data-peak-bin'),
    ).toBeNull();
    // Still an axis, still 24 hours we looked at — hatch, not an empty box.
    expect(gaps(container)).toHaveLength(2);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('no data');
  });

  it('says there are no BINS, which is not the same as no measurements', () => {
    render(<Distribution bins={[]} label="Reads" />);
    expect(screen.getByText(/No bins to plot/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the caller className on the no-bins state', () => {
    const { container } = render(<Distribution bins={[]} className="mb-6" />);
    expect(container.querySelector('[data-slot="distribution-empty"]')?.className).toContain(
      'mb-6',
    );
  });

  it('reserves the chart box while loading instead of claiming there are no bins', () => {
    const { container } = render(<Distribution bins={[]} loading className="mt-3" />);
    expect(container.querySelector('[data-slot="distribution"]')?.getAttribute('class')).toContain(
      'mt-3',
    );
    expect(screen.queryByText(/No bins to plot/)).toBeNull();
  });

  it('says a failed fetch is unknown, not flat', () => {
    render(<Distribution bins={hours(1, 2)} error="x" />);
    expect(screen.getByRole('alert').textContent).toMatch(/unknown, not flat/i);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('merges className and forwards a ref on the error state', () => {
    const ref = { current: null as HTMLElement | null };
    const { container } = render(
      <Distribution bins={[]} error="x" className="mb-2" ref={ref} />,
    );
    const box = container.querySelector('[data-slot="distribution-error"]')!;
    expect(box.className).toContain('mb-2');
    expect(ref.current).toBe(box);
  });

  it('forwards a ref and merges className on the plotted figure', () => {
    const ref = { current: null as HTMLElement | null };
    render(<Distribution bins={hours(1, 2)} ref={ref} className="mt-8" />);
    expect(ref.current?.getAttribute('data-slot')).toBe('distribution');
    expect(ref.current?.className).toContain('mt-8');
  });

  it('renders no caption when unlabelled', () => {
    const { container } = render(<Distribution bins={hours(1, 2)} />);
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('names the bin count in the caption when labelled', () => {
    const { container } = render(<Distribution bins={hours(1, 2)} label="Reads" />);
    expect(container.querySelector('figcaption')?.textContent).toContain('2 bins');
  });
});

describe('Distribution — the second axis family, without a toggle', () => {
  it('prints both readings of a slot instead of hiding one behind a switch', () => {
    // The hand-rolled version had a UTC/local button. A toggle shows one axis
    // and hides the other, so the reader holds one in their head — and the
    // hidden one is missing from every screenshot of the chart.
    const { container } = render(
      <Distribution
        bins={[
          { label: '14:00 UTC', note: '09:00 local', v: 4 },
          { label: '15:00 UTC', note: '10:00 local', v: 6 },
        ]}
      />,
    );
    const axis = container.querySelector('[data-slot="distribution-axis"]')!;
    expect(axis.textContent).toContain('14:00 UTC');
    expect(axis.textContent).toContain('09:00 local');
  });

  it('carries both readings into the readout and the data table', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Distribution
        showTable
        bins={[{ label: '14:00 UTC', note: '09:00 local', v: 4 }, { label: '15:00 UTC', v: 6 }]}
      />,
    );
    screen.getByRole('img').focus();
    await user.keyboard('{Home}');
    expect(container.querySelector('output')?.textContent).toContain(
      '14:00 UTC (09:00 local)',
    );
    expect(screen.getByRole('rowheader', { name: '14:00 UTC (09:00 local)' })).toBeTruthy();
  });
});

describe('Distribution — the reference overlay', () => {
  const withReference: DistributionBin[] = [
    { label: '00:00', v: 2, reference: 10 },
    { label: '06:00', v: 8, reference: 40 },
    { label: '12:00', v: 30, reference: 70 },
  ];

  it('draws the reference as a step, never as a sloped line', () => {
    // A diagonal between two hourly aggregates claims the quantity passed
    // through every value in between. Nothing exists in between to pass.
    const { container } = render(<Distribution bins={withReference} />);
    const path = container.querySelector('[data-slot="distribution-reference"]');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('stroke-dasharray')).toBe('6 4');
  });

  it('draws nothing when no bin carries a reference', () => {
    const { container } = render(<Distribution bins={hours(1, 2)} />);
    expect(container.querySelector('[data-slot="distribution-reference"]')).toBeNull();
    expect(container.querySelector('[data-slot="distribution-legend"]')).toBeNull();
  });

  it('puts both series on ONE domain, so the reference cannot be slid to cross', () => {
    const { container } = render(<Distribution bins={withReference} />);
    // 70 is the reference maximum; the readout prints the shared domain.
    expect(
      container.querySelector('[data-slot="distribution-readout"]')?.textContent,
    ).toContain('70');
  });

  it('distinguishes the two marks in the legend by SHAPE, not only by hue', () => {
    const { container } = render(
      <Distribution bins={withReference} label="Reading" referenceLabel="Readers awake" />,
    );
    const legend = container.querySelector('[data-slot="distribution-legend"]')!;
    expect(legend.textContent).toContain('Reading');
    expect(legend.textContent).toContain('Readers awake');
    expect(legend.querySelector('rect')).not.toBeNull();
    expect(legend.querySelector('line')?.getAttribute('stroke-dasharray')).toBe('6 4');
  });

  it('names an unlabelled pair the same word everywhere — legend, readout, table', async () => {
    const user = userEvent.setup();
    const { container } = render(<Distribution bins={withReference} showTable />);
    expect(container.querySelector('[data-slot="distribution-legend"]')?.textContent).toContain(
      'Value',
    );
    expect(screen.getByRole('columnheader', { name: 'Reference' })).toBeTruthy();
    screen.getByRole('img').focus();
    await user.keyboard('{Home}');
    expect(container.querySelector('output')?.textContent).toBe(
      '00:00 · Value 2 · Reference 10',
    );
  });

  it('describes BOTH series in the accessible name', () => {
    render(
      <Distribution bins={withReference} label="Reading" referenceLabel="Readers awake" />,
    );
    const name = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(name).toContain('Reading: 3 bins');
    expect(name).toContain('Readers awake: 3 bins');
  });

  it('says "not measured" for a bin one series missed, rather than borrowing a neighbour', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Distribution
        bins={[
          { label: '00:00', v: 2, reference: null },
          { label: '06:00', v: 8, reference: 40 },
        ]}
      />,
    );
    screen.getByRole('img').focus();
    await user.keyboard('{Home}');
    expect(container.querySelector('output')?.textContent).toContain(
      'Reference not measured',
    );
  });

  it('captions the table with both series once there is a reference', () => {
    render(<Distribution bins={withReference} label="Reading" referenceLabel="Awake" />);
    expect(screen.getByText('Reading, Awake — full data')).toBeTruthy();
  });

  it('captions a single-series table with its unit', () => {
    render(<Distribution bins={hours(1, 2)} label="Reads" unit="views" />);
    expect(screen.getByText('Reads — full data (views)')).toBeTruthy();
  });

  it('omits the unit from the caption when there is none', () => {
    render(<Distribution bins={hours(1, 2)} label="Reads" />);
    expect(screen.getByText('Reads — full data')).toBeTruthy();
  });

  it('labels the bin column with the caller noun', () => {
    render(<Distribution bins={hours(1, 2)} showTable binLabel="Hour" />);
    expect(screen.getByRole('columnheader', { name: 'Hour' })).toBeTruthy();
  });

  it('defaults the bin column label rather than leaving it blank', () => {
    render(<Distribution bins={hours(1, 2)} showTable />);
    expect(screen.getByRole('columnheader', { name: 'Bin' })).toBeTruthy();
  });

  it('ships the data table sr-only by default and visibly on request', () => {
    const { container, rerender } = render(<Distribution bins={hours(1, 2)} />);
    expect(container.querySelector('[data-slot="series-table"]')?.className).toContain(
      'sr-only',
    );
    rerender(<Distribution bins={hours(1, 2)} showTable />);
    expect(container.querySelector('[data-slot="series-table"]')?.className).not.toContain(
      'sr-only',
    );
  });
});

describe('Distribution — reading a bin without a mouse', () => {
  it('tells the reader the keyboard works, in the accessible name', () => {
    render(<Distribution bins={hours(1, 2, 3)} label="Reads" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('arrow keys');
  });

  it('steps with the arrow keys and clamps instead of wrapping', async () => {
    const user = userEvent.setup();
    const { container } = render(<Distribution bins={hours(1, 2, 3)} unit="views" />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowRight}');
    expect(container.querySelector('output')?.textContent).toBe('01:00 · 2 views');
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(container.querySelector('output')?.textContent).toBe('00:00 · 1 views');
  });

  it('jumps to either end with Home and End', async () => {
    const user = userEvent.setup();
    const { container } = render(<Distribution bins={hours(1, 2, 3)} />);
    screen.getByRole('img').focus();
    await user.keyboard('{End}');
    expect(container.querySelector('output')?.textContent).toBe('02:00 · 3');
    await user.keyboard('{Home}');
    expect(container.querySelector('output')?.textContent).toBe('00:00 · 1');
  });

  it('reads an unmeasured bin as "not measured", never as zero', async () => {
    const user = userEvent.setup();
    const { container } = render(<Distribution bins={hours(1, null)} />);
    screen.getByRole('img').focus();
    await user.keyboard('{End}');
    expect(container.querySelector('output')?.textContent).toBe('01:00 · not measured');
  });

  it('clears the crosshair on Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<Distribution bins={hours(1, 2)} />);
    screen.getByRole('img').focus();
    await user.keyboard('{End}{Escape}');
    expect(container.querySelector('output')?.textContent).toBe('');
  });

  it('leaves unrelated keys to the page — a focused chart is not a keyboard trap', async () => {
    const user = userEvent.setup();
    const { container } = render(<Distribution bins={hours(1, 2)} />);
    screen.getByRole('img').focus();
    await user.keyboard('a');
    expect(container.querySelector('output')?.textContent).toBe('');
  });

  it('highlights the band the pointer is INSIDE, not the nearest bar centre', () => {
    const spy = withLayout(900);
    const { container } = render(<Distribution bins={hours(1, 2, 3, 4)} />);
    // 44 of 900 user units is the left pad; the second band starts a quarter of
    // the way across the remaining 856.
    fireEvent.pointerMove(screen.getByRole('img'), { clientX: 44 + 856 * 0.3 });
    expect(container.querySelector('output')?.textContent).toContain('01:00');
    expect(container.querySelector('[data-slot="distribution-cursor"]')).not.toBeNull();
    spy.mockRestore();
  });

  it('ignores pointer movement when the chart has no layout box', () => {
    const { container } = render(<Distribution bins={hours(1, 2)} />);
    fireEvent.pointerMove(screen.getByRole('img'), { clientX: 50 });
    expect(container.querySelector('output')?.textContent).toBe('');
  });

  it('clears the crosshair when the pointer leaves and when focus leaves', () => {
    const spy = withLayout(900);
    const { container } = render(<Distribution bins={hours(1, 2, 3)} />);
    const svg = screen.getByRole('img');
    fireEvent.pointerMove(svg, { clientX: 900 });
    fireEvent.pointerLeave(svg);
    expect(container.querySelector('output')?.textContent).toBe('');
    fireEvent.pointerMove(svg, { clientX: 900 });
    fireEvent.blur(svg);
    expect(container.querySelector('output')?.textContent).toBe('');
    spy.mockRestore();
  });
});

describe('Distribution — the x axis', () => {
  const axisCells = (container: HTMLElement) => [
    ...container.querySelectorAll('[data-slot="distribution-axis"] > span'),
  ];

  it('gives every bin a cell, so a label stays centred under its own band', () => {
    // The alternative is percentage positioning, which needs an inline style.
    const { container } = render(<Distribution bins={hours(1, 2, 3, 4, 5)} />);
    expect(axisCells(container)).toHaveLength(5);
  });

  it('labels every bin while they still fit', () => {
    const { container } = render(<Distribution bins={hours(1, 2, 3)} />);
    expect(axisCells(container).map((c) => c.textContent)).toEqual([
      '00:00',
      '01:00',
      '02:00',
    ]);
  });

  it('thins to at most eight labels on a 24-bin clock', () => {
    const { container } = render(
      <Distribution bins={hours(...Array.from({ length: 24 }, (_, i) => i))} />,
    );
    const labelled = axisCells(container).filter((c) => c.textContent !== '');
    expect(labelled).toHaveLength(8);
    // Both ends survive — the ends are the range.
    expect(labelled[0].textContent).toBe('00:00');
    expect(labelled[7].textContent).toBe('23:00');
  });

  it('drops the MIDDLE labels below sm, never an end', () => {
    const { container } = render(
      <Distribution bins={hours(...Array.from({ length: 24 }, (_, i) => i))} />,
    );
    const hidden = axisCells(container)
      .map((cell) => cell.firstElementChild)
      .filter((child): child is Element => child !== null)
      .map((child) => child.className.includes('hidden'));
    expect(hidden[0]).toBe(false);
    expect(hidden[hidden.length - 1]).toBe(false);
    expect(hidden).toContain(true);
  });

  it('stays out of the accessibility tree — the bins are in the table and the readout', () => {
    const { container } = render(<Distribution bins={hours(1, 2)} />);
    expect(
      container.querySelector('[data-slot="distribution-axis"]')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('pins the two end labels inward, because they are the only ones that can spill outside', () => {
    // 24 bins at a 320 viewport gives each cell ~11px and "00:00" wants 30.
    // Spilling over an empty neighbouring cell is harmless; spilling outside
    // the row is what makes the page scroll sideways.
    const { container } = render(<Distribution bins={hours(1, 2, 3, 4, 5)} />);
    const alignments = axisCells(container).map((cell) =>
      /text-(start|center|end)/.exec(cell.className)?.[0],
    );
    expect(alignments).toEqual([
      'text-start',
      'text-center',
      'text-center',
      'text-center',
      'text-end',
    ]);
  });

  it('anchors the y axis at zero, so bar lengths are comparable as ratios', () => {
    const { container } = render(<Distribution bins={hours(3_412, 3_588)} />);
    expect(
      container.querySelector('[data-slot="distribution-readout"]')?.textContent,
    ).toContain('0');
    expect(container.querySelector('[data-slot="distribution-baseline"]')).not.toBeNull();
  });
});

/* ── RadialWeave ────────────────────────────────────────────────────────── */

describe('RadialWeave', () => {
  it('explains why it cannot plot rather than rendering an empty dial', () => {
    render(<RadialWeave points={[]} />);
    expect(screen.getByText(/No data yet/)).toBeTruthy();
  });

  it('says how many points it has when there is one', () => {
    const { container } = render(<RadialWeave points={series(5)} className="mb-4" />);
    expect(screen.getByText(/Only 1 point so far/)).toBeTruthy();
    expect(container.querySelector('[data-slot="radial-weave-empty"]')?.className).toContain(
      'mb-4',
    );
  });

  it('reserves its box while loading', () => {
    const { container } = render(<RadialWeave points={[]} loading />);
    expect(container.querySelector('[data-slot="radial-weave"]')).not.toBeNull();
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it('announces a failed fetch as unknown history, not an empty series', () => {
    render(<RadialWeave points={[]} error={new Error('boom')} />);
    expect(screen.getByRole('alert').textContent).toContain('not an empty series');
  });

  it('speaks the series in the accessible name and ships the lossless table', () => {
    render(<RadialWeave points={series(10, 20, 30)} label="Views" unit="views" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Views');
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Views — full data (views)')).toBeTruthy();
  });

  it('draws each series with the SAME dash identity TimeSeries uses', () => {
    const { container } = render(
      <RadialWeave
        points={series(10, 20, 30)}
        label="A"
        compare={[{ points: series(5, 15, 25), label: 'B' }]}
      />,
    );
    const arcs = container.querySelectorAll('g[clip-path] path');
    expect(arcs).toHaveLength(2);
    expect(arcs[0].getAttribute('stroke-dasharray')).toBeNull();
    expect(arcs[1].getAttribute('stroke-dasharray')).toBe('12 6');
  });

  it('caps drawn series at the palette and says so in the legend', () => {
    const compare = ['B', 'C', 'D', 'E', 'F'].map((label) => ({
      points: series(1, 2, 3),
      label,
    }));
    const { container } = render(
      <RadialWeave points={series(4, 5, 6)} label="A" compare={compare} />,
    );
    expect(container.querySelectorAll('g[clip-path] path')).toHaveLength(5);
    expect(screen.getByText('1 more not plotted — see the data table')).toBeTruthy();
    // The table stays lossless past the drawing cap.
    expect(within(screen.getByRole('table')).getByText('F')).toBeTruthy();
  });

  it('renders no legend for a single series — the figcaption already names it', () => {
    const { container } = render(<RadialWeave points={series(1, 2)} label="Solo" />);
    expect(container.querySelector('[data-slot="radial-weave-legend"]')).toBeNull();
    expect(container.querySelector('figcaption')?.textContent).toContain('Solo');
  });

  it('renders no caption when unlabelled', () => {
    const { container } = render(<RadialWeave points={series(1, 2)} />);
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('prints the latest value in the HTML centre, with its unit', () => {
    const { container } = render(
      <RadialWeave points={series(10, 20, 12_400)} label="Downloads" unit="downloads" />,
    );
    const centre = container.querySelector('[data-slot="radial-weave-centre"]');
    expect(centre?.textContent).toContain('12.4k');
    expect(centre?.textContent).toContain('downloads');
  });

  it('omits the centre unit line when there is none', () => {
    const { container } = render(<RadialWeave points={series(1, 2)} />);
    const centre = container.querySelector('[data-slot="radial-weave-centre"]');
    expect(centre?.querySelectorAll('span')).toHaveLength(1);
  });

  it('prints min, range and max in real HTML — never SVG text', () => {
    const { container } = render(<RadialWeave points={series(10, 20, 30)} />);
    const readout = container.querySelector('[data-slot="radial-weave-readout"]');
    expect(readout?.textContent).toContain('10');
    expect(readout?.textContent).toContain('30');
    expect(readout?.textContent).toContain('2026-08-01 → 2026-08-03');
    expect(container.querySelector('svg[data-slot="radial-weave-plot"] text')).toBeNull();
  });

  it('draws grid rings outside the reveal clip, series inside it', () => {
    const { container } = render(<RadialWeave points={series(10, 20, 30)} />);
    const rect = container.querySelector('clipPath rect');
    expect(rect?.getAttribute('class')).toContain('animate-weave-reveal');
    const id = container.querySelector('clipPath')?.getAttribute('id');
    expect(container.querySelector(`[clip-path="url(#${id})"] path`)).not.toBeNull();
    // Rings are the stage: present, and not clipped.
    const rings = container.querySelectorAll('svg > path[class*="stroke-viz-grid"]');
    expect(rings.length).toBeGreaterThanOrEqual(1);
  });

  it('can show the data table visibly', () => {
    const { container } = render(<RadialWeave points={series(1, 2)} showTable />);
    expect(container.querySelector('[data-slot="series-table"]')?.className).not.toContain(
      'sr-only',
    );
  });

  it('forwards a ref and merges className on the drawn form', () => {
    const ref = { current: null as HTMLElement | null };
    const { container } = render(
      <RadialWeave ref={ref} points={series(1, 2)} className="mt-8" />,
    );
    expect(ref.current?.getAttribute('data-slot')).toBe('radial-weave');
    expect(container.querySelector('[data-slot="radial-weave"]')?.className).toContain('mt-8');
  });
});
