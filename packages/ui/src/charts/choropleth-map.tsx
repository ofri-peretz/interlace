'use client';

/**
 * @interlace/ui — ChoroplethMap
 *
 * A value per area, shown as shades of one colour on a map: share of homes
 * with solar panels by district, turnout by county, rainfall by region.
 *
 * ## Interlace ships no geography
 *
 * You pass the shapes as SVG path data already projected into `viewBox`
 * (export them once from your GIS tool or with d3-geo at build time). The
 * component never fetches a map, never bundles a boundary file and never
 * decides where a border runs: those are your data and your claims. It does
 * the parts every map gets wrong: the legend, the missing data, the keyboard
 * and the table.
 *
 * ## Classes, not a smooth ramp
 *
 * Values are put into a few classes (`bins`, 5 by default) and each class
 * gets one shade, light to dark, of a single tone. A reader can match five
 * shades to a legend; nobody can read a value off a continuous gradient.
 * The class breaks are quantiles by default (each class holds about the same
 * number of areas), `equal` intervals on request, or your own `breaks`.
 * `mapBins()` and `binOf()` are exported and pure.
 *
 * ## Missing is not zero
 *
 * An area without a value is hatched and the legend says "No data". Drawing
 * it in the lightest shade would tell the reader its value is the lowest.
 *
 * ## Every area is reachable without a mouse
 *
 * The map takes focus once. Arrow keys step through the areas in name order,
 * Home and End jump to the ends, Escape lets go, and the readout under the
 * map (`aria-live="polite"`) says the area, its value and its class. The
 * pointer path runs through the same state, so the two cannot disagree. A
 * legend entry picks out its class. A table of every area and value sits
 * behind the picture (`showTable` shows it).
 *
 * ## Motion
 *
 * None on entry: a map is read by its colours, and fading them in only
 * delays that. Pointing at an area raises its outline; under reduced motion
 * the change is instant.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The SVG scales to its box; the legend wraps.
 *
 * ## Anatomy
 *
 *   <figure data-slot="choropleth-map">
 *     <figcaption data-slot="choropleth-map-label">{label}</figcaption>
 *     <div data-slot="choropleth-map-legend"> {legendLabel}
 *       <ul> <button data-slot="choropleth-map-legend-item" aria-pressed /> × bins, No data </ul>
 *     </div>
 *     <svg data-slot="choropleth-map-plot" role="img" tabIndex=0 aria-label="{summary}">
 *       <path data-slot="choropleth-map-area" data-bin /> × areas
 *       <path data-slot="choropleth-map-active" />          (the focused area's outline)
 *     </svg>
 *     <output data-slot="choropleth-map-readout" aria-live="polite" />
 *     <div data-slot="choropleth-map-table" />              (sr-only unless showTable;
 *                                                            then a focusable scroll region)
 *   </figure>
 *
 * | Rule | Concept                    | Where in this file                                       |
 * | ---- | -------------------------- | -------------------------------------------------------- |
 * | R4   | Extends native el          | `React.ComponentProps<'figure'>`                          |
 * | R6   | data-slot on every part    | `choropleth-map` / `-label` / `-legend` / `-legend-item` / `-plot` / `-area` / `-active` / `-readout` / `-table` |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                  |
 * | R8   | Enums, not booleans        | `binning: 'quantile' \| 'equal'`, `tone`                  |
 * | R13  | Ecosystem first            | no map dep: your paths, `mapBins` + SVG                   |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`                |
 * | R18  | Tailwind only              | zero inline `style`                                       |
 * | R19  | Tokens only                | `--chart-1..5` mixed with `--background`, `--muted-foreground` |
 * | R23  | Loading reserves its box   | `loading` → `<Skeleton variant="chart">`                  |
 * | R25  | Client component           | focus, pointer and the readout run in the browser         |
 * | R26  | A11y                       | `role="img"` + sentence + keyboard + live readout + table |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

export type MapTone = 1 | 2 | 3 | 4 | 5;

export type MapArea = {
  /** What `values` is keyed by. */
  id: string;
  /** The area's name. */
  label: string;
  /** SVG path data, already projected into the map's `viewBox`. */
  d: string;
};

export type MapBinning = 'quantile' | 'equal';

export type MapBins = {
  /** The class edges, lowest first: `edges[0]` is the smallest value, the last edge the largest. */
  edges: number[];
};

/** The tone the shades are mixed from. Written out so Tailwind sees them. */
const TONE: Record<MapTone, string> = {
  1: '[--map-tone:var(--chart-1)]',
  2: '[--map-tone:var(--chart-2)]',
  3: '[--map-tone:var(--chart-3)]',
  4: '[--map-tone:var(--chart-4)]',
  5: '[--map-tone:var(--chart-5)]',
};

