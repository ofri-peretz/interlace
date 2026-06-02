/**
 * @interlace/ui — DataState
 *
 * The single conditional swap point for the four-state UX (loading,
 * error, empty, idle). Replaces the ad-hoc ladder consumers otherwise
 * write at every fetch site:
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
 *     skeleton={<Skeleton variant="article-card" count={3} />}
 *     emptyState={<EmptyState>No articles yet</EmptyState>}
 *     errorState={<ErrorState onRetry={refetch} />}
 *   >
 *     {() => <ListOfThings items={data!} />}
 *   </DataState>
 *
 * The render-prop child only runs when ALL gates pass (data is real),
 * so consumers can `data!.map(...)` inside without a null guard.
 *
 * ## State precedence
 *
 *   loading   → render `skeleton`     (default: <Skeleton variant="rect" />)
 *   error     → render `errorState`   (default: <ErrorState tone="danger" />)
 *   empty     → render `emptyState`   (default: <EmptyState />)
 *   otherwise → call `children()` and render its result
 *
 * Error takes precedence over empty: a failed fetch shouldn't read as
 * "no data" — it's a different message entirely.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Inherits the min-viewport of whichever child it renders.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends prop bag                 | Pure prop interface — no native el                          |
 * | R6   | data-slot on root                | `data-slot="data-state"` + `data-state` (loading/error/empty/idle) |
 * | R7   | className merged + ...rest       | `cn(className)` + `{...props}` on a wrapping div            |
 * | R8   | No `isXxx`; explicit booleans    | `loading`, `error`, `empty` are nullable / boolean          |
 * | R10  | Composition seam (children fn)   | `children: (data: T) => ReactNode`                          |
 * | R13  | Ecosystem first                  | No state machine — plain branching, predictable             |
 * | R18  | Tailwind only                    | Zero inline `style`; layout via cn()                        |
 * | R25  | Server component                 | Pure render — no hooks                                      |
 * | R26  | A11y from delegates              | aria-busy on the wrapper while loading=true                 |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Skeleton, type SkeletonVariant } from './skeleton.js';

interface DataStateProps<T = unknown> extends Omit<React.ComponentProps<'div'>, 'children'> {
  /** Loading flag — when truthy, renders `skeleton`. */
  loading?: boolean;
  /**
   * Error value — when truthy (any non-nullish), renders `errorState`. The
   * value itself isn't passed in; render the message in `errorState`.
   */
  error?: unknown;
  /** Empty flag — when truthy (and not loading/error), renders `emptyState`. */
  empty?: boolean;
  /**
   * The data to render. Only narrows the children's typed parameter — the
   * decision to render children is driven by the (loading / error / empty)
   * gates, not by the data value.
   */
  data?: T;
  /** Loading-state UI. Defaults to a single full-width Skeleton rect. */
  skeleton?: React.ReactNode;
  /** Optional shortcut: pick a `<Skeleton variant>` instead of passing a node. */
  skeletonVariant?: SkeletonVariant;
  /** Error-state UI. Defaults to a minimal `<p>Something went wrong</p>`. */
  errorState?: React.ReactNode;
  /** Empty-state UI. Defaults to a minimal `<p>No results</p>`. */
  emptyState?: React.ReactNode;
  /**
   * Idle render. Receives the (narrowed-non-null) `data` value. Only runs
   * when no gate fires — consumers can safely access `data` without a
   * null-check at the call site.
   */
  children: (data: T) => React.ReactNode;
}

function DataState<T>({
  loading,
  error,
  empty,
  data,
  skeleton,
  skeletonVariant,
  errorState,
  emptyState,
  children,
  className,
  ...props
}: DataStateProps<T>) {
  const state: 'loading' | 'error' | 'empty' | 'idle' = loading
    ? 'loading'
    : error
      ? 'error'
      : empty
        ? 'empty'
        : 'idle';

  const body: React.ReactNode =
    state === 'loading'
      ? (skeleton ?? <Skeleton variant={skeletonVariant ?? 'rect'} />)
      : state === 'error'
        ? (errorState ?? (
            <p
              role="alert"
              className="text-destructive text-ui font-body"
            >
              Something went wrong.
            </p>
          ))
        : state === 'empty'
          ? (emptyState ?? (
              <p className="text-muted-foreground text-ui font-body">
                No results.
              </p>
            ))
          : children(data as T);

  return (
    <div
      data-slot="data-state"
      data-state={state}
      aria-busy={state === 'loading' || undefined}
      className={cn(className)}
      {...props}
    >
      {body}
    </div>
  );
}
DataState.displayName = 'DataState';

export { DataState };
export type { DataStateProps };
