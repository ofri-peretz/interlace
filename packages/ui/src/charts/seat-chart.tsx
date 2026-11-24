'use client';

/**
 * @interlace/ui — SeatChart
 *
 * How an assembly divides its seats: a half-circle of dots, one per seat,
 * filled group by group. It answers the question a results table cannot
 * answer at a glance: who holds the room, and how far each side is from a
 * majority.
 *
 * ## The layout
 *
 * Seats sit on concentric rows of the half-circle with one pitch for every
 * row, so seats are evenly spaced along each arc and between arcs. The row
 * count is the smallest that holds the total; each row takes a share of the
 * seats in proportion to its length. All seats are then ordered by angle and
 * handed to the groups in turn, so each group is a wedge, and the seat at the
 * top centre is the one a majority must reach. `seatLayout()` is exported
 * and pure, so the geometry is tested on its own.
 *
 * ## Sides
 *
 * Pass `sides` (government and opposition, say; they are only labelled
 * props) and give each group a `side`. Each side has one tone, and every
 * group in it takes a distinguishable shade of that tone, so the split reads
 * in colour first and the groups inside it second. The first side fills from
 * the left end, the last from the right end, and anything else sits between
 * them, next to the majority mark. Big totals for each side sit above the
 * arc (`tally`). Without sides, each group has its own colour: the five
 * chart hues in order, then the same hues alternately deeper and paler, then
 * a pale grey; a tone used
 * twice gets its next shade, so neighbours never merge. There are five
 * shades per tone: a sixth group on one side starts the shades again, so
 * split a side that large across two tones, or rely on the legend counts.
 *
 * ## Colour is never the only channel
 *
 * The legend prints every count beside its name, by side. The SVG is one
 * `role="img"` with a sentence that names the total, every side and group,
 * and who is how far from a majority. A table of groups, sides, seats and
 * shares sits behind the picture (`showTable` shows it). Seats no group
 * holds are drawn as outlines and counted as vacant. Every shade keeps 3:1
 * against the page in light and dark.
 *
 * ## Pointing at a group
 *
 * Hovering a seat or a legend entry, or focusing a legend entry, dims every
 * other group and puts that group's count in the middle of the arc. A click
 * on a legend entry pins it (`aria-pressed`); a second click lets go. The
 * dimming is a colour change, instant under reduced motion.
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
 * The SVG scales to its box up to 36rem, the numbers are HTML sized against
 * the chart's own width, and the legend fills as many 11–14rem columns as
 * that width holds. `SeatChartCompare` sets two or three charts side by side
 * once its own box is wide enough for them, and stacks them otherwise.
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Anatomy
 *
 *   <figure data-slot="seat-chart" data-min-viewport="320">
 *     <figcaption>{label}</figcaption>
 *     <div data-slot="seat-chart-tally" />                       (big side totals)
 *     <div data-slot="seat-chart-plot">
 *       <svg role="img" aria-label="{summary}">
 *         <circle data-slot="seat-chart-seat" data-group="0" /> × total
 *         <line data-slot="seat-chart-majority" />
 *       </svg>
 *       <p data-slot="seat-chart-total" aria-hidden />          (the number in the hollow)
 *     </div>
 *     <p data-slot="seat-chart-readout" />                       (majority caption)
 *     <div data-slot="seat-chart-legend"> <button aria-pressed /> × groups </div>
 *     <table data-slot="seat-chart-table" />                     (sr-only unless showTable)
 *   </figure>
 *
 * | Rule | Concept                    | Where in this file                                        |
 * | ---- | -------------------------- | --------------------------------------------------------- |
 * | R4   | Extends native el          | `React.ComponentProps<'figure'>`                           |
 * | R6   | data-slot on every part    | `seat-chart` / `-plot` / `-seat` / `-legend` / `-table`     |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                   |
 * | R8   | Enums, not booleans        | `tone`, `tally: 'none' \| 'sides' \| 'leaders'`             |
 * | R13  | Ecosystem first            | no charting dep: `seatLayout` + SVG                        |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`                 |
 * | R18  | Tailwind only              | zero inline `style`; the reveal runs on WAAPI              |
 * | R19  | Tokens only                | `--chart-1..5`, `--muted-foreground`, mixed with `--foreground` |
 * | R23  | Loading reserves its box   | `loading` → `<Skeleton variant="chart">`                   |
 * | R25  | Client component           | the reveal and the highlight run in the browser            |
 * | R26  | A11y                       | `role="img"` + sentence + counts in the legend + table     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

export type SeatTone = 1 | 2 | 3 | 4 | 5 | 'neutral';

export type SeatSide = {
  /** What groups name in their `side`. */
  id: string;
  /** The side's name, such as "Coalition". */
  label: string;
  /** The tone family every group on this side is a shade of. */
  tone: SeatTone;
};

