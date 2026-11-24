'use client';

/**
 * @interlace/ui — SeatChart
 *
 * How an assembly divides its seats: a half-circle of dots, one per seat,
 * filled group by group from left to right. It answers the question a
 * results table cannot answer at a glance: who holds the room, and how far
 * the largest group is from a majority.
 *
 * ## The layout
 *
 * Seats sit on concentric rows of the half-circle with one pitch for every
 * row, so seats are evenly spaced along each arc and between arcs. The row
 * count is the smallest that holds the total; each row takes a share of the
 * seats in proportion to its length. All seats are then ordered by angle,
 * left to right, and handed to the groups in the order given. So each group
 * is a wedge, and the seat at the top centre is the one a majority must
 * reach. `seatLayout()` is exported and pure, so the geometry is tested on
 * its own.
 *
 * ## Colour is never the only channel
 *
 * The legend prints every group's count next to its name, in the same order
 * as the wedges. The SVG is one `role="img"` with a sentence that names the
 * total, each group and the majority. A table of groups, seats and shares
 * sits behind the picture (`showTable` shows it). Tones are the chart
 * palette (`chart-1..5`) plus `neutral`; a seat that no group holds is drawn
 * as an outline and counted as vacant.
 *
 * ## Motion
 *
 * The whole chart is in the server HTML. The first time it scrolls into
 * view, the seats fill in once, left to right, in under a second. Under
 * `prefers-reduced-motion` they are simply there. It runs on the Web
 * Animations API, so there are no keyframes to add.
 *
 * ## Container, not viewport
 *
 * The SVG scales to its box up to 36rem, the numbers are HTML, and the
 * legend fills as many 11–14rem columns as the chart's own width holds. `SeatChartCompare`
 * sets two or three charts side by side once its own box is wide enough for
 * them, and stacks them otherwise.
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Anatomy
 *
 *   <figure data-slot="seat-chart" data-min-viewport="320">
 *     <figcaption>{label}</figcaption>
 *     <div data-slot="seat-chart-plot">
 *       <svg role="img" aria-label="{summary}">
 *         <circle data-slot="seat-chart-seat" data-group="0" /> × total
 *         <line data-slot="seat-chart-majority" />
 *       </svg>
 *       <p data-slot="seat-chart-total" aria-hidden />          (the number in the hollow)
 *     </div>
 *     <p data-slot="seat-chart-readout" />                       (seats, majority)
 *     <ul data-slot="seat-chart-legend"> <li /> × groups </ul>
 *     <table data-slot="seat-chart-table" />                     (sr-only unless showTable)
 *   </figure>
 *
 * | Rule | Concept                    | Where in this file                                        |
 * | ---- | -------------------------- | --------------------------------------------------------- |
 * | R4   | Extends native el          | `React.ComponentProps<'figure'>`                           |
 * | R6   | data-slot on every part    | `seat-chart` / `-plot` / `-seat` / `-legend` / `-table`     |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                   |
 * | R8   | Enums, not booleans        | `tone: 1..5 \| 'neutral'`                                  |
 * | R13  | Ecosystem first            | no charting dep: `seatLayout` + SVG                        |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`                 |
 * | R18  | Tailwind only              | zero inline `style`; the reveal runs on WAAPI              |
 * | R19  | Tokens only                | `fill-chart-1..5`, `fill-muted-foreground`, `stroke-foreground` |
 * | R23  | Loading reserves its box   | `loading` → `<Skeleton variant="chart">`                   |
 * | R25  | Client component           | the first-view reveal runs in the browser                  |
 * | R26  | A11y                       | `role="img"` + sentence + counts in the legend + table     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

export type SeatTone = 1 | 2 | 3 | 4 | 5 | 'neutral';

export type SeatGroup = {
  /** The group's name, as the legend and the table print it. */
  label: string;
  /** Seats it holds. */
  seats: number;
  /** Its colour: a chart palette slot or neutral. @default the next of 1..5 in order */
  tone?: SeatTone;
};

const TONE_FILL: Record<SeatTone, string> = {
  1: 'fill-chart-1',
  2: 'fill-chart-2',
  3: 'fill-chart-3',
  4: 'fill-chart-4',
  5: 'fill-chart-5',
  neutral: 'fill-muted-foreground',
};

const toneOf = (group: SeatGroup, index: number): SeatTone =>
  group.tone ?? (((index % 5) + 1) as SeatTone);

// ─────────────────────────────────────────────────────────────────
// Geometry
// ─────────────────────────────────────────────────────────────────

