/**
 * @interlace/ui — the DataState vocabulary (pure)
 *
 * Nothing in this file imports React, touches the DOM, or renders anything.
 * It is the part of the absence contract that can be *proved* — the union, the
 * precedence order, the announcement each state owes a screen reader, and the
 * class set that paints it — so `data-state.tsx`, `stat-strip.tsx` and
 * `meter.tsx` all resolve absence through the same three functions rather than
 * each re-deriving it from a boolean ladder.
 *
 * ## Why absence is a vocabulary and not a placeholder
 *
 * `charts/scale.ts` already encodes one half of this: `null` is *unmeasured*,
 * never zero, and `numeric()` drops it rather than coercing it, because
 * averaging over an invented zero silently manufactures data. That is a
 * statement about arithmetic. This file is the same statement about pixels.
 *
 * Six published artifacts were catalogued for phase 10 and every one of them
 * had hand-rolled some version of this, because the distinctions are real and
 * no component library ships them:
 *
 *   - a diagonal **hatch** means *no run happened* — which is a different fact
 *     from a run that returned zero, and a very different fact from a run that
 *     is still going;
 *   - a **dashed** outline means *planned / not yet approached*; solid means
 *     *real*;
 *   - `not counted`, `authority`, `visibility`, `dormant` are legitimate
 *     non-numeric values a cell can hold, and rendering any of them as `0`
 *     is a lie the reader cannot detect;
 *   - two absences that recede vs. accent on purpose: an *unwritten* thing is
 *     quiet, an *ungated* thing is actionable.
 *
 * The rules that fall out, verbatim from the corpus: **never render a missing
 * prior as 0**; **a truncated list must never be a denominator**; when coverage
 * is partial, **treat every count as a floor**.
 *
 * ## Two kinds of state, which is what makes the precedence tractable
 *
 * REPLACING states answer "there is nothing here to show" — the body is
 * swapped for the state itself. QUALIFYING states answer "there IS something
 * here, and here is what is wrong with it" — the body renders, annotated.
 *
 * A resolver that returns one winner throws away the second fact. So
 * `resolveDataState` returns the winner **and** every other active state as
 * `qualifiers`, and the announcement concatenates them. A partial-coverage
 * result that is also truncated says so twice, because it is wrong twice.
 *
 * ## Precedence
 *
 * `DATA_STATES` **is** the precedence order — lowest index wins. Reading down
 * the array is reading the rule, so the two cannot drift apart.
 *
 *   1. `loading`            nothing is known yet; every other flag is stale.
 *   2. `error`              a failed fetch must never read as "no data".
 *   3. `not-applicable`     the metric has no meaning here. Any number, `0`
 *                           included, would be a category error.
 *   4. `not-counted`        measurable in principle, deliberately not tallied.
 *                           `0` here invents a measurement nobody took.
 *   5. `empty`              a complete result with nothing in it. The only
 *                           absence that is a real, observed zero-length.
 *   6. `partial`            coverage is incomplete. Ranked above `truncated`
 *                           because it is INVISIBLE: the reader can see a list
 *                           stop, but cannot see a source that never reported.
 *   7. `truncated`          the list is cut. Not a denominator.
 *   8. `first-measurement`  a value exists, no prior does. Never `+0%`.
 *   9. `idle`              data is real and complete. The resting state.
 */

/**
 * Every state, in precedence order. Lowest index wins.
 *
 * `idle` is last and is not an absence — it is the absence of absence, kept in
 * the union so a caller can exhaustively switch and so the resolver always has
 * something to return.
 */
export const DATA_STATES = [
  'loading',
  'error',
  'not-applicable',
  'not-counted',
  'empty',
  'partial',
  'truncated',
  'first-measurement',
  'idle',
] as const;

export type DataStateName = (typeof DATA_STATES)[number];

/**
 * States that REPLACE the body — there is no value to render underneath them.
 *
 * The complement (`partial`, `truncated`, `first-measurement`) qualifies a body
 * that does render. `idle` is neither, and is excluded from both.
 */
export const REPLACING_STATES = new Set<DataStateName>([
  'loading',
  'error',
  'not-applicable',
  'not-counted',
  'empty',
]);