export type SeatGroup = {
  /** The group's name, as the legend and the table print it. */
  label: string;
  /** Seats it holds. */
  seats: number;
  /** The `id` of the side it sits with. */
  side?: string;
  /** Its colour. On a side, the side's tone is the default. @default the five hues, then the same hues deeper and paler in turn, then grey */
  tone?: SeatTone;
};

export type SeatTally = 'none' | 'sides' | 'leaders';

/**
 * Five shades per tone, in the order groups take them. Shade 0 is the token;
 * shade 1 is it deepened (30% toward black), which stays far from the token in
 * both schemes; shade 2 leans toward the page (18%, 22% for grey); shades 3 and 4 grey it toward
 * the muted text and pull it toward the text colour, and sit closer to the
 * others, so they come last. Each keeps 3:1 against the page in the default
 * light and dark themes. Written out in full so Tailwind sees every class.
 */
const SHADES: Record<SeatTone, readonly string[]> = {
  1: [
    'fill-chart-1',
    'fill-[color-mix(in_oklab,var(--chart-1),black_30%)]',
    'fill-[color-mix(in_oklab,var(--chart-1),var(--background)_18%)]',
    'fill-[color-mix(in_oklab,var(--chart-1),var(--muted-foreground)_50%)]',
    'fill-[color-mix(in_oklab,var(--chart-1),var(--foreground)_75%)]',
  ],
  2: [
    'fill-chart-2',
    'fill-[color-mix(in_oklab,var(--chart-2),black_30%)]',
    'fill-[color-mix(in_oklab,var(--chart-2),var(--background)_18%)]',
    'fill-[color-mix(in_oklab,var(--chart-2),var(--muted-foreground)_50%)]',
    'fill-[color-mix(in_oklab,var(--chart-2),var(--foreground)_75%)]',
  ],
  3: [
    'fill-chart-3',
    'fill-[color-mix(in_oklab,var(--chart-3),black_30%)]',
    'fill-[color-mix(in_oklab,var(--chart-3),var(--background)_18%)]',
    'fill-[color-mix(in_oklab,var(--chart-3),var(--muted-foreground)_50%)]',
    'fill-[color-mix(in_oklab,var(--chart-3),var(--foreground)_75%)]',
  ],
  4: [
    'fill-chart-4',
    'fill-[color-mix(in_oklab,var(--chart-4),black_30%)]',
    'fill-[color-mix(in_oklab,var(--chart-4),var(--background)_18%)]',
    'fill-[color-mix(in_oklab,var(--chart-4),var(--muted-foreground)_50%)]',
    'fill-[color-mix(in_oklab,var(--chart-4),var(--foreground)_75%)]',
  ],
  5: [
    'fill-chart-5',
    'fill-[color-mix(in_oklab,var(--chart-5),black_30%)]',
    'fill-[color-mix(in_oklab,var(--chart-5),var(--background)_18%)]',
    'fill-[color-mix(in_oklab,var(--chart-5),var(--muted-foreground)_50%)]',
    'fill-[color-mix(in_oklab,var(--chart-5),var(--foreground)_75%)]',
  ],
  neutral: [
    'fill-muted-foreground',
    'fill-[color-mix(in_oklab,var(--muted-foreground),black_30%)]',
    'fill-[color-mix(in_oklab,var(--muted-foreground),var(--background)_22%)]',
    'fill-[color-mix(in_oklab,var(--muted-foreground),var(--foreground)_55%)]',
    'fill-[color-mix(in_oklab,var(--muted-foreground),var(--foreground)_75%)]',
  ],
};

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
// Who sits where
// ─────────────────────────────────────────────────────────────────

