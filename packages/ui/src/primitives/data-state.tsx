/**
 * @interlace/ui — DataState
 *
 * The single conditional swap point for a data surface, and the place the
 * design system says what an ABSENCE is.
 *
 * It started as the four-state ladder every fetch site otherwise re-writes:
 *
 *   {isLoading ? <Skeleton /> :
 *    error    ? <ErrorState /> :
 *    !data?.length ? <EmptyState /> :
 *    <ListOfThings items={data} />}
 *
 * becomes:
 *
 *   <DataState
 *     loading={isLoading}
 *     error={error}
 *     empty={!data?.length}
 *     skeletonVariant="article-card"
 *     emptyState={<EmptyState>No articles yet</EmptyState>}
 *   >
 *     {() => <ListOfThings items={data!} />}
 *   </DataState>
 *
 * The render-prop child only runs when the surface has real data, so consumers
 * can `data!.map(...)` inside without a null guard.
 *
 * ## Four states was not enough, and the missing five were the interesting ones
 *
 * Six published artifacts were catalogued for phase 10, and every one of them
 * had hand-rolled a vocabulary this component did not have. Not decoration —
 * distinctions that change what the reader is entitled to conclude:
 *
 *   - **`not-counted`** — no run happened. Drawn as a diagonal hatch, because
 *     a run that returned zero and a run that never happened must not look the
 *     same. This is the state `charts/scale.ts` has always encoded as `null`.
 *   - **`not-applicable`** — the metric has no meaning for this subject. It
 *     recedes: it was never going to have a value, so it should not compete
 *     with the cells that do.
 *   - **`partial`** — some sources did not report. Every count below is a
 *     FLOOR, not a total. Ranked above `truncated` because it is invisible:
 *     a reader can see a list stop, but cannot see a source that never replied.
 *   - **`truncated`** — the list is cut. Never a denominator.
 *   - **`first-measurement`** — a reading exists, a prior does not. This is the
 *     one absence that gets the accent colour and a dashed outline, because it
 *     is the only one a reader can act on. It exists so a metric with no prior
 *     shows "first measurement" instead of `+0%`.
 *
 * The union, its precedence, and every announcement live in the pure companion
 * `data-state-model.ts` — no React, exhaustively testable, shipped inside this
 * registry item so a `shadcn add` gets the contract and not just the chrome.
 *
 * ## Precedence, and why the loser is not thrown away
 *
 * `DATA_STATES` is the precedence order. Two rules the audit named: **error
 * beats empty** (a failed fetch is a different message, not "nothing found"),
 * and **truncated is not empty** (truncated does not replace the body at all).
 *
 * States co-occur. A partially-covered list that is also truncated is wrong
 * twice, so `resolveDataState` returns the winner AND the qualifiers, and the
 * announcement says both. A resolver that returned one name would silently
 * drop the second fact — which is the bug this component exists to prevent.
 *
 * ## The hatch must not exist only in pixels
 *
 * A diagonal hatch a screen reader cannot perceive keeps the "no run" /
 * "measured zero" distinction for sighted readers and destroys it for everyone
 * else — a worse outcome than not drawing it. Every state therefore carries a
 * sentence (`announceDataState`), `loading` is `role="status"`, `error` is
 * `role="alert"`, and `DataStateBadge` renders its glyph `aria-hidden` with
 * the sentence beside it.
 *
 * ## MIN_VIEWPORT — 320
 *
 * `DataState` inherits the min-viewport of whichever child it renders and
 * declares none of its own. `DataStateBadge` is an inline chip that wraps with
 * its line; it never introduces horizontal overflow.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends prop bag                 | `Omit<ComponentProps<'div'>, 'children'>` + `DataStateFlags` |
 * | R6   | data-slot on root                | `data-slot="data-state"` + `data-state` + `data-qualifiers`  |
 * | R7   | className merged + ...rest       | `cn(className)` + `{...props}`                              |
 * | R8   | No `isXxx`; explicit booleans    | one boolean per absence — they co-occur, so no enum          |
 * | R10  | Composition seam (children fn)   | `children: (data: T) => ReactNode`                          |
 * | R13  | Ecosystem first                  | No state machine — an ordered array IS the precedence        |
 * | R18  | Tailwind only                    | Zero inline `style`; the hatch is a Tailwind arbitrary bg    |
 * | R19  | Tokens only                      | `--viz-axis` / `--muted-foreground` / `--primary` / `--destructive` |
 * | R20  | AA contrast                      | contrast table in `data-state-model.ts`                      |
 * | R25  | Server component                 | Pure render — no hooks                                       |
 * | R26  | A11y                             | role=status/alert, aria-busy, sentence per state             |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import {
  announceDataState,
  presentationFor,
  resolveDataState,
  type AnnouncementOptions,
  type DataStateFlags,
  type DataStateName,
} from './data-state-model.js';
import { Skeleton, type SkeletonVariant } from './skeleton.js';

export const MIN_VIEWPORT = 320 as const;

// ─────────────────────────────────────────────────────────────────
// DataStateBadge — one state, painted and announced
// ─────────────────────────────────────────────────────────────────

export interface DataStateBadgeProps
  extends Omit<React.ComponentProps<'span'>, 'children'> {
  state: DataStateName;
  /** Context for the spoken sentence — noun, shown count, coverage, reason. */
  announce?: AnnouncementOptions;
  /**
   * Visible label override. The SENTENCE is not overridable — a caller who
   * shortens "not counted" to "n/c" must not also be able to shorten what a
   * screen reader hears down to nothing.
   */
  label?: React.ReactNode;
  /** Hide the visible label and keep only the glyph. For dense cells. */
  glyphOnly?: boolean;
}