/** Seven shades, lightest first. A map with fewer classes takes evenly spaced steps from this ladder. */
const LADDER = [
  'fill-[color-mix(in_oklab,var(--map-tone),var(--background)_85%)]',
  'fill-[color-mix(in_oklab,var(--map-tone),var(--background)_70%)]',
  'fill-[color-mix(in_oklab,var(--map-tone),var(--background)_55%)]',
  'fill-[color-mix(in_oklab,var(--map-tone),var(--background)_40%)]',
  'fill-[color-mix(in_oklab,var(--map-tone),var(--background)_22%)]',
  'fill-(--map-tone)',
  'fill-[color-mix(in_oklab,var(--map-tone),var(--foreground)_35%)]',
] as const;

/** The most classes a reader can match to a legend. */
export const MAX_BINS = LADDER.length;

// ─────────────────────────────────────────────────────────────────
// Pure classing
// ─────────────────────────────────────────────────────────────────

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Class edges for a set of values. `bins` classes need `bins + 1` edges;
 * quantile edges that coincide (many equal values) are merged, so a map can
 * end up with fewer classes than asked for, never with an empty one.
 */
export function mapBins(
  values: readonly (number | null | undefined)[],
  options: { bins?: number; binning?: MapBinning; breaks?: readonly number[] } = {},
): MapBins {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  if (sorted.length === 0) return { edges: [] };
  const min = sorted[0]!;
  const max = sorted.at(-1)!;
  let inner: number[];
  if (options.breaks) {
    inner = [...options.breaks].filter((b) => b > min && b < max).sort((a, b) => a - b);
  } else {
    const bins = Math.max(1, Math.min(MAX_BINS, Math.round(options.bins ?? 5)));
    inner =
      options.binning === 'equal'
        ? Array.from({ length: bins - 1 }, (_, i) => min + ((max - min) * (i + 1)) / bins)
        : Array.from({ length: bins - 1 }, (_, i) => sorted[Math.floor(((i + 1) * sorted.length) / bins)]!);
  }
  const edges = [min, ...inner, max].filter((edge, i, all) => i === 0 || edge > all[i - 1]!);
  if (edges.length === 1) edges.push(max);
  return { edges };
}

/** The class a value falls in: edges[i] ≤ v < edges[i + 1], the top class closed. -1 for no value. */
export function binOf(value: number | null | undefined, { edges }: MapBins): number {
  if (!finite(value) || edges.length < 2) return -1;
  const last = edges.length - 2;
  for (let i = 0; i < last; i++) if (value < edges[i + 1]!) return i;
  return last;
}

/**
 * Which ladder step each of `count` classes takes: spread evenly, farthest
 * from the page last. Up to six classes stop at the tone itself; the seventh
 * shade (the tone deepened) is used only when all seven are needed, so no two
 * classes ever share a shade.
 */
export function shadeSteps(count: number): number[] {
  const top = count >= LADDER.length ? LADDER.length - 1 : LADDER.length - 2;
  if (count <= 1) return [top];
  return Array.from({ length: count }, (_, i) => Math.round((i * top) / (count - 1)));
}

/** One sentence for the whole map: how many areas, the range, and the highest and lowest. */
export function describeMap(
  areas: readonly MapArea[],
  values: Readonly<Record<string, number | null | undefined>>,
  format: (v: number) => string,
): string {
  const known = areas.filter((a) => finite(values[a.id])).sort((a, b) => values[b.id]! - values[a.id]!);
  const missing = areas.length - known.length;
  if (known.length === 0) return `Map of ${areas.length} areas. No data.`;
  const high = known[0]!;
  const low = known.at(-1)!;
  return (
    `Map of ${areas.length} areas. Highest: ${high.label}, ${format(values[high.id]!)}. ` +
    `Lowest: ${low.label}, ${format(values[low.id]!)}.` +
    (missing > 0 ? ` No data for ${missing}.` : '')
  );
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export interface ChoroplethMapProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  /** The areas, as SVG paths in `viewBox` coordinates. */
  areas: readonly MapArea[];
  /** A value per area id. Missing or null is drawn as "No data", never as the lowest class. */
  values: Readonly<Record<string, number | null | undefined>>;
  /** The coordinate box the paths are drawn in, such as `'0 0 800 600'`. */
  viewBox: string;
  /** How many classes. @default 5, at most 7 */
  bins?: number;
  /** `quantile` (each class holds about as many areas) or `equal` intervals. @default 'quantile' */
  binning?: MapBinning;
  /** Your own class breaks, between the smallest and largest value. Overrides `bins` and `binning`. */
  breaks?: readonly number[];
  /** The chart hue the shades are mixed from. @default 1 */
  tone?: MapTone;
  /** How values print, as `Intl.NumberFormat` options. @default plain numbers */
  format?: Intl.NumberFormatOptions;
  /** A BCP 47 locale for the numbers. @default the reader's */
  locale?: string;
  /** The chart's title. */
  label?: React.ReactNode;
  /** What the legend's swatches mean, such as "Homes with solar panels". */
  legendLabel?: string;
  /** Show the table of areas, which otherwise is for screen readers only. */
  showTable?: boolean;
  /** Reserve the map's box while the data loads. */
  loading?: boolean;
}

