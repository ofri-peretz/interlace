'use client';

/**
 * @interlace/ui — ChartFrame
 *
 * The frame a published chart sits in: a title that states the finding, a
 * line on what is measured, the chart, and a footer with where the numbers
 * came from and a copy of them to take away. Every chart on a page gets the
 * same frame, so a reader learns once where the source is.
 *
 * ## A chart is a claim, the footer is its receipt
 *
 * `sources` names each source, linked when it has an address; `note` says
 * what the reader must know to read the numbers right (how a question was
 * worded, what was left out); `updated` says how fresh they are. All three
 * are plain HTML in the footer, never hidden behind a click, because a
 * reader who doubts a chart should not have to hunt for its origin.
 *
 * ## Chart or table
 *
 * Pass `table` and the frame offers a Chart and a Table view (Base UI tabs,
 * arrow keys between them). Both views stay in the server HTML: the hidden
 * one is only hidden, so search engines and readers without scripts get the
 * numbers too.
 *
 * ## Take the data with you
 *
 * `download` is the data as rows. The frame writes it as CSV into a link at
 * render time (UTF-8 with a byte-order mark, so spreadsheet apps read
 * accents right), so the link works before scripts load. Cells that start
 * with `=`, `+`, `-` or `@` and are not numbers get a leading apostrophe, so
 * a spreadsheet never runs them as a formula. `toCsv()` is exported and pure.
 *
 * ## Words
 *
 * Every fixed word ("Source", "Download data") comes from `labels`, so a
 * page in another language passes its own. Dates go through
 * `Intl.DateTimeFormat` in `locale`.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The header is a single column; the footer wraps; the view switch sits
 * under the subtitle and never pushes the title sideways.
 *
 * ## Anatomy
 *
 *   <figure data-slot="chart-frame">
 *     <header data-slot="chart-frame-header">
 *       <h3 data-slot="chart-frame-title" />
 *       <p data-slot="chart-frame-subtitle" />
 *     </header>
 *     <div data-slot="chart-frame-body">{children}</div>        (or tabs: chart / table)
 *     <figcaption data-slot="chart-frame-footer">
 *       <p data-slot="chart-frame-sources" />
 *       <p data-slot="chart-frame-note" />
 *       <p> <time data-slot="chart-frame-updated" /> · <a data-slot="chart-frame-download" download /> </p>
 *     </figcaption>
 *   </figure>
 *
 * | Rule | Concept                    | Where in this file                                     |
 * | ---- | -------------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el          | `React.ComponentProps<'figure'>`                        |
 * | R6   | data-slot on every part    | `chart-frame` / `-header` / `-body` / `-footer`          |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                |
 * | R10  | Composition seam           | `children` is any chart; `table` any table              |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`              |
 * | R18  | Tailwind only              | zero inline `style`                                     |
 * | R19  | Tokens only                | `--foreground`, `--muted-foreground`, `--border`, `--primary` |
 * | R26  | A11y                       | `<figure>` + footer `<figcaption>`, tabs from Base UI   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../primitives/tabs.js';

export const MIN_VIEWPORT = 320 as const;

export type ChartSource = {
  /** The source's name, such as a publisher and the title of the release. */
  label: string;
  /** Where to read it. */
  href?: string;
};

export type CsvValue = string | number | boolean | null | undefined;
export type CsvRow = Readonly<Record<string, CsvValue>>;

export type ChartDownload = {
  /** The file's name. `.csv` is added when missing. */
  filename: string;
  /** The rows, one object per line. */
  rows: readonly CsvRow[];
  /** The columns, in order. @default every key, in the order first seen */
  columns?: readonly string[];
};

export type ChartFrameLabels = {
  chart: string;
  table: string;
  source: string;
  sources: string;
  note: string;
  updated: string;
  download: string;
  views: string;
};

const LABELS: ChartFrameLabels = {
  chart: 'Chart',
  table: 'Table',
  source: 'Source',
  sources: 'Sources',
  note: 'Note',
  updated: 'Updated',
  download: 'Download data (CSV)',
  views: 'View',
};

// ─────────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────────