export type PlacedGroup = SeatGroup & {
  /** Position in the `groups` prop. */
  index: number;
  /** The side's position in `sides`, or -1 when it has none. */
  sideIndex: number;
  tone: SeatTone;
  /** Which shade of its tone it takes. */
  shade: number;
};

/**
 * The colour each group takes when it names no tone and no side, in order.
 * The five hues first; then the five again, alternating deeper and paler so
 * neighbouring hues in the second round also differ in lightness (green and
 * teal, orange and gold sit far apart); then a pale grey; then the rounds
 * swapped. Measured on the default tokens: every added colour sits at least
 * as far from the rest as the base palette's own closest pair, in light and
 * dark.
 */
const DEFAULT_COLOURS: readonly (readonly [SeatTone, number])[] = [
  [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
  [1, 1], [2, 2], [3, 1], [4, 2], [5, 1],
  ['neutral', 2],
  [1, 2], [2, 1], [3, 2], [4, 1], [5, 2],
  ['neutral', 0], ['neutral', 1],
];

/**
 * Order the groups along the arc and give each its colour. With sides, the
 * first side runs from the left end, the last from the right end, and the
 * rest sit between; each group takes the next shade of its side's tone.
 * Without sides, groups keep their order and a repeated tone takes its next
 * shade. A group with no tone and no side takes the next free entry of
 * `DEFAULT_COLOURS`, so eleven lists get eleven colours. Groups that name a
 * tone claim their shades first, so the two kinds never share a fill.
 */
export function placeGroups(groups: readonly SeatGroup[], sides: readonly SeatSide[] = []): PlacedGroup[] {
  const sideAt = (id?: string) => sides.findIndex((side) => side.id === id);
  // Shades already taken per tone, so a group with its own tone and a group
  // given a default colour never share a fill.
  const taken = new Map<string, Set<number>>();
  const take = (key: string, shade?: number) => {
    const set = taken.get(key) ?? new Set<number>();
    taken.set(key, set);
    let n = shade ?? 0;
    if (shade === undefined) while (set.has(n)) n += 1;
    set.add(n);
    return n;
  };
  const isTaken = ([tone, shade]: readonly [SeatTone, number]) =>
    taken.get(`tone:${tone}`)?.has(shade) ?? false;
  // Groups that name a tone or a side claim their shades first, in order.
  const fixed = groups.map((group) => {
    const side = sides[sideAt(group.side)];
    if (group.tone) return take(`tone:${group.tone}`);
    if (side) {
      const shade = take(`side:${side.id}`);
      take(`tone:${side.tone}`, shade);
      return shade;
    }
    return undefined;
  });
  // The rest take the next default colour that is still free.
  let cursor = 0;
  const nextDefault = () => {
    for (let tries = 0; tries < DEFAULT_COLOURS.length; tries += 1) {
      const colour = DEFAULT_COLOURS[cursor % DEFAULT_COLOURS.length]!;
      cursor += 1;
      if (!isTaken(colour)) return colour;
    }
    return DEFAULT_COLOURS[(cursor - 1) % DEFAULT_COLOURS.length]!;
  };
  const placed = groups.map((group, index): PlacedGroup => {
    const sideIndex = sideAt(group.side);
    const side = sides[sideIndex];
    let tone: SeatTone = group.tone ?? side?.tone ?? 'neutral';
    let shade = fixed[index];
    if (shade === undefined) {
      const colour = nextDefault();
      tone = colour[0];
      shade = take(`tone:${tone}`, colour[1]);
    }
    return {
      ...group,
      seats: Math.max(0, Math.floor(group.seats)),
      index,
      sideIndex,
      tone,
      shade,
    };
  });
  if (sides.length === 0) return placed;

  const last = sides.length - 1;
  const left = placed.filter((g) => g.sideIndex === 0);
  const right = last > 0 ? placed.filter((g) => g.sideIndex === last).reverse() : [];
  // Middle sides in their own order, then groups with no side.
  const middle = [
    ...sides.slice(1, last).flatMap((_, k) => placed.filter((g) => g.sideIndex === k + 1)),
    ...placed.filter((g) => g.sideIndex === -1),
  ];
  return [...left, ...middle, ...right];
}

// ─────────────────────────────────────────────────────────────────
// Words
// ─────────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string, number: (n: number) => string) =>
  `${number(n)} ${n === 1 ? one : many}`;

const sideTotal = (groups: readonly SeatGroup[], id: string) =>
  groups.filter((g) => g.side === id).reduce((sum, g) => sum + Math.max(0, Math.floor(g.seats)), 0);

/** What the screen-reader sentence is built from, so it can be written in any language. */
export interface SeatSummary {
  /** Seats in the assembly. */
  total: number;
  /** Seats no group holds. */
  vacant: number;
  /** Seats needed for a majority, when given. */
  majority?: number;
  /** True when the groups are grouped into sides. */
  sided: boolean;
  /** The sides with their groups, or each group on its own when there are no sides. */
  blocs: readonly { label: string; seats: number; members: readonly SeatGroup[] }[];
  /** Groups that belong to no listed side. */
  loose: readonly SeatGroup[];
  /** The largest bloc and how many seats it is short of a majority (0 or less when it holds one). */
  largest?: { label: string; seats: number; short: number };
  /** Formats a count in the chart's locale. */
  number: (n: number) => string;
}

/** Every fixed word in SeatChart. Pass only the ones to change. */
export interface SeatChartLabels {
  /** Shown when there are no seats. */
  empty: string;
  /** The row and legend entry for seats no group holds. */
  vacant: string;
  /** The legend heading for groups outside every side. */
  noSide: string;
  /** Table column headers and the footer row. */
  group: string;
  side: string;
  seats: string;
  share: string;
  total: string;
  /** The caption under the arc when there is a majority. Gets the formatted count. */
  majorityNeeded: (majority: string) => string;
  /** The table footer's majority cell. Gets the formatted count. */
  majorityCell: (majority: string) => string;
  /** The table caption, given the chart's label when it is a string. */
  tableCaption: (label?: string) => string;
  /** The sentence a screen reader hears for the picture. */
  summary: (summary: SeatSummary) => string;
}

const LABELS: SeatChartLabels = {
  empty: 'No seats to show yet.',
  vacant: 'Vacant',
  noSide: 'No side',
  group: 'Group',
  side: 'Side',
  seats: 'Seats',
  share: 'Share',
  total: 'Total',
  majorityNeeded: (m) => `${m} needed for a majority`,
  majorityCell: (m) => `Majority ${m}`,
  tableCaption: (label) => (label ? `${label}: seats by group` : 'Seats by group'),
  summary: (s) => {
    const n = s.number;
    const count = (k: number) => plural(k, 'seat', 'seats', n);
    const list = (gs: readonly { label: string; seats: number }[]) => gs.map((g) => `${g.label} ${n(g.seats)}`).join(', ');
    const parts = [`${count(s.total)}.`];
    if (s.sided) {
      for (const b of s.blocs) parts.push(b.members.length > 0 ? `${b.label} ${n(b.seats)}: ${list(b.members)}.` : `${b.label} 0.`);
      if (s.loose.length > 0) parts.push(`No side: ${list(s.loose)}.`);
    } else if (s.blocs.length > 0) {
      parts.push(`${list(s.blocs)}.`);
    }
    if (s.vacant > 0) parts.push(`${count(s.vacant)} vacant.`);
    if (s.majority !== undefined) {
      parts.push(`A majority is ${n(s.majority)}.`);
      if (s.largest) {
        parts.push(
          s.largest.short <= 0
            ? `${s.largest.label} holds a majority${s.sided ? '' : ' on its own'}.`
            : `The largest ${s.sided ? 'side' : 'group'}, ${s.largest.label}, is ${count(s.largest.short)} short.`,
        );
      }
    }
    return parts.join(' ');
  },
};

/** The sentence a screen reader hears for the picture. */
export function describeSeats(
  groups: readonly SeatGroup[],
  total: number,
  majority?: number,
  sides: readonly SeatSide[] = [],
  { summary = LABELS.summary, locale }: { summary?: SeatChartLabels['summary']; locale?: string } = {},
): string {
  groups = groups.map((g) => ({ ...g, seats: Math.max(0, Math.floor(g.seats)) }));
  const held = groups.reduce((sum, g) => sum + g.seats, 0);
  const format = new Intl.NumberFormat(locale);
  const sided = sides.length > 0;
  const blocs = sided
    ? sides.map((side) => ({
        label: side.label,
        seats: sideTotal(groups, side.id),
        members: groups.filter((g) => g.side === side.id),
      }))
    : groups.map((g) => ({ label: g.label, seats: g.seats, members: [g] }));
  const best = blocs.reduce<(typeof blocs)[number] | undefined>(
    (top, b) => (!top || b.seats > top.seats ? b : top),
    undefined,
  );
  return summary({
    total,
    vacant: Math.max(0, total - held),
    majority,
    sided,
    blocs,
    loose: sided ? groups.filter((g) => !sides.some((side) => side.id === g.side)) : [],
    largest: best && majority !== undefined ? { label: best.label, seats: best.seats, short: majority - best.seats } : undefined,
    number: (k) => format.format(k),
  });
}

// ─────────────────────────────────────────────────────────────────
// SeatChart
// ─────────────────────────────────────────────────────────────────

/** Drawing box. The viewBox scales it to any width. */
const W = 400;
const SCALE = 188;
const TOP = 14;
const CX = W / 2;
const CY = TOP + SCALE;

const SPREAD_MS = 520;
const SEAT_MS = 280;
const EASE_ENTER = 'cubic-bezier(0.2, 0, 0, 1)';

const fillOf = (group: PlacedGroup) => {
  const shades = SHADES[group.tone];
  return shades[group.shade % shades.length]!;
};

function Swatch({ className, vacant }: { className?: string; vacant?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0 self-center">
      {vacant ? (
        <circle cx={5} cy={5} r={4.25} strokeWidth={1.5} className="fill-none stroke-muted-foreground" />
      ) : (
        <circle cx={5} cy={5} r={5} className={className} />
      )}
    </svg>
  );
}

export interface SeatChartProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  /** The groups. Without sides, their wedges run left to right in this order. */
  groups: readonly SeatGroup[];
  /** Sides the groups belong to, such as government and opposition. The first fills from the left, the last from the right. */
  sides?: readonly SeatSide[];
  /** Seats in the assembly. @default the sum of the groups; any seats beyond it are vacant */
  total?: number;
  /** Seats needed for a majority, marked at the top centre of the arc. Leave out for no mark. */
  majority?: number;
  /** The caption under the arc. @default '{majority} needed for a majority' */
  majorityLabel?: React.ReactNode;
  /** Big totals above the arc: one per side, the two largest groups, or none. @default 'sides' with sides, else 'none' */
  tally?: SeatTally;
  /** The chart's title, such as the election or the year. */
  label?: React.ReactNode;
  /**
   * The noun after a count, on screen. The spoken sentence has its own words: set
   * `labels.summary` for those. @default 'seats'
   */
  seatsLabel?: string;
  /** The same noun for a count of one. @default 'seat' when `seatsLabel` is 'seats', else `seatsLabel` */
  seatLabel?: string;
  /** The locale for numbers. @default the reader's */
  locale?: string;
  /** Replace any fixed word: headers, captions, the empty note, the spoken summary. */
  labels?: Partial<SeatChartLabels>;
  /** Show the table of groups and seats, which otherwise is for screen readers only. */
  showTable?: boolean;
  /** Reserve the chart's box while the data loads. */
  loading?: boolean;
}