/** States that annotate a body which still renders. */
export const QUALIFYING_STATES = new Set<DataStateName>([
  'partial',
  'truncated',
  'first-measurement',
]);

/** True when this state swaps out the content rather than annotating it. */
export const replacesBody = (state: DataStateName): boolean =>
  REPLACING_STATES.has(state);

/**
 * The caller's flags, one per absence.
 *
 * `error` is `unknown` rather than `boolean` so a caught value can be passed
 * through untouched — the value is never rendered from here, only its
 * truthiness is read.
 *
 * Deliberately NOT a single `state` enum prop: the whole point is that these
 * co-occur. A partially-covered, truncated list is two facts, and an enum
 * would force the caller to pick one and drop the other on the floor.
 */
export interface DataStateFlags {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  /** Some sources did not report. Every count below is a FLOOR, not a total. */
  partial?: boolean;
  /** The list is cut short. It must never become a denominator. */
  truncated?: boolean;
  /** The metric has no meaning for this subject. Not zero — inapplicable. */
  notApplicable?: boolean;
  /** No run happened. Not zero — unmeasured. This is the hatch. */
  notCounted?: boolean;
  /** A reading exists but no prior does. Never render this as `+0%`. */
  firstMeasurement?: boolean;
}

/** Flag key → state name, in the same order as `DATA_STATES`. */
const FLAG_ORDER: readonly (readonly [keyof DataStateFlags, DataStateName])[] = [
  ['loading', 'loading'],
  ['error', 'error'],
  ['notApplicable', 'not-applicable'],
  ['notCounted', 'not-counted'],
  ['empty', 'empty'],
  ['partial', 'partial'],
  ['truncated', 'truncated'],
  ['firstMeasurement', 'first-measurement'],
];

/**
 * Context for the spoken sentence.
 *
 * Every field is optional, and every announcement is a complete sentence
 * without any of them — a component that forgets to pass `noun` still
 * announces something true, just less specific.
 */
export interface AnnouncementOptions {
  /** What is missing — "articles", "downloads", "runs". */
  noun?: string;
  /** How many rows the truncated list actually shows. */
  shown?: number;
  /** How coverage is incomplete — "4 of 9 sources reported". */
  coverage?: string;
  /** Why this is not applicable — "repository has no test suite". */
  reason?: string;
}

/**
 * The sentence a screen reader hears for one state.
 *
 * A hatch pattern that exists only in pixels is invisible to a screen reader,
 * which defeats the entire point of distinguishing "no run" from "zero" —
 * the distinction would survive for sighted users and vanish for everyone
 * else. Every state therefore owes a sentence, and the sentence says what the
 * absence MEANS rather than naming the state.
 */
export function announceDataState(
  state: DataStateName,
  options: AnnouncementOptions = {},
): string {
  const { noun, shown, coverage, reason } = options;
  const subject = noun ?? 'data';

  switch (state) {
    case 'loading':
      return `Loading ${subject}.`;
    case 'error':
      return `${capitalise(subject)} could not be loaded.`;
    case 'not-applicable':
      return reason
        ? `Not applicable: ${reason}.`
        : `Not applicable. No value is possible here.`;
    // "This is not a zero" is doing real work: without it a listener has no
    // way to tell an unmeasured cell from a measured zero, which is the exact
    // confusion the hatch exists to prevent for sighted readers.
    case 'not-counted':
      return `Not counted. No measurement was taken; this is not a zero.`;
    case 'empty':
      return `No ${subject}.`;
    case 'partial':
      return coverage
        ? `Partial coverage: ${coverage}. Every count is a floor, not a total.`
        : `Partial coverage. Every count is a floor, not a total.`;
    case 'truncated':
      return shown === undefined
        ? `Truncated list. The total is unknown; do not use this as a denominator.`
        : `Truncated list: showing ${shown.toLocaleString()} of an unknown total. ` +
            `Do not use this as a denominator.`;
    case 'first-measurement':
      return `First measurement. There is no prior reading to compare against.`;
    /* istanbul ignore next -- exhaustive; `idle` is the only remaining member */
    default:
      return '';
  }
}

const capitalise = (value: string): string =>
  value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);