const FORMULA = /^[=+\-@\t\r]/;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA.test(text) && !Number.isFinite(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Rows as CSV text: a header line, then one line per row, CRLF between lines (RFC 4180). */
export function toCsv(rows: readonly CsvRow[], columns?: readonly string[]): string {
  const keys = columns ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [keys.map((k) => cell(k)), ...rows.map((row) => keys.map((k) => cell(row[k])))];
  return lines.map((line) => line.join(',')).join('\r\n');
}

/** A `data:` address holding the CSV, with a byte-order mark so spreadsheet apps read it as UTF-8. */
export function csvHref(rows: readonly CsvRow[], columns?: readonly string[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${toCsv(rows, columns)}`)}`;
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const HEADING = {
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
} as const;

export interface ChartFrameProps extends Omit<React.ComponentProps<'figure'>, 'title'> {
  /** The finding, in a sentence, such as "Most residents walk or cycle now". */
  title?: React.ReactNode;
  /** What is measured, where and when. */
  subtitle?: React.ReactNode;
  /** The heading level of the title, to fit the page's outline. @default 'h3' */
  headingLevel?: keyof typeof HEADING;
  /** Where the numbers came from. */
  sources?: readonly ChartSource[];
  /** What a reader must know to read the numbers right. */
  note?: React.ReactNode;
  /** When the data was last updated, as an ISO date (`2025-10-01`). */
  updated?: string;
  /** The data as rows, offered as a CSV download. */
  download?: ChartDownload;
  /** A table of the same numbers. When given, the frame offers a Chart and a Table view. */
  table?: React.ReactNode;
  /** The view shown first, when there is a table. @default 'chart' */
  defaultView?: 'chart' | 'table';
  /** A BCP 47 locale for the date. @default the reader's */
  locale?: string;
  /** Fixed words, for pages in another language. */
  labels?: Partial<ChartFrameLabels>;
}

export const ChartFrame = React.forwardRef<HTMLElement, ChartFrameProps>(function ChartFrame(
  {
    title,
    subtitle,
    headingLevel = 'h3',
    sources = [],
    note,
    updated,
    download,
    table,
    defaultView = 'chart',
    locale,
    labels: labelsProp,
    className,
    children,
    ...props
  },
  ref,
) {
  const labels = { ...LABELS, ...labelsProp };
  const titleId = React.useId();
  const Heading = HEADING[headingLevel];

  const href = React.useMemo(
    () => (download ? csvHref(download.rows, download.columns) : undefined),
    [download],
  );
  const filename = download
    ? download.filename.toLowerCase().endsWith('.csv')
      ? download.filename
      : `${download.filename}.csv`
    : undefined;

  const date = updated ? new Date(`${updated.slice(0, 10)}T00:00:00Z`) : undefined;
  const dateText =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
      : updated;

  const hasFooter = sources.length > 0 || note || updated || download;

  const body = table ? (
    <Tabs defaultValue={defaultView} data-slot="chart-frame-views" className="gap-4">
      <TabsList aria-label={labels.views} className="self-start">
        <TabsTrigger value="chart">{labels.chart}</TabsTrigger>
        <TabsTrigger value="table">{labels.table}</TabsTrigger>
      </TabsList>
      <TabsContent value="chart" keepMounted data-slot="chart-frame-body" className="min-w-0">
        {children}
      </TabsContent>
      <TabsContent value="table" keepMounted data-slot="chart-frame-table" className="min-w-0 overflow-x-auto">
        {table}
      </TabsContent>
    </Tabs>
  ) : (
    <div data-slot="chart-frame-body" className="min-w-0">
      {children}
    </div>
  );

  return (
    <figure
      ref={ref}
      data-slot="chart-frame"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={title ? titleId : undefined}
      className={cn('m-0 flex w-full min-w-0 flex-col gap-4', className)}
      {...props}
    >
      {title || subtitle ? (
        <header data-slot="chart-frame-header" className="flex max-w-prose flex-col gap-1">
          {title ? (
            <Heading
              id={titleId}
              data-slot="chart-frame-title"
              className="text-foreground font-heading m-0 text-h3 font-semibold text-balance"
            >
              {title}
            </Heading>
          ) : null}
          {subtitle ? (
            <p data-slot="chart-frame-subtitle" className="text-muted-foreground m-0 text-ui">
              {subtitle}
            </p>
          ) : null}
        </header>
      ) : null}

      {body}

      {hasFooter ? (
        <figcaption
          data-slot="chart-frame-footer"
          className="text-muted-foreground border-border flex flex-col gap-1.5 border-t pt-3 text-caption"
        >
          {sources.length > 0 ? (
            <p data-slot="chart-frame-sources" className="m-0">
              <span className="text-foreground font-medium">
                {sources.length === 1 ? labels.source : labels.sources}:
              </span>{' '}
              {sources.map((source, i) => (
                <React.Fragment key={`${source.label}-${i}`}>
                  {i > 0 ? '; ' : null}
                  {source.href ? (
                    <a
                      href={source.href}
                      className="text-foreground underline decoration-border underline-offset-2 hover:decoration-current focus-visible:ring-ring focus-visible:ring-offset-background rounded-sm focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                    >
                      {source.label}
                    </a>
                  ) : (
                    source.label
                  )}
                </React.Fragment>
              ))}
            </p>
          ) : null}
          {note ? (
            <p data-slot="chart-frame-note" className="m-0">
              <span className="text-foreground font-medium">{labels.note}:</span> {note}
            </p>
          ) : null}
          {updated || download ? (
            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
              {updated ? (
                <span>
                  {labels.updated}{' '}
                  <time data-slot="chart-frame-updated" dateTime={updated}>
                    {dateText}
                  </time>
                </span>
              ) : null}
              {download ? (
                <a
                  data-slot="chart-frame-download"
                  href={href}
                  download={filename}
                  className="text-foreground inline-flex min-h-target items-center gap-1.5 rounded-sm font-medium underline decoration-border underline-offset-2 hover:decoration-current focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                >
                  <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
                  </svg>
                  {labels.download}
                </a>
              ) : null}
            </p>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
});
ChartFrame.displayName = 'ChartFrame';
