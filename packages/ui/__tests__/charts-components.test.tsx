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
import { MetricTable } from '../src/charts/metric-table.js';
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

  it('treats a flat series as not-falling rather than painting it as a loss', () => {
    render(<Sparkline points={series(7, 7)} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('data-direction')).toBe('flat');
    expect(svg.getAttribute('class')).toContain('text-viz-positive');
  });

  it('keeps the caller className alongside the DS classes', () => {
    render(<Sparkline points={series(1, 2)} className="mx-2" />);
    const cls = screen.getByRole('img').getAttribute('class') ?? '';
    expect(cls).toContain('mx-2');
    expect(cls).toContain('align-middle');
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

  it('forwards a ref to the figure', () => {
    const ref = { current: null as HTMLElement | null };
    render(<TimeSeries points={series(1, 2)} ref={ref} />);
    expect(ref.current?.getAttribute('data-slot')).toBe('time-series');
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

  it('forwards a ref and merges className', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<MetricTable ref={ref} className="mt-8" rows={rows} caption="c" />);
    expect(ref.current?.className).toContain('mt-8');
  });
});
