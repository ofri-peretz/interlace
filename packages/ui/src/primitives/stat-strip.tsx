/**
 * @interlace/ui — StatStrip
 *
 * The measurement strip: a dense row of labelled numbers, each with an
 * optional note and an optional change. It appeared in **all six** of the
 * artifacts catalogued for phase 10, hand-rolled four separate times, and it
 * is the smallest surface where the absence vocabulary earns its keep.
 *
 * ## Why it is not `StatGroup` with tighter padding
 *
 * `StatGroup` renders `StatCard`s: a card per metric, `p-5`, a heading-sized
 * value, a border all the way round. That is a dashboard hero — three to five
 * numbers, each of which is the point of the page.
 *
 * A strip is the opposite brief. Eight to twelve numbers, read as a set,
 * scanned rather than studied, and the comparison BETWEEN them is what the
 * reader came for. So: a mono micro-label (the eye finds a label by shape, not
 * by reading it), `tabular-nums` so the digit columns align down the strip,
 * and a rail instead of a border because eight boxes at this density is a
 * grid of frames with numbers trapped inside them.
 *
 * ## The three-state null, which is the entire reason this exists
 *
 * A metric can be in three genuinely different situations, and four hand-rolled
 * copies got at least one of them wrong:
 *
 *   | `value` | `prior`     | renders                                  |
 *   | ------- | ----------- | ---------------------------------------- |
 *   | number  | number      | the value, and the caller's `delta`      |
 *   | number  | `null`      | the value, and **"first measurement"**   |
 *   | number  | *omitted*   | the value, and nothing — no claim made   |
 *   | `null`  | anything    | a state badge — never `0`, never `—`     |
 *
 * `prior: null` is the load-bearing row. A metric with no prior reading has no
 * percentage change; it does not have a change of zero. Rendering `+0%` there
 * invents a measurement that was never taken and, worse, invents a *comparison*
 * — it tells the reader the number held steady when nobody was watching. The
 * strip refuses: `prior === null` suppresses the caller's `delta` node
 * entirely and shows the `first-measurement` badge, which is the one absence
 * that gets the accent colour because it is the one a reader can resolve, by
 * measuring again tomorrow.
 *
 * `value: null` is the other half, and it is the doctrine `charts/scale.ts`
 * already encodes: a day nobody measured is not a day the metric was zero.
 * Pass `state.notCounted` and the cell hatches.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Two columns at 320, three from `sm`, the caller's count from `lg`. Every
 * cell is `min-w-0` and every value wraps, so a long label cannot push the
 * page sideways — the failure mode a `grid-cols-4` strip has on a phone.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>`                            |
 * | R6   | data-slot on every part          | `data-slot="stat-strip" / "-item"` + `data-state`             |
 * | R7   | className merged + ...rest       | `cn(...)` + `{...props}`                                      |
 * | R8   | No `isXxx`; enum for cols        | `cols` is `2 | 3 | 4 | 5 | 6`                                  |
 * | R10  | Composition seams                | `delta` and `note` are ReactNode slots                        |
 * | R11  | One variable per part            | the strip owns the track count; an item owns its own state    |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const   |
 * | R18  | Tailwind only                    | zero inline `style`                                           |
 * | R19  | Tokens only                      | `border-border`, `text-muted-foreground`, `bg-primary`        |
 * | R20  | AA contrast                      | label `--muted-foreground` 5.66:1 light / 6.29:1 dark; rail is non-text |
 * | R25  | Server component                 | pure render — no hooks                                        |
 * | R26  | A11y                             | real `<dl>` pairs; every absence carries a sentence           |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import {
  DataStateBadge,
  type AnnouncementOptions,
  type DataStateFlags,
} from './data-state.js';
import { announceDataState, resolveDataState } from './data-state-model.js';
import { Skeleton } from './skeleton.js';

export const MIN_VIEWPORT = 320 as const;

/** One measurement. */
export interface StatItem {
  /** React key and `data-key`. */
  key: string;
  /** The micro-label. Short — it is set in mono caps and it is scanned. */
  label: React.ReactNode;
  /**
   * The measurement. `null` means UNMEASURED, and the strip will not render it
   * as `0` or as a bare dash — pass the matching flag in `state` so the cell
   * says which kind of absence it is.
   */
  value?: number | string | null;
  /** Suffix printed after the value — "%", "ms", "/ day". */
  unit?: string;
  /** A second line under the value. Provenance, window, caveat. */
  note?: React.ReactNode;
  /**
   * The previous reading.
   *
   *   - omitted  → no comparison is claimed and none is drawn.
   *   - `null`   → there IS no prior. Renders "first measurement" and
   *                SUPPRESSES `delta`, so a missing prior can never surface
   *                as `+0%`.
   *   - a number → `delta` renders as supplied.
   */
  prior?: number | null;
  /**
   * The change, as a node — usually `<Delta points={…} />` from
   * `charts/delta`. A slot rather than a computed value so the strip never has
   * to own polarity, units, or the "is up good here" question.
   */
  delta?: React.ReactNode;
  /** Absence flags for this one metric. */
  state?: DataStateFlags;
  /** Context for this metric's spoken sentences. */
  announce?: AnnouncementOptions;
}