/** Inner radius of the half-circle, as a share of the outer. The hollow holds the total. */
const INNER = 0.4;

export type Seat = {
  /** Distance from the centre, 0 to 1 (1 = the outer row). */
  r: number;
  /** Angle in radians, π (left) to 0 (right). */
  angle: number;
  /** Row index, 0 = the innermost. */
  row: number;
};

export type SeatLayout = {
  seats: Seat[];
  rows: number;
  /** Distance between neighbouring seats, in the same unit as `r`. */
  pitch: number;
};

function rowRadii(rows: number): { radii: number[]; pitch: number } {
  if (rows === 1) return { radii: [(1 + INNER) / 2], pitch: 1 - INNER };
  const pitch = (1 - INNER) / (rows - 1);
  return { radii: Array.from({ length: rows }, (_, i) => INNER + i * pitch), pitch };
}

const capacity = (r: number, pitch: number) => Math.floor((Math.PI * r) / pitch) + 1;

/**
 * Place `total` seats on a half-circle: the fewest rows that hold them,
 * seats shared between rows by length, all ordered left to right.
 */
export function seatLayout(total: number): SeatLayout {
  const count = Math.max(0, Math.floor(total));
  if (count === 0) return { seats: [], rows: 0, pitch: 0 };

  let rows = 1;
  let shape = rowRadii(rows);
  while (shape.radii.reduce((sum, r) => sum + capacity(r, shape.pitch), 0) < count) {
    rows += 1;
    shape = rowRadii(rows);
  }
  const { radii, pitch } = shape;

  // Share the seats by row length: each row takes its whole share, and the
  // seats left over go to the rows with the largest remainders.
  const length = radii.reduce((sum, r) => sum + r, 0);
  const exact = radii.map((r) => (count * r) / length);
  const perRow = exact.map(Math.floor);
  const left = count - perRow.reduce((sum, n) => sum + n, 0);
  exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .sort((a, b) => b.rest - a.rest)
    .slice(0, left)
    .forEach(({ i }) => {
      perRow[i]! += 1;
    });

  const seats: Seat[] = [];
  radii.forEach((r, row) => {
    const n = perRow[row]!;
    for (let k = 0; k < n; k++) {
      const angle = n === 1 ? Math.PI / 2 : Math.PI * ((n - 1 - k) / (n - 1));
      seats.push({ r, angle, row });
    }
  });
  // Left to right; on a tie, the outer row first, so a wedge fills its
  // column from the rim inward.
  seats.sort((a, b) => b.angle - a.angle || b.r - a.r);
  return { seats, rows, pitch };
}

// ─────────────────────────────────────────────────────────────────
// Words
// ─────────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The sentence a screen reader hears for the picture. */
export function describeSeats(groups: readonly SeatGroup[], total: number, majority?: number): string {
  const held = groups.reduce((sum, g) => sum + g.seats, 0);
  const parts = [`${plural(total, 'seat', 'seats')}.`];
  if (groups.length > 0) {
    parts.push(`${groups.map((g) => `${g.label} ${g.seats.toLocaleString()}`).join(', ')}.`);
  }
  if (total > held) parts.push(`${plural(total - held, 'seat', 'seats')} vacant.`);
  if (majority !== undefined) parts.push(`A majority is ${majority.toLocaleString()}.`);
  const largest = groups.reduce<SeatGroup | undefined>((best, g) => (!best || g.seats > best.seats ? g : best), undefined);
  if (largest && majority !== undefined) {
    parts.push(
      largest.seats >= majority
        ? `${largest.label} holds a majority on its own.`
        : `The largest group, ${largest.label}, is ${plural(majority - largest.seats, 'seat', 'seats')} short.`,
    );
  }
  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────
// SeatChart
// ─────────────────────────────────────────────────────────────────

/** Drawing box. The viewBox scales it to any width. */
const W = 400;
const SCALE = 188;
const TOP = 18;
const CX = W / 2;
const CY = TOP + SCALE;

const SPREAD_MS = 520;
const SEAT_MS = 280;
const EASE_ENTER = 'cubic-bezier(0.2, 0, 0, 1)';

export interface SeatChartProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  /** The groups, in the order their wedges run left to right. */
  groups: readonly SeatGroup[];
  /** Seats in the assembly. @default the sum of the groups; any seats beyond it are vacant */
  total?: number;
  /** Seats needed for a majority, marked at the top of the arc. Leave out for no mark. */
  majority?: number;
  /** The chart's title, such as the election or the year. */
  label?: React.ReactNode;
  /** The noun under the total. @default 'seats' */
  seatsLabel?: string;
  /** Show the table of groups and seats, which otherwise is for screen readers only. */
  showTable?: boolean;
  /** Reserve the chart's box while the data loads. */
  loading?: boolean;
}

