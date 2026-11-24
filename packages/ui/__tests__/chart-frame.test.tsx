/**
 * ChartFrame: the CSV writer is pure and tested on its own; the frame is
 * tested for what a reader receives: the title as the figure's name, every
 * source, the note, the date, a download that works without scripts, and a
 * table view that stays in the HTML.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChartFrame, MIN_VIEWPORT, csvHref, toCsv } from '../src/charts/chart-frame.js';

afterEach(cleanup);

describe('toCsv', () => {
  it('writes a header, then one CRLF line per row, every key in first-seen order', () => {
    expect(toCsv([{ a: 1, b: 'x' }, { b: 'y', c: true }])).toBe('a,b,c\r\n1,x,\r\n,y,true');
  });

  it('keeps the given columns and their order', () => {
    expect(toCsv([{ a: 1, b: 2 }], ['b', 'a'])).toBe('b,a\r\n2,1');
  });

  it('quotes commas, quotes and line breaks, and empties null, undefined and non-finite numbers', () => {
    expect(toCsv([{ a: 'one, two', b: 'say "hi"', c: 'x\ny', d: null, e: undefined, f: Number.NaN }])).toBe(
      'a,b,c,d,e,f\r\n"one, two","say ""hi""","x\ny",,,',
    );
  });

  it('defuses text a spreadsheet would run as a formula, but not negative numbers', () => {
    expect(toCsv([{ a: '=SUM(A1)', b: '+1+1', c: '@x', d: '-12.5', e: -3 }])).toBe(
      "a,b,c,d,e\r\n'=SUM(A1),'+1+1,'@x,-12.5,-3",
    );
  });
});

describe('csvHref', () => {
  it('is a UTF-8 data address with a byte-order mark', () => {
    const href = csvHref([{ city: 'Zürich' }]);
    expect(href.startsWith('data:text/csv;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(href.slice(href.indexOf(',') + 1))).toBe('﻿city\r\nZürich');
  });
});

const ROWS = [
  { year: 2024, share: 0.41 },
  { year: 2025, share: 0.47 },
];

describe('<ChartFrame>', () => {
  it('names the figure by its title, at the level asked for', () => {
    render(
      <ChartFrame title="Most residents walk or cycle now" subtitle="Share of trips, 2019 to 2025" headingLevel="h2">
        <div>chart</div>
      </ChartFrame>,
    );
    const figure = screen.getByRole('figure', { name: 'Most residents walk or cycle now' });
    expect(figure.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Most residents walk or cycle now');
    expect(screen.getByText('Share of trips, 2019 to 2025')).toBeTruthy();
  });

  it('shows a subtitle without a title, and a title without a subtitle', () => {
    const { container, rerender } = render(
      <ChartFrame subtitle="Share of trips">
        <div />
      </ChartFrame>,
    );
    expect(container.querySelector('[data-slot="chart-frame-title"]')).toBeNull();
    expect(container.querySelector('[data-slot="chart-frame-subtitle"]')!.textContent).toBe('Share of trips');
    rerender(
      <ChartFrame title="Trips">
        <div />
      </ChartFrame>,
    );
    expect(container.querySelector('[data-slot="chart-frame-subtitle"]')).toBeNull();
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Trips');
  });

  it('renders just the chart when given nothing else', () => {
    const { container } = render(
      <ChartFrame>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(container.querySelector('[data-slot="chart-frame-header"]')).toBeNull();
    expect(container.querySelector('[data-slot="chart-frame-footer"]')).toBeNull();
    expect(container.querySelector('[data-slot="chart-frame-body"]')!.textContent).toBe('chart');
  });

  it('lists every source, linking those with an address', () => {
    const { container, rerender } = render(
      <ChartFrame sources={[{ label: 'City survey 2025', href: 'https://example.org/survey' }, { label: 'Transit counts' }]}>
        <div />
      </ChartFrame>,
    );
    const sources = container.querySelector('[data-slot="chart-frame-sources"]')!;
    expect(sources.textContent).toBe('Sources: City survey 2025; Transit counts');
    expect(within(sources as HTMLElement).getByRole('link', { name: 'City survey 2025' }).getAttribute('href')).toBe(
      'https://example.org/survey',
    );
    rerender(
      <ChartFrame sources={[{ label: 'City survey 2025' }]}>
        <div />
      </ChartFrame>,
    );
    expect(container.querySelector('[data-slot="chart-frame-sources"]')!.textContent).toBe('Source: City survey 2025');
  });

  it('prints the note and a readable date, keeping the ISO date for machines', () => {
    const { container } = render(
      <ChartFrame note="Trips under 500 m are left out." updated="2025-10-01" locale="en-US">
        <div />
      </ChartFrame>,
    );
    expect(container.querySelector('[data-slot="chart-frame-note"]')!.textContent).toBe(
      'Note: Trips under 500 m are left out.',
    );
    const time = container.querySelector('time')!;
    expect(time.getAttribute('dateTime')).toBe('2025-10-01');
    expect(time.textContent).toBe('Oct 1, 2025');
  });

  it('prints an unreadable date as given', () => {
    const { container } = render(
      <ChartFrame updated="autumn 2025">
        <div />
      </ChartFrame>,
    );
    expect(container.querySelector('time')!.textContent).toBe('autumn 2025');
  });

  it('offers the data as a CSV link that works before scripts load, adding .csv once', () => {
    const { rerender } = render(
      <ChartFrame download={{ filename: 'trips', rows: ROWS }}>
        <div />
      </ChartFrame>,
    );
    const link = screen.getByRole('link', { name: 'Download data (CSV)' });
    expect(link.getAttribute('download')).toBe('trips.csv');
    expect(link.getAttribute('href')).toBe(csvHref(ROWS));
    rerender(
      <ChartFrame download={{ filename: 'Trips.CSV', rows: ROWS, columns: ['share'] }}>
        <div />
      </ChartFrame>,
    );
    expect(screen.getByRole('link', { name: 'Download data (CSV)' }).getAttribute('download')).toBe('Trips.CSV');
  });

  it('switches between chart and table, keeping both in the HTML', () => {
    const { container } = render(
      <ChartFrame table={<table><tbody><tr><td>47%</td></tr></tbody></table>}>
        <div>chart</div>
      </ChartFrame>,
    );
    expect(container.querySelector('[data-slot="chart-frame-table"]')!.textContent).toBe('47%');
    const tab = screen.getByRole('tab', { name: 'Table' });
    expect(screen.getByRole('tab', { name: 'Chart' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('takes its fixed words from labels', () => {
    render(
      <ChartFrame
        table={<p>t</p>}
        defaultView="table"
        sources={[{ label: 'X' }]}
        download={{ filename: 'x', rows: ROWS }}
        labels={{ chart: 'Graphique', table: 'Tableau', source: 'Source :', download: 'Télécharger' }}
      >
        <div />
      </ChartFrame>,
    );
    expect(screen.getByRole('tab', { name: 'Tableau' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Graphique' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Télécharger' })).toBeTruthy();
  });
});