/**
 * Emphasis → the rail that runs down the left of a cell.
 *
 * A `border-inline-start` and not a rail `<span>`. The first pass drew the
 * rail as its own element, which forced the `<dt>`/`<dd>` pair one level
 * deeper — and the HTML spec allows exactly ONE wrapping `<div>` between a
 * `<dl>` and its items. Axe caught it (`definition-list` + `dlitem`, both
 * serious) where jsdom could not: jsdom renders the markup happily and has no
 * opinion about content models.
 */
const RAIL_CLASS = {
  idle: 'border-border',
  recede: 'border-muted-foreground/25',
  muted: 'border-muted-foreground/50',
  accent: 'border-primary',
  danger: 'border-destructive',
} as const;

/**
 * Mobile-first track counts. Written out statically because Tailwind scans
 * source as raw text and cannot see a runtime-built `lg:grid-cols-${n}`.
 *
 * Two columns at the 320 floor in every case: the desktop count is a ceiling,
 * not a promise. A six-track strip held at six on a phone gives each metric
 * ~45px, which clips the value it exists to show.
 */
const STRIP_COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
} as const;

export type StatStripCols = keyof typeof STRIP_COLS;

export interface StatStripProps extends Omit<
  React.ComponentProps<'section'>,
  'children'
> {
  items: readonly StatItem[];
  /**
   * Visible caption above the strip. Also the strip's accessible name — a
   * `<dl>` of eight numbers with no name is eight numbers from nowhere.
   */
  caption?: React.ReactNode;
  /** Desktop track count. Collapses to 2 at the 320 floor regardless. */
  cols?: StatStripCols;
  /**
   * Strip-wide absence. `partial` here is the `partialCoverage: true` case
   * from the corpus: it qualifies EVERY number below as a floor, so it is
   * announced once at the top rather than repeated on each cell.
   */
  state?: DataStateFlags;
  announce?: AnnouncementOptions;
  loading?: boolean;
}

export const StatStrip = React.forwardRef<HTMLElement, StatStripProps>(
  function StatStrip(
    {
      items,
      caption,
      cols = 4,
      state,
      announce,
      loading = false,
      className,
      ...props
    },
    ref,
  ) {
    const strip = resolveDataState({ ...state, loading }, announce);

    if (strip.state === 'loading') {
      return (
        <Skeleton
          variant="stat-strip"
          data-slot="stat-strip"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={className}
        />
      );
    }

    return (
      <section
        ref={ref}
        data-slot="stat-strip"
        data-state={strip.state}
        data-qualifiers={strip.qualifiers.join(' ') || undefined}
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('w-full', className)}
        {...props}
      >
        {caption || strip.state !== 'idle' ? (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {caption ? (
              <p
                data-slot="stat-strip-caption"
                className="font-mono text-ui-sm uppercase tracking-wide text-muted-foreground"
              >
                {caption}
              </p>
            ) : null}
            {/* Every active state, not just the winner. A strip that is both
                partially covered and truncated is wrong twice and says so. */}
            {strip.active
              .filter((name) => name !== 'idle')
              .map((name) => (
                <DataStateBadge key={name} state={name} announce={announce} />
              ))}
          </div>
        ) : null}

        <dl className={cn('grid gap-x-4 gap-y-5', STRIP_COLS[cols])}>
          {items.map((item) => (
            <StatStripItem key={item.key} item={item} />
          ))}
        </dl>
      </section>
    );
  },
);