export const SeatChart = React.forwardRef<HTMLElement, SeatChartProps>(function SeatChart(
  {
    groups,
    sides = [],
    total: totalProp,
    majority,
    majorityLabel,
    tally,
    label,
    seatsLabel = 'seats',
    seatLabel = seatsLabel === 'seats' ? 'seat' : seatsLabel,
    locale,
    labels: labelsProp,
    showTable = false,
    loading = false,
    className,
    ...props
  },
  ref,
) {
  const reduced = useReducedMotion();
  const labels = { ...LABELS, ...labelsProp };
  const numberFormat = new Intl.NumberFormat(locale);
  const number = (n: number) => numberFormat.format(n);
  const labelId = React.useId();
  const plotRef = React.useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [pinned, setPinned] = React.useState<number | null>(null);

  const placed = React.useMemo(() => placeGroups(groups, sides), [groups, sides]);
  const held = placed.reduce((sum, g) => sum + g.seats, 0);
  const total = Math.max(held, Math.floor(totalProp ?? held));
  const layout = React.useMemo(() => seatLayout(total), [total]);

  // Which group holds each seat, in left-to-right order. -1 is vacant: it
  // sits between the left-hand groups and a right-hand side, if any.
  const owner: number[] = [];
  const rightStart = sides.length > 1 ? placed.findIndex((g) => g.sideIndex === sides.length - 1) : -1;
  const split = rightStart === -1 ? placed.length : rightStart;
  const take = (g: PlacedGroup) => {
    for (let k = 0; k < g.seats; k++) owner.push(g.index);
  };
  placed.slice(0, split).forEach(take);
  for (let k = held; k < total; k++) owner.push(-1);
  placed.slice(split).forEach(take);

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
      <figure
        ref={ref}
        data-slot="seat-chart"
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

  if (total === 0) {
    return (
      <figure
        ref={ref}
        data-slot="seat-chart"
        data-state="empty"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('m-0 w-full rounded-xl border border-border p-6', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </figure>
    );
  }

  const byIndex = new Map(placed.map((g) => [g.index, g]));
  const active = hovered ?? pinned;
  const activeGroup = active === null ? undefined : byIndex.get(active);
  const seatRadius = layout.pitch * SCALE * 0.42;
  // The bottom row sits on the centre line; the box ends just past its seats.
  const H = Math.ceil(CY + seatRadius + 2);
  const innerEdge = CY - (0.4 * SCALE - seatRadius - 4);
  const summary = describeSeats(groups, total, majority, sides, { summary: labels.summary, locale });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const pct = (n: number) => percent.format(n / total);
  const vacant = total - held;
  const seatsWord = (n: number) => plural(n, seatLabel, seatsLabel, number);

  const tallyMode: SeatTally = tally ?? (sides.length > 0 ? 'sides' : 'none');
  const tallies: { key: string; label: string; seats: number; fill: string }[] =
    tallyMode === 'sides'
      ? sides.map((side) => ({
          key: side.id,
          label: side.label,
          seats: sideTotal(groups, side.id),
          fill: SHADES[side.tone][0]!,
        }))
      : tallyMode === 'leaders'
        ? [...placed]
            .sort((a, b) => b.seats - a.seats)
            .slice(0, 2)
            .sort((a, b) => placed.indexOf(a) - placed.indexOf(b))
            .map((g) => ({ key: `g${g.index}`, label: g.label, seats: g.seats, fill: fillOf(g) }))
        : [];

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const group = (event.target as Element).getAttribute('data-group');
    setHovered(group === null || group === '-1' ? null : Number(group));
  };

  const legendEntry = (g: PlacedGroup) => (
    <li key={g.index}>
      <button
        type="button"
        aria-pressed={pinned === g.index}
        data-slot="seat-chart-legend-item"
        data-active={active === g.index ? '' : undefined}
        onPointerEnter={() => setHovered(g.index)}
        onPointerLeave={() => setHovered(null)}
        onFocus={() => setHovered(g.index)}
        onBlur={() => setHovered(null)}
        onClick={() => setPinned((current) => (current === g.index ? null : g.index))}
        className={cn(
          '-mx-1.5 flex min-h-target w-[calc(100%+0.75rem)] min-w-0 items-baseline gap-2 rounded-md px-1.5 py-0.5 text-start',
          'hover:bg-muted data-[active]:bg-muted aria-pressed:bg-muted',
          'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
        )}
      >
        <Swatch className={fillOf(g)} />
        <span className="text-foreground min-w-0 flex-1 break-words">{g.label}</span>
        <span className="text-foreground shrink-0 font-medium tabular-nums">
          {number(g.seats)}
          <span className="sr-only"> {g.seats === 1 ? seatLabel : seatsLabel}</span>
        </span>
      </button>
    </li>
  );

  const vacantEntry =
    vacant > 0 ? (
      <li className="flex min-h-target min-w-0 items-baseline gap-2 py-0.5">
        <Swatch vacant />
        <span className="text-muted-foreground min-w-0 flex-1">{labels.vacant}</span>
        <span className="text-foreground shrink-0 font-medium tabular-nums">{number(vacant)}</span>
      </li>
    ) : null;

  const LIST = 'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),14rem))] gap-x-8 p-0 text-ui-sm';

  // The legend by side, in the order of `sides`, each in its given order.
  const bySide =
    sides.length > 0
      ? [
          ...sides.map((side, s) => ({
            key: side.id,
            label: side.label as string | undefined,
            seats: sideTotal(groups, side.id),
            members: placed.filter((g) => g.sideIndex === s).sort((a, b) => a.index - b.index),
          })),
          {
            key: '__none',
            label: undefined,
            seats: 0,
            members: placed.filter((g) => g.sideIndex === -1),
          },
        ].filter((block) => block.members.length > 0)
      : [];

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

      {tallies.length > 0 ? (
        <div
          data-slot="seat-chart-tally"
          className="mx-auto flex w-full max-w-144 flex-wrap items-end justify-between gap-x-4 gap-y-2"
        >
          {tallies.map((t, i) => (
            <React.Fragment key={t.key}>
              {i > 0 ? <span aria-hidden className="bg-border w-px self-stretch" /> : null}
              <div
                className={cn(
                  'flex min-w-0 flex-1 flex-col',
                  i === 0 ? 'items-start text-start' : i === tallies.length - 1 ? 'items-end text-end' : 'items-center text-center',
                )}
              >
                <span className="text-muted-foreground flex items-center gap-1.5 text-caption">
                  <Swatch className={t.fill} />
                  {t.label}
                </span>
                <span className="text-foreground leading-none font-semibold tabular-nums text-[min(2.5rem,12cqi)]">
                  {number(t.seats)}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : null}

      <div data-slot="seat-chart-plot" className="relative mx-auto w-full max-w-144">
        <svg
          ref={plotRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={summary}
          onPointerMove={point}
          onPointerLeave={() => setHovered(null)}
        >
          {layout.seats.map((seat, i) => {
            const index = owner[i]!;
            const group = byIndex.get(index);
            const x = CX + seat.r * SCALE * Math.cos(seat.angle);
            const y = CY - seat.r * SCALE * Math.sin(seat.angle);
            return (
              <circle
                key={i}
                data-slot="seat-chart-seat"
                data-group={index}
                cx={Number(x.toFixed(2))}
                cy={Number(y.toFixed(2))}
                r={Number(seatRadius.toFixed(2))}
                strokeWidth={group ? undefined : 1.25}
                className={cn(
                  'origin-center [transform-box:fill-box] motion-safe:transition-opacity motion-safe:duration-(--duration-fast)',
                  group ? fillOf(group) : 'fill-none stroke-muted-foreground',
                  active !== null && index !== active && 'opacity-20',
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
              y2={Number(innerEdge.toFixed(2))}
              strokeWidth={1.5}
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
          {number(activeGroup ? activeGroup.seats : total)}
        </p>
      </div>

      <p
        data-slot="seat-chart-readout"
        className="text-muted-foreground m-0 text-center text-caption tabular-nums"
      >
        {activeGroup ? (
          <>
            {activeGroup.label}: {seatsWord(activeGroup.seats)}, {pct(activeGroup.seats)}
          </>
        ) : majority !== undefined ? (
          (majorityLabel ?? labels.majorityNeeded(number(majority)))
        ) : (
          seatsWord(total)
        )}
      </p>

      {placed.length > 0 ? (
        <div data-slot="seat-chart-legend" className="flex flex-col gap-3">
          {sides.length > 0 ? (
            bySide.map((block, b) => (
              <div key={block.key} className="flex flex-col gap-1">
                <p className="text-muted-foreground m-0 text-caption">
                  {block.label ? (
                    <>
                      {block.label} <span className="text-foreground font-medium tabular-nums">{number(block.seats)}</span>
                    </>
                  ) : (
                    labels.noSide
                  )}
                </p>
                <ul className={LIST}>
                  {block.members.map(legendEntry)}
                  {b === bySide.length - 1 ? vacantEntry : null}
                </ul>
              </div>
            ))
          ) : (
            <ul className={LIST}>
              {[...placed].sort((a, b) => a.index - b.index).map(legendEntry)}
              {vacantEntry}
            </ul>
          )}
        </div>
      ) : null}

      <div data-slot="seat-chart-table" className={cn(showTable ? 'overflow-x-auto' : 'sr-only')}>
        <table className="w-full text-ui-sm tabular-nums">
          <caption className="text-muted-foreground pb-2 text-start text-caption">
            {labels.tableCaption(typeof label === 'string' ? label : undefined)}
          </caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-1.5 pe-4 text-start font-medium">
                {labels.group}
              </th>
              {sides.length > 0 ? (
                <th scope="col" className="py-1.5 pe-4 text-start font-medium">
                  {labels.side}
                </th>
              ) : null}
              <th scope="col" className="py-1.5 pe-4 text-end font-medium">
                {labels.seats}
              </th>
              <th scope="col" className="py-1.5 text-end font-medium">
                {labels.share}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <tr key={`${group.label}-${index}`} className="border-border border-b">
                <th scope="row" className="py-1.5 pe-4 text-start font-normal">
                  {group.label}
                </th>
                {sides.length > 0 ? (
                  <td className="py-1.5 pe-4">{sides.find((side) => side.id === group.side)?.label ?? '—'}</td>
                ) : null}
                <td className="py-1.5 pe-4 text-end">{number(byIndex.get(index)!.seats)}</td>
                <td className="py-1.5 text-end">{pct(byIndex.get(index)!.seats)}</td>
              </tr>
            ))}
            {vacant > 0 ? (
              <tr className="border-border border-b">
                <th scope="row" className="py-1.5 pe-4 text-start font-normal">
                  {labels.vacant}
                </th>
                {sides.length > 0 ? <td className="py-1.5 pe-4">—</td> : null}
                <td className="py-1.5 pe-4 text-end">{number(vacant)}</td>
                <td className="py-1.5 text-end">{pct(vacant)}</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-1.5 pe-4 text-start font-medium">
                {labels.total}
              </th>
              {sides.length > 0 ? <td /> : null}
              <td className="py-1.5 pe-4 text-end font-medium">{number(total)}</td>
              <td className="py-1.5 text-end">{majority !== undefined ? labels.majorityCell(number(majority)) : ''}</td>
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
export function SeatChartCompare({ columns = 2, className, children, ...props }: SeatChartCompareProps) {
  return (
    <div data-slot="seat-chart-compare" className={cn('@container/compare', className)} {...props}>
      <div data-slot="seat-chart-compare-grid" className={cn('grid grid-cols-1 gap-x-10 gap-y-12', COLUMNS[columns])}>
        {children}
      </div>
    </div>
  );
}