/** What `resolveDataState` returns. */
export interface ResolvedDataState {
  /** The winner by precedence — what a single-slot surface should render. */
  state: DataStateName;
  /** Every active state, in precedence order. `['idle']` when none fired. */
  active: DataStateName[];
  /** `active` minus the winner. The facts a one-winner resolver would lose. */
  qualifiers: DataStateName[];
  /** True when the winner swaps out the body rather than annotating it. */
  replaces: boolean;
  /** Winner sentence followed by every qualifier sentence. */
  announcement: string;
}

/**
 * Resolve a flag bag into a state, its qualifiers, and one spoken sentence.
 *
 * The two rules the phase-10 audit called out by name both fall out of the
 * array order and are pinned by tests: **error beats empty** (a failed fetch
 * is a different message, not "nothing found"), and **truncated is not empty**
 * (they are separate members, and truncated does not replace the body at all).
 */
export function resolveDataState(
  flags: DataStateFlags = {},
  options: AnnouncementOptions = {},
): ResolvedDataState {
  const active = FLAG_ORDER.filter(([key]) => Boolean(flags[key])).map(
    ([, state]) => state,
  );

  if (active.length === 0) {
    return {
      state: 'idle',
      active: ['idle'],
      qualifiers: [],
      replaces: false,
      announcement: '',
    };
  }

  const [state, ...qualifiers] = active;
  return {
    state,
    active,
    qualifiers,
    replaces: replacesBody(state),
    announcement: [state, ...qualifiers]
      .map((name) => announceDataState(name, options))
      .join(' '),
  };
}

// ── Presentation ────────────────────────────────────────────────────────────

/**
 * How loud a state is allowed to be.
 *
 *   - `recede` — the *unwritten* family: a thing that was never going to have
 *     a value. It should not compete with the data around it.
 *   - `muted`  — the *unmeasured* family: a real gap, worth noticing, not
 *     worth alarming about.
 *   - `accent` — the *ungated* family: actionable. Something a reader can go
 *     and change. This is the one that earns colour.
 *   - `danger` — the request failed.
 */
export type DataStateEmphasis = 'recede' | 'muted' | 'accent' | 'danger';

/**
 * The diagonal hatch. **No run happened.**
 *
 * Written as a Tailwind arbitrary background-image rather than a CSS class in
 * `styles/` so the whole vocabulary ships inside the registry item — a
 * consumer who runs `npx shadcn add @interlace/data-state` gets the hatch,
 * not a reference to a stylesheet they do not have. `image:` is the explicit
 * type hint; without it Tailwind has to guess the property from a `repeating-
 * linear-gradient(...)` value.
 *
 * `--viz-axis` and not `--viz-grid`: the grid token is documented as
 * decorative (1.37:1) and must never be the sole carrier of a value. The hatch
 * IS the value here, so it uses the axis token, measured at 3.49:1 light /
 * 3.83:1 dark — clearing WCAG 2.2 SC 1.4.11 for non-text content.
 */
export const HATCH_CLASS =
  'bg-[image:repeating-linear-gradient(45deg,var(--viz-axis)_0,var(--viz-axis)_1px,transparent_1px,transparent_5px)]';

/** The same hatch, quieter, for states that recede rather than report. */
export const HATCH_CLASS_FAINT =
  'bg-[image:repeating-linear-gradient(45deg,var(--viz-grid)_0,var(--viz-grid)_1px,transparent_1px,transparent_5px)]';

/**
 * Everything a surface needs to paint one state.
 *
 * `glyph` and `short` are BOTH here because the two carriers serve different
 * widths: a meter cell has room for a glyph, a stat strip has room for a word.
 * Neither is ever the only carrier — `announceDataState` is.
 */