/**
 * One cell.
 *
 * Split out because the three-state null is a branch that deserves to be read
 * on its own, not buried in a `.map()` inside the strip's layout.
 */
function StatStripItem({ item }: { item: StatItem }) {
  const { label, value, unit, note, prior, delta, state, announce } = item;

  const resolved = resolveDataState(state, announce);
  const emphasis =
    resolved.state === 'idle'
      ? 'idle'
      : resolved.state === 'error'
        ? 'danger'
        : resolved.state === 'not-applicable'
          ? 'recede'
          : resolved.state === 'first-measurement'
            ? 'accent'
            : 'muted';

  // The measurement is missing. Show WHICH absence, never a 0 and never a
  // bare dash — "—" is the one glyph that reads as both "nothing" and
  // "unknown", which is precisely the ambiguity this component removes.
  const unmeasured = value === null || value === undefined;

  // A prior of exactly `null` is the "no prior reading" signal. `undefined`
  // means the caller is not making a claim about change at all, which is a
  // different thing and draws nothing.
  const noPrior = prior === null;

  return (
    <div
      data-slot="stat-strip-item"
      data-key={item.key}
      data-state={resolved.state}
      // The ONLY element allowed between `<dl>` and its `<dt>`/`<dd>` pair.
      // The rail is this element's inline-start border for exactly that
      // reason — see RAIL_CLASS.
      className={cn(
        'flex min-w-0 flex-col gap-1 border-s-2 ps-2',
        RAIL_CLASS[emphasis],
      )}
    >
      <dt className="font-mono text-ui-sm uppercase leading-tight tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-col gap-1">
        {unmeasured ? (
          <DataStateBadge
            state={resolved.state === 'idle' ? 'empty' : resolved.state}
            announce={announce}
          />
        ) : (
          <>
            {/* `dir="auto"`: inside an RTL page the bidi algorithm reorders
                  "812 ms" to "ms 812", because the digits are a neutral run in
                  an RTL paragraph. `auto` resolves from the first strong
                  character, so the measurement keeps its own reading order. */}
            <span
              dir="auto"
              className="font-body text-h4 font-semibold leading-none tabular-nums break-words"
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
              {unit ? (
                <span className="ml-0.5 text-ui font-normal text-muted-foreground">
                  {unit}
                </span>
              ) : null}
            </span>
            {/* A measured value can still be qualified — a count that is a
                  floor is not the same number as a count that is a total. */}
            {resolved.state !== 'idle' ? (
              <DataStateBadge state={resolved.state} announce={announce} />
            ) : null}
          </>
        )}

        {/* The whole point. A missing prior is announced as a missing
              prior — the caller's delta node is not rendered at all, so
              there is no path by which it can print +0%. */}
        {noPrior ? (
          <DataStateBadge state="first-measurement" announce={announce} />
        ) : (
          (delta ?? null)
        )}

        {note ? (
          <span className="font-body text-ui-sm leading-snug text-muted-foreground">
            {note}
          </span>
        ) : null}

        {/* Qualifiers that did not win the cell still have to be heard.
              A hatch a screen reader cannot perceive keeps the distinction
              for sighted readers and destroys it for everyone else. */}
        {resolved.qualifiers.length > 0 ? (
          <span className="sr-only">
            {resolved.qualifiers
              .map((name) => announceDataState(name, announce))
              .join(' ')}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
