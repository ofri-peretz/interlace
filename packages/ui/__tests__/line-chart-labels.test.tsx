/**
 * Line-chart words: every fixed word in TimeSeries, RadialWeave, Delta,
 * Sparkline and SeriesTable can be replaced, and numbers follow a locale.
 * The English defaults are held by the other suites; these prove the seams.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Delta } from '../src/charts/delta.js';
import { RadialWeave } from '../src/charts/radial-weave.js';
import { compact, describeSeries, seriesSentence, type Point, type SeriesSummary } from '../src/charts/scale.js';
import { SeriesTable } from '../src/charts/series-table.js';
import { Sparkline } from '../src/charts/sparkline.js';
import { TimeSeries, type TimeSeriesLabels } from '../src/charts/time-series.js';

afterEach(cleanup);

const RISING: Point[] = [
  { t: '2026-06-01', v: 1000 },
  { t: '2026-06-08', v: 1500 },
  { t: '2026-06-15', v: 2000 },
];
const OTHER: Point[] = [
  { t: '2026-06-01', v: 5 },
  { t: '2026-06-15', v: 7 },
];

const short = (s: SeriesSummary) => `${s.name ?? '?'}=${s.count}@${s.number(s.last ?? 0)}`;

const LABELS: Partial<TimeSeriesLabels> = {
  value: 'Wert',
  series: 'Reihe',
  empty: (count) => `Leer ${count}`,
  missing: 'fehlt',
  notPlotted: (count) => `${count} weitere`,
  instructions: 'Pfeiltasten.',
  tableCaption: (names, unit) => `Tabelle ${names.join('+')}${unit ? ` ${unit}` : ''}`,
  date: 'Datum',
  noData: 'Keine Daten',
  summary: short,
  delta: { spoken: (c) => `Δ ${c.magnitude} ${c.pct}` },
};

describe('describeSeries', () => {
  it('builds its sentence from a summary, in a locale', () => {
    expect(describeSeries(RISING, 'A', { summary: short, locale: 'de-DE' })).toBe('A=3@2.000');
    expect(describeSeries(RISING, 'A', { locale: 'de-DE' })).toContain('1.000 to 2.000, up 1.000 (100.0%)');
    expect(seriesSentence({ count: 0, change: null, number: String })).toBe('Series: no data');
  });

  it('compact follows a locale', () => {
    expect(compact(12_400, 'de-DE')).toBe('12,4k');
    expect(compact(12, 'de-DE')).toBe('12');
  });
});

describe('Delta labels', () => {
  it('replaces the empty note and the spoken sentence, and formats in a locale', () => {
    const { container, rerender } = render(<Delta points={[]} labels={{ empty: 'Zu wenig' }} />);
    expect(screen.getByText('Zu wenig')).toBeTruthy();
    rerender(<Delta points={RISING} locale="de-DE" labels={{ spoken: (c) => `${c.from}→${c.to} ${c.pct}` }} />);
    expect(screen.getByText('1.000→2.000 100,0 %')).toBeTruthy();
    expect(container.textContent).toContain('+1.000');
  });
});

describe('SeriesTable', () => {
  it('takes its own word for an empty cell and a locale', () => {
    render(
      <SeriesTable
        caption="T"
        series={[
          { label: 'A', points: RISING },
          { label: 'B', points: OTHER },
        ]}
        noDataLabel="Keine Daten"
        locale="de-DE"
      />,
    );
    expect(screen.getByText('Keine Daten')).toBeTruthy();
    expect(screen.getByText('1.500')).toBeTruthy();
  });
});

describe('Sparkline', () => {
  it('speaks its own summary', () => {
    render(<Sparkline points={RISING} label="A" summary={short} locale="de-DE" />);
    expect(screen.getByRole('img', { name: 'A=3@2.000' })).toBeTruthy();
  });
});

describe('TimeSeries labels', () => {
  it('replaces every fixed word', () => {
    const many = Array.from({ length: 6 }, () => ({ points: OTHER }));
    const { container } = render(
      <TimeSeries points={RISING} compare={many} labels={LABELS} locale="de-DE" showTable />,
    );
    const plot = screen.getByRole('img');
    expect(plot.getAttribute('aria-label')).toBe(`?=3@2.000 ${'?=2@7 '.repeat(4)}Pfeiltasten.`);
    expect(screen.getByText('2 weitere')).toBeTruthy();
    expect(screen.getAllByText('Wert').length).toBeGreaterThan(0);
    expect(screen.getByText('Datum')).toBeTruthy();
    expect(screen.getAllByText('Keine Daten').length).toBeGreaterThan(0);
    expect(container.querySelector('caption')!.textContent).toBe(`Tabelle ${Array(7).fill('Wert').join('+')}`);

    plot.focus();
    fireEvent.keyDown(plot, { key: 'Home' });
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    const readout = document.querySelector('output')!.textContent;
    expect(readout).toContain('Wert 1.500');
    expect(readout).toContain('Wert fehlt');

    fireEvent.keyDown(plot, { key: 'Home' });
    fireEvent.keyDown(plot, { key: 'Enter' });
    fireEvent.keyDown(plot, { key: 'End' });
    fireEvent.keyDown(plot, { key: 'Enter' });
    expect(screen.getByText('Δ 1.000 100,0 %')).toBeTruthy();
  });

  it('names an unlabelled single series in the caption, and words the empty note', () => {
    const { container, rerender } = render(<TimeSeries points={RISING} unit="x" labels={LABELS} />);
    expect(container.querySelector('caption')!.textContent).toBe('Tabelle Reihe x');
    rerender(<TimeSeries points={RISING.slice(0, 1)} labels={LABELS} />);
    expect(screen.getByText('Leer 1')).toBeTruthy();
  });
});

describe('RadialWeave labels', () => {
  it('replaces every fixed word it shows', () => {
    const many = Array.from({ length: 5 }, () => ({ points: OTHER }));
    const { container, rerender } = render(
      <RadialWeave points={RISING} compare={many} labels={LABELS} locale="de-DE" showTable />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(`?=3@2.000 ${'?=2@7 '.repeat(3)}?=2@7`);
    expect(screen.getByText('1 weitere')).toBeTruthy();
    expect(screen.getByText('2,0k')).toBeTruthy();
    expect(container.querySelector('caption')!.textContent).toBe(`Tabelle ${Array(6).fill('Wert').join('+')}`);
    rerender(<RadialWeave points={RISING} label="Downloads" labels={LABELS} />);
    expect(container.querySelector('caption')!.textContent).toBe('Tabelle Downloads');
    rerender(<RadialWeave points={[]} labels={LABELS} />);
    expect(screen.getByText('Leer 0')).toBeTruthy();
  });
});