export const ChoroplethMap = React.forwardRef<HTMLElement, ChoroplethMapProps>(function ChoroplethMap(
  {
    areas,
    values,
    viewBox,
    bins = 5,
    binning = 'quantile',
    breaks,
    tone = 1,
    format: formatOptions,
    locale,
    label,
    legendLabel,
    showTable = false,
    loading = false,
    className,
    ...props
  },
  ref,
) {
  const labelId = React.useId();
  const hatchId = `${React.useId().replaceAll(':', '')}-hatch`;
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [focused, setFocused] = React.useState<number | null>(null);
  const [activeBin, setActiveBin] = React.useState<number | null>(null);
  const [pinnedBin, setPinnedBin] = React.useState<number | null>(null);

  const number = React.useMemo(() => new Intl.NumberFormat(locale, formatOptions), [locale, formatOptions]);
  const format = (v: number) => number.format(v);

  const classes = React.useMemo(
    () => mapBins(areas.map((a) => values[a.id]), { bins, binning, breaks }),
    [areas, values, bins, binning, breaks],
  );
  const classCount = Math.max(0, classes.edges.length - 1);
  const tableCaption = typeof label === 'string' ? `${label}: by area` : 'Values by area';
  const steps = shadeSteps(classCount);
  // Keyboard order: by name, so a reader who knows the area's name can find it.
  const order = React.useMemo(
    () => areas.map((a, i) => ({ a, i })).sort((x, y) => x.a.label.localeCompare(y.a.label, locale)).map((x) => x.i),
    [areas, locale],
  );

  if (loading) {
    return (
      <figure
        ref={ref}
        data-slot="choropleth-map"
        data-state="loading"
        data-min-viewport={String(MIN_VIEWPORT)}
        aria-busy="true"
        className={cn('m-0 w-full', className)}
        {...props}
      >
        <Skeleton variant="chart" />
      </figure>
    );
  }

  if (areas.length === 0) {
    return (
      <figure
        ref={ref}
        data-slot="choropleth-map"
        data-state="empty"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 w-full rounded-xl border border-border p-6', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">No areas to show yet.</p>
      </figure>
    );
  }

  const binOfArea = (i: number) => binOf(values[areas[i]!.id], classes);
  const active = hovered ?? focused;
  const highlightBin = activeBin ?? pinnedBin;
  const missing = areas.some((a) => !finite(values[a.id]));
  const summary = describeMap(areas, values, format);
  const range = (b: number) => `${format(classes.edges[b]!)}–${format(classes.edges[b + 1]!)}`;

  const step = (delta: number | 'first' | 'last') => {
    const at = focused === null ? -1 : order.indexOf(focused);
    const next =
      delta === 'first'
        ? 0
        : delta === 'last'
          ? order.length - 1
          : at === -1
            ? delta > 0
              ? 0
              : order.length - 1
            : (at + delta + order.length) % order.length;
    setFocused(order[next]!);
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => step(1),
      ArrowDown: () => step(1),
      ArrowLeft: () => step(-1),
      ArrowUp: () => step(-1),
      Home: () => step('first'),
      End: () => step('last'),
      Escape: () => setFocused(null),
    };
    const run = keys[event.key];
    // With nothing picked out, Escape belongs to the page (a dialog around the map, say).
    if (!run || (event.key === 'Escape' && focused === null)) return;
    event.preventDefault();
    run();
  };

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const index = (event.target as Element).getAttribute('data-index');
    setHovered(index === null ? null : Number(index));
  };

  const readout =
    active === null
      ? null
      : (() => {
          const area = areas[active]!;
          const v = values[area.id];
          const b = binOfArea(active);
          return finite(v) ? `${area.label}: ${format(v)} (${range(b)})` : `${area.label}: no data`;
        })();

  // The hatch is a pattern, so missing areas take it as a `fill` attribute; classes cannot name an id made at render.
  const hatch = `url(#${hatchId})`;
  const fillOf = (b: number) => (b === -1 ? undefined : LADDER[steps[b]!]);

  return (
    <figure
      ref={ref}
      data-slot="choropleth-map"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={label ? labelId : undefined}
      className={cn('m-0 flex w-full min-w-0 flex-col gap-3', TONE[tone], className)}
      {...props}
    >
      {label ? (
        <figcaption id={labelId} data-slot="choropleth-map-label" className="text-foreground text-ui-sm font-medium">
          {label}
        </figcaption>
      ) : null}

      <div data-slot="choropleth-map-legend" className="flex flex-col gap-1">
        {legendLabel ? <p className="text-muted-foreground m-0 text-caption">{legendLabel}</p> : null}
        <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-ui-sm tabular-nums">
          {Array.from({ length: classCount }, (_, b) => (
            <li key={b}>
              <button
                type="button"
                aria-pressed={pinnedBin === b}
                data-slot="choropleth-map-legend-item"
                data-active={highlightBin === b ? '' : undefined}
                onPointerEnter={() => setActiveBin(b)}
                onPointerLeave={() => setActiveBin(null)}
                onFocus={() => setActiveBin(b)}
                onBlur={() => setActiveBin(null)}
                onClick={() => setPinnedBin((current) => (current === b ? null : b))}
                className={cn(
                  '-mx-1.5 flex min-h-target items-center gap-2 rounded-md px-1.5 py-0.5',
                  'hover:bg-muted data-[active]:bg-muted aria-pressed:bg-muted',
                  'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
                )}
              >
                <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0 overflow-visible">
                  <rect width="12" height="12" rx="2" strokeWidth={1} className={cn(LADDER[steps[b]!], 'stroke-border')} />
                </svg>
                <span className="text-foreground">{range(b)}</span>
              </button>
            </li>
          ))}
          {missing ? (
            <li className="flex min-h-target items-center gap-2 py-0.5">
              <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0 overflow-visible">
                <rect width="12" height="12" rx="2" strokeWidth={1} fill={hatch} className="stroke-border" />
              </svg>
              <span className="text-muted-foreground">No data</span>
            </li>
          ) : null}
        </ul>
      </div>

      <svg
        data-slot="choropleth-map-plot"
        viewBox={viewBox}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setFocused(null)}
        onPointerMove={point}
        onPointerLeave={() => setHovered(null)}
        className={cn(
          'block h-auto w-full rounded-md',
          'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        )}
      >
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="fill-muted" />
            <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2" className="stroke-muted-foreground/50" />
          </pattern>
        </defs>
        {areas.map((area, i) => {
          const b = binOfArea(i);
          return (
            <path
              key={area.id}
              data-slot="choropleth-map-area"
              data-index={i}
              data-bin={b}
              d={area.d}
              fill={b === -1 ? hatch : undefined}
              vectorEffect="non-scaling-stroke"
              strokeWidth={0.75}
              strokeLinejoin="round"
              className={cn(
                'stroke-background motion-safe:transition-opacity motion-safe:duration-(--duration-fast)',
                fillOf(b),
                highlightBin !== null && b !== highlightBin && 'opacity-25',
              )}
            >
              <title>{finite(values[area.id]) ? `${area.label}: ${format(values[area.id]!)}` : `${area.label}: no data`}</title>
            </path>
          );
        })}
        {active !== null ? (
          <path
            data-slot="choropleth-map-active"
            d={areas[active]!.d}
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeLinejoin="round"
            className="stroke-foreground pointer-events-none fill-none"
          />
        ) : null}
      </svg>

      <output
        data-slot="choropleth-map-readout"
        aria-live="polite"
        className="text-muted-foreground min-h-[1lh] text-caption tabular-nums"
      >
        {readout ?? (classCount > 0 ? 'Point at an area, or focus the map and use the arrow keys.' : '')}
      </output>

      {/* Shown, the table scrolls, so it takes focus and a name: keyboard users can scroll it too. */}
      <div
        data-slot="choropleth-map-table"
        className={cn(
          showTable
            ? 'focus-visible:ring-ring max-h-96 overflow-auto rounded-md focus-visible:ring-2 focus-visible:outline-none'
            : 'sr-only',
        )}
        {...(showTable ? { role: 'region', tabIndex: 0, 'aria-label': tableCaption } : {})}
      >
        <table className="w-full text-ui-sm tabular-nums">
          <caption className="text-muted-foreground pb-2 text-start text-caption">{tableCaption}</caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-1.5 pe-4 text-start font-medium">
                Area
              </th>
              <th scope="col" className="py-1.5 text-end font-medium">
                {legendLabel ?? 'Value'}
              </th>
            </tr>
          </thead>
          <tbody>
            {order.map((i) => {
              const area = areas[i]!;
              const v = values[area.id];
              return (
                <tr key={area.id} className="border-border border-b">
                  <th scope="row" className="py-1.5 pe-4 text-start font-normal">
                    {area.label}
                  </th>
                  <td className="py-1.5 text-end">{finite(v) ? format(v) : 'No data'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
});
ChoroplethMap.displayName = 'ChoroplethMap';