export interface DataStatePresentation {
  /** One-character mark. Always `aria-hidden`; the sentence carries meaning. */
  glyph: string;
  /** Terse visible label, lower case, for a chip. */
  short: string;
  /** Diagonal hatch — no run happened. */
  hatch: boolean;
  /** Dashed outline — planned, or not yet approached. Solid means real. */
  dashed: boolean;
  emphasis: DataStateEmphasis;
  /**
   * Tailwind classes for the chip SURFACE. Never the hatch.
   *
   * The first browser pass painted `HATCH_CLASS` on the chip itself and the
   * diagonals ran straight through "not counted", which is a legibility bug
   * axe cannot see and jsdom cannot render — it reports every box as 0×0 and
   * resolves no Tailwind at all. The hatch moved to `swatch`, a leading block
   * that carries the texture beside the words instead of behind them.
   */
  chip: string;
  /**
   * Classes for the leading hatch swatch, or `''` when this state has none.
   * Replaces `glyph` when present — a texture and a character competing for
   * the same 12px is two marks saying one thing badly.
   */
  swatch: string;
}

/**
 * The state → pixels table.
 *
 * Read the `hatch` / `dashed` / `emphasis` columns down and the doctrine is
 * visible: `not-counted` is the only hatch that reports (a run that did not
 * happen), `not-applicable` hatches faintly and recedes (it was never going
 * to happen), and `first-measurement` is the only absence that gets the accent
 * — because it is the only one the reader can act on, by measuring again
 * tomorrow.
 *
 * Contrast, measured against `--background` (see COLOR_PHILOSOPHY.md):
 *
 * | emphasis | token                | Light   | Dark    | Floor |
 * | -------- | -------------------- | ------- | ------- | ----- |
 * | recede   | `--muted-foreground` |  5.66:1 |  6.29:1 | 4.5:1 |
 * | muted    | `--muted-foreground` |  5.66:1 |  6.29:1 | 4.5:1 |
 * | accent   | `--primary`          |  8.80:1 |  9.12:1 | 4.5:1 |
 * | danger   | `--destructive`      |  8.31:1 | 10.43:1 | 4.5:1 |
 * | (hatch)  | `--viz-axis` on bg   |  3.49:1 |  3.83:1 | 3:1 (SC 1.4.11, non-text) |
 */
export const DATA_STATE_PRESENTATION: Record<
  DataStateName,
  DataStatePresentation
> = {
  loading: {
    glyph: '',
    short: 'loading',
    hatch: false,
    dashed: false,
    emphasis: 'muted',
    chip: 'border-border text-muted-foreground',
    swatch: '',
  },
  error: {
    glyph: '!',
    short: 'error',
    hatch: false,
    dashed: false,
    emphasis: 'danger',
    chip: 'border-destructive/40 text-destructive',
    swatch: '',
  },
  'not-applicable': {
    glyph: '',
    short: 'n/a',
    hatch: true,
    dashed: false,
    emphasis: 'recede',
    chip: 'border-border/60 text-muted-foreground',
    swatch: `border-border/60 ${HATCH_CLASS_FAINT}`,
  },
  'not-counted': {
    glyph: '',
    short: 'not counted',
    hatch: true,
    dashed: false,
    emphasis: 'muted',
    chip: 'border-border text-muted-foreground',
    swatch: `border-border ${HATCH_CLASS}`,
  },
  empty: {
    glyph: '—',
    short: 'none',
    hatch: false,
    dashed: false,
    emphasis: 'muted',
    chip: 'border-border text-muted-foreground',
    swatch: '',
  },
  partial: {
    glyph: '≥',
    short: 'partial',
    hatch: false,
    dashed: true,
    emphasis: 'muted',
    chip: 'border-dashed border-border text-muted-foreground',
    swatch: '',
  },
  truncated: {
    glyph: '⋯',
    short: 'truncated',
    hatch: false,
    dashed: true,
    emphasis: 'muted',
    chip: 'border-dashed border-border text-muted-foreground',
    swatch: '',
  },
  'first-measurement': {
    glyph: '·',
    short: 'first measurement',
    hatch: false,
    dashed: true,
    emphasis: 'accent',
    chip: 'border-dashed border-primary/50 text-primary',
    swatch: '',
  },
  idle: {
    glyph: '',
    short: '',
    hatch: false,
    dashed: false,
    emphasis: 'muted',
    chip: '',
    swatch: '',
  },
};

/** Presentation lookup. A function so callers do not index a frozen map by hand. */
export const presentationFor = (
  state: DataStateName,
): DataStatePresentation => DATA_STATE_PRESENTATION[state];