/**
 * The inline chip for one state.
 *
 * Three carriers, in descending order of reliability: the **sentence**
 * (`sr-only`, always present), the **word**, and the **texture** — hatch for
 * "no run happened", dashed border for "not yet real". Texture is last on
 * purpose: it is the one that disappears in greyscale and for a screen reader,
 * which is exactly the argument `Delta` makes about colour.
 */
export const DataStateBadge = React.forwardRef<
  HTMLSpanElement,
  DataStateBadgeProps
>(function DataStateBadge(
  { state, announce, label, glyphOnly = false, className, ...props },
  ref,
) {
  const presentation = presentationFor(state);
  const sentence = announceDataState(state, announce);

  return (
    <span
      ref={ref}
      data-slot="data-state-badge"
      data-state={state}
      data-emphasis={presentation.emphasis}
      data-hatch={presentation.hatch || undefined}
      className={cn(
        // `w-fit`: this is an inline chip, but it is routinely dropped into a
        // `flex-col` (a StatStrip cell, a notice row), where the default
        // `align-items: stretch` blows it to the full column width and the
        // border reads as a field rather than a tag. jsdom cannot see that —
        // it reports every box as 0×0.
        'inline-flex w-fit max-w-full items-center gap-1 whitespace-nowrap rounded-sm border bg-background px-1.5 py-0.5 align-middle font-mono text-ui-sm leading-none',
        presentation.chip,
        className,
      )}
      {...props}
    >
      {/* The hatch is a swatch BESIDE the words, never a background under
          them: painted on the chip it ran diagonals straight through
          "not counted". A texture and a glyph competing for the same 12px is
          two marks saying one thing badly, so a state has one or the other. */}
      {presentation.swatch ? (
        <span
          aria-hidden
          data-slot="data-state-swatch"
          className={cn(
            'size-3 shrink-0 rounded-[2px] border',
            presentation.swatch,
          )}
        />
      ) : presentation.glyph ? (
        <span aria-hidden className="leading-none">
          {presentation.glyph}
        </span>
      ) : null}
      {glyphOnly ? null : (
        <span aria-hidden className="truncate">
          {label ?? presentation.short}
        </span>
      )}
      <span className="sr-only">{sentence}</span>
    </span>
  );
});

// ─────────────────────────────────────────────────────────────────
// DataState — the switch
// ─────────────────────────────────────────────────────────────────