export const SeatChart = React.forwardRef<HTMLElement, SeatChartProps>(function SeatChart(
  {
    groups,
    total: totalProp,
    majority,
    label,
    seatsLabel = 'seats',
    showTable = false,
    loading = false,
    className,
    ...props
  },
  ref,
) {
  const reduced = useReducedMotion();
  const labelId = React.useId();
  const plotRef = React.useRef<SVGSVGElement>(null);
  const held = groups.reduce((sum, g) => sum + Math.max(0, g.seats), 0);
  const total = Math.max(held, Math.floor(totalProp ?? held));
  const layout = React.useMemo(() => seatLayout(total), [total]);

  // Which group holds each seat, in left-to-right order. -1 is vacant.
  const owner: number[] = [];
  groups.forEach((g, index) => {
    for (let k = 0; k < Math.max(0, g.seats); k++) owner.push(index);
  });
  while (owner.length < total) owner.push(-1);

  // The first view fills the seats in, once, left to right.
  React.useLayoutEffect(() => {
    const svg = plotRef.current;
    if (!svg || reduced || typeof IntersectionObserver === 'undefined') return;
    const seats = Array.from(svg.querySelectorAll<SVGElement>('[data-slot="seat-chart-seat"]'));
    if (typeof seats[0]!.animate !== 'function') return;
    for (const seat of seats) seat.style.opacity = '0';
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const last = Math.max(1, seats.length - 1);
        seats.forEach((seat, i) => {
          seat.style.opacity = '';
          seat.animate(
            [
              { opacity: 0, transform: 'scale(0.4)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: SEAT_MS, delay: (i / last) * SPREAD_MS, easing: EASE_ENTER, fill: 'backwards' },
          );
        });
      },
      { threshold: 0.25 },
    );
    io.observe(svg);
    return () => {
      io.disconnect();
      for (const seat of seats) {
        seat.style.opacity = '';
        for (const animation of seat.getAnimations()) animation.cancel();
      }
    };
  }, [reduced, total, groups.length]);

  if (loading) {
    return (
      <Skeleton
        variant="chart"
        data-slot="seat-chart"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={className}
      />
    );
  }

  if (total === 0) {
    return (
      <figure
        ref={ref}
        data-slot="seat-chart-empty"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 w-full rounded-xl border border-border p-6', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">No seats to show yet.</p>
      </figure>
    );
  }

  const seatRadius = layout.pitch * SCALE * 0.42;
  // The bottom row sits on the centre line; the box ends just past its seats.
  const H = Math.ceil(CY + seatRadius + 2);
  const summary = describeSeats(groups, total, majority);
  const pct = (n: number) => `${((n / total) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  const vacant = total - held;

  return (
    <figure
      ref={ref}
      data-slot="seat-chart"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-total={String(total)}
      aria-labelledby={label ? labelId : undefined}
      className={cn('@container/seats m-0 flex w-full min-w-0 flex-col gap-3', className)}
      {...props}
    >
      {label ? (
        <figcaption id={labelId} data-slot="seat-chart-label" className="text-foreground text-ui-sm font-medium">
          {label}
        </figcaption>
      ) : null}

      <div data-slot="seat-chart-plot" className="relative mx-auto w-full max-w-144">
        <svg ref={plotRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={summary}>
          {layout.seats.map((seat, i) => {
            const group = owner[i]!;
            const x = CX + seat.r * SCALE * Math.cos(seat.angle);
            const y = CY - seat.r * SCALE * Math.sin(seat.angle);
            return (
              <circle
                key={i}
                data-slot="seat-chart-seat"
                data-group={group}
                cx={Number(x.toFixed(2))}
                cy={Number(y.toFixed(2))}
                r={Number(seatRadius.toFixed(2))}
                strokeWidth={group === -1 ? 1.25 : undefined}
                className={cn(
                  'origin-center [transform-box:fill-box]',
                  group === -1
                    ? 'fill-none stroke-muted-foreground'
                    : TONE_FILL[toneOf(groups[group]!, group)],
                )}
              />
            );
          })}
          {majority !== undefined ? (
            <line
              data-slot="seat-chart-majority"
              x1={CX}
              x2={CX}
              y1={1}
              y2={TOP - 4}
              strokeWidth={2}
              strokeLinecap="round"
              className="stroke-foreground"
            />
          ) : null}
        </svg>
        <p
          data-slot="seat-chart-total"
          aria-hidden
          className="text-foreground pointer-events-none absolute inset-x-0 bottom-0 m-0 text-center leading-none font-semibold tabular-nums text-[min(2.25rem,11cqi)]"
        >
          {total.toLocaleString()}
        </p>
      </div>

      <p
        data-slot="seat-chart-readout"
        className="text-muted-foreground m-0 text-center text-caption tabular-nums"
      >
        {plural(total, seatsLabel === 'seats' ? 'seat' : seatsLabel, seatsLabel)}
        {majority !== undefined ? (
          <>
            <span aria-hidden> · </span>
            <span className="sr-only">, </span>
            {majority.toLocaleString()} for a majority
          </>
        ) : null}
      </p>

      {groups.length > 0 ? (
        <ul
          data-slot="seat-chart-legend"
          className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),14rem))] gap-x-8 gap-y-1.5 p-0 text-ui-sm"
        >
          {groups.map((group, index) => (
            <li key={`${group.label}-${index}`} className="flex min-w-0 items-baseline gap-2">
              <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0 self-center">
                <circle cx={5} cy={5} r={5} className={TONE_FILL[toneOf(group, index)]} />
              </svg>
              <span className="text-foreground min-w-0 flex-1 break-words">{group.label}</span>
              <span className="text-foreground shrink-0 font-medium tabular-nums">
                {group.seats.toLocaleString()}
              </span>
            </li>
          ))}
          {vacant > 0 ? (
            <li className="flex min-w-0 items-baseline gap-2">
              <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0 self-center">
                <circle cx={5} cy={5} r={4.25} strokeWidth={1.5} className="fill-none stroke-muted-foreground" />
              </svg>
              <span className="text-muted-foreground min-w-0 flex-1">Vacant</span>
              <span className="text-foreground shrink-0 font-medium tabular-nums">{vacant.toLocaleString()}</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div data-slot="seat-chart-table" className={cn(showTable ? 'overflow-x-auto' : 'sr-only')}>
        <table className="w-full text-ui-sm tabular-nums">
          <caption className="text-muted-foreground pb-2 text-start text-caption">
            {typeof label === 'string' ? `${label}: seats by group` : 'Seats by group'}
          </caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-1.5 pe-4 text-start font-medium">
                Group
              </th>
              <th scope="col" className="py-1.5 pe-4 text-end font-medium">
                Seats
              </th>
              <th scope="col" className="py-1.5 text-end font-medium">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <tr key={`${group.label}-${index}`} className="border-border border-b">
                <th scope="row" className="py-1.5 pe-4 text-start font-normal">
                  {group.label}
                </th>
                <td className="py-1.5 pe-4 text-end">{group.seats.toLocaleString()}</td>
                <td className="py-1.5 text-end">{pct(group.seats)}</td>
              </tr>
            ))}
            {vacant > 0 ? (
              <tr className="border-border border-b">
                <th scope="row" className="py-1.5 pe-4 text-start font-normal">
                  Vacant
                </th>
                <td className="py-1.5 pe-4 text-end">{vacant.toLocaleString()}</td>
                <td className="py-1.5 text-end">{pct(vacant)}</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-1.5 pe-4 text-start font-medium">
                Total
              </th>
              <td className="py-1.5 pe-4 text-end font-medium">{total.toLocaleString()}</td>
              <td className="py-1.5 text-end">{majority !== undefined ? `Majority ${majority.toLocaleString()}` : ''}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </figure>
  );
});
SeatChart.displayName = 'SeatChart';

// ─────────────────────────────────────────────────────────────────
// SeatChartCompare
// ─────────────────────────────────────────────────────────────────

const COLUMNS = {
  2: '@2xl/compare:grid-cols-2',
  3: '@4xl/compare:grid-cols-3',
} as const;

export interface SeatChartCompareProps extends React.ComponentProps<'div'> {
  /** How many charts sit side by side when there is room. @default 2 */
  columns?: keyof typeof COLUMNS;
}

/**
 * Two or three seat charts side by side (two elections, say), stacked when
 * the box is too narrow for them. The switch is a container query on this
 * box, not the window.
 */
export function SeatChartCompare({ columns = 2, className, ...props }: SeatChartCompareProps) {
  return (
    <div data-slot="seat-chart-compare" className={cn('@container/compare', className)}>
      <div className={cn('grid grid-cols-1 gap-x-10 gap-y-12', COLUMNS[columns])} {...props} />
    </div>
  );
}