interface DataStateProps<T = unknown>
  extends Omit<React.ComponentProps<'div'>, 'children' | 'defaultValue'>,
    DataStateFlags {
  /**
   * The data to render. Only narrows the children's typed parameter — the
   * decision to render children is driven by the flags, not by this value.
   */
  data?: T;
  /** Loading-state UI. Defaults to a single full-width Skeleton rect. */
  skeleton?: React.ReactNode;
  /** Optional shortcut: pick a `<Skeleton variant>` instead of passing a node. */
  skeletonVariant?: SkeletonVariant;
  /** Error-state UI. Defaults to a minimal `role="alert"` line. */
  errorState?: React.ReactNode;
  /** Empty-state UI. Defaults to a minimal muted line. */
  emptyState?: React.ReactNode;
  /**
   * UI for the two "there was never going to be a value here" states.
   * Defaults to a `DataStateBadge`, which is usually the right answer — these
   * states belong in a cell, not in a full-page panel.
   */
  notApplicableState?: React.ReactNode;
  notCountedState?: React.ReactNode;
  /** Context for every announcement this instance emits. */
  announce?: AnnouncementOptions;
  /**
   * Render badges for qualifying states (`partial` / `truncated` /
   * `first-measurement`) above the body. The sr-only announcement is emitted
   * either way — set this to `false` only when the surrounding surface already
   * shows the same badge, never to make the caveat go away.
   */
  notice?: boolean;
  /**
   * Idle render. Receives the (narrowed-non-null) `data` value. Runs whenever
   * the resolved state does not replace the body — which includes the
   * qualifying states, because those annotate real data rather than hide it.
   */
  children: (data: T) => React.ReactNode;
}

function DataState<T>({
  loading,
  error,
  empty,
  partial,
  truncated,
  notApplicable,
  notCounted,
  firstMeasurement,
  data,
  skeleton,
  skeletonVariant,
  errorState,
  emptyState,
  notApplicableState,
  notCountedState,
  announce,
  notice = true,
  children,
  className,
  ...props
}: DataStateProps<T>) {
  const resolved = resolveDataState(
    {
      loading,
      error,
      empty,
      partial,
      truncated,
      notApplicable,
      notCounted,
      firstMeasurement,
    },
    announce,
  );

  const replacement = REPLACEMENTS[resolved.state]?.({
    skeleton,
    skeletonVariant,
    errorState,
    emptyState,
    notApplicableState,
    notCountedState,
    announce,
  });

  return (
    <div
      data-slot="data-state"
      data-state={resolved.state}
      // Serialised so a test, an audit script or a consumer's CSS can see the
      // facts the single `data-state` winner does not carry.
      data-qualifiers={resolved.qualifiers.join(' ') || undefined}
      aria-busy={resolved.state === 'loading' || undefined}
      className={cn(className)}
      {...props}
    >
      {resolved.replaces ? (
        replacement
      ) : (
        <>
          {notice && resolved.active[0] !== 'idle' ? (
            <p
              data-slot="data-state-notice"
              className="mb-2 flex flex-wrap items-center gap-1"
            >
              {resolved.active.map((state) => (
                <DataStateBadge key={state} state={state} announce={announce} />
              ))}
            </p>
          ) : (
            // The caveat is never optional for a screen reader, only its
            // visible chip is. Without this branch `notice={false}` would
            // silently downgrade the announcement to nothing.
            <span className="sr-only">{resolved.announcement}</span>
          )}
          {children(data as T)}
        </>
      )}
    </div>
  );
}
DataState.displayName = 'DataState';

/**
 * What each REPLACING state renders when the caller supplies nothing.
 *
 * A lookup rather than a nested ternary: the previous four-state ladder was
 * already three levels deep and nine states would have made it unreadable, and
 * an object keyed by the union is what makes a missing arm a type error.
 */
type ReplacementSlots = Pick<
  DataStateProps,
  | 'skeleton'
  | 'skeletonVariant'
  | 'errorState'
  | 'emptyState'
  | 'notApplicableState'
  | 'notCountedState'
  | 'announce'
>;

const REPLACEMENTS: Partial<
  Record<DataStateName, (slots: ReplacementSlots) => React.ReactNode>
> = {
  loading: ({ skeleton, skeletonVariant }) =>
    skeleton ?? <Skeleton variant={skeletonVariant ?? 'rect'} />,
  error: ({ errorState, announce }) =>
    errorState ?? (
      <p role="alert" className="font-body text-ui text-destructive">
        {announceDataState('error', announce)}
      </p>
    ),
  empty: ({ emptyState, announce }) =>
    emptyState ?? (
      <p className="font-body text-ui text-muted-foreground">
        {announceDataState('empty', announce)}
      </p>
    ),
  'not-applicable': ({ notApplicableState, announce }) =>
    notApplicableState ?? (
      <DataStateBadge state="not-applicable" announce={announce} />
    ),
  'not-counted': ({ notCountedState, announce }) =>
    notCountedState ?? (
      <DataStateBadge state="not-counted" announce={announce} />
    ),
};

export { DataState };
export type { DataStateProps };
export * from './data-state-model.js';
