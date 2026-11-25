'use client';

/**
 * @interlace/ui — PullToRefresh
 *
 * Pull a list down from its top to load what is new, the gesture a phone
 * reader already knows. The pull is one finger and one path, so it always
 * has a twin: a Refresh button that is visible wherever the pointer is a
 * mouse, and reachable by keyboard and screen reader everywhere else
 * (WCAG 2.5.1). What happens is said in words in a live region.
 *
 * ## Anatomy
 *
 *   <div data-slot="pull-to-refresh" data-state="idle|pulling|armed|refreshing|settling">
 *     <button data-slot="pull-to-refresh-button">Refresh</button>
 *     <div data-slot="pull-to-refresh-indicator" aria-hidden>{arrow | spinner}</div>
 *     <div data-slot="pull-to-refresh-content">{children}</div>
 *     <span role="status">{Refreshing… | Updated}</span>
 *   </div>
 *
 * ## The gesture
 *
 * It starts only when the page (and this region, if it scrolls) is at its
 * top, the finger moves down more than across, and past a few pixels of
 * slack. The distance is damped, so it feels like pulling against a spring,
 * and stops growing past `threshold`. Releasing past `threshold` refreshes;
 * releasing before it springs back. While pulling, the browser's own
 * pull-to-refresh and bounce are held back, so only one thing happens.
 *
 * ## Motion
 *
 * The content and the indicator follow the finger (a transform, set on a
 * CSS variable, no re-render per move); the arrow turns as the pull nears
 * the threshold and flips when releasing will refresh. On release they
 * settle back with `--ease-move` (250ms). Under reduced motion nothing
 * moves: the indicator fades in place and the content stays still.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                 | Where in this file                                 |
 * | ---- | ----------------------- | -------------------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'div'>`                      |
 * | R6   | data-slot per part      | pull-to-refresh, -button, -indicator, -content     |
 * | R7   | className merged + rest | `cn(BASE, className)` + `{...props}`               |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const               |
 * | R25  | Client component        | touch listeners, the refresh promise               |
 * | R26  | A11y                    | a real button twin, a live region, reduced motion  |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Spinner } from '../primitives/spinner.js';

export const MIN_VIEWPORT = 320 as const;

export type PullToRefreshState = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'settling';

export interface PullToRefreshLabels {
  /** The button twin of the gesture. @default 'Refresh' */
  button: string;
  /** Said while refreshing. @default 'Refreshing' */
  refreshing: string;
  /** Said when the refresh has finished. @default 'Updated' */
  done: string;
  /** Said when the refresh failed. @default 'Could not refresh' */
  failed: string;
}

const LABELS: PullToRefreshLabels = {
  button: 'Refresh',
  refreshing: 'Refreshing',
  done: 'Updated',
  failed: 'Could not refresh',
};

export interface PullToRefreshProps extends React.ComponentProps<'div'> {
  /** Load what is new. The indicator spins until the promise settles. */
  onRefresh: () => Promise<unknown> | void;
  /** Pull distance, in CSS pixels after damping, that arms the refresh. @default 64 */
  threshold?: number;
  /** Turn the gesture and the button off, e.g. while offline. @default false */
  disabled?: boolean;
  /**
   * The Refresh button: `auto` shows it wherever the pointer is fine (a mouse) and
   * keeps it for keyboard and screen readers elsewhere, visible on focus; `hidden`
   * when the page already has a refresh control of its own. @default 'auto'
   */
  button?: 'auto' | 'hidden';
  /** Words, in the page's language. */
  labels?: Partial<PullToRefreshLabels>;
}

/** Slack before a touch counts as a pull. */
const SLOP = 6;
/** How long the spring back takes: --duration-medium. */
const SETTLE_MS = 250;

/** The finger's travel, damped: half speed up to the threshold, a fifth past it. */
export function dampPull(distance: number, threshold: number): number {
  if (distance <= 0) return 0;
  const half = distance / 2;
  if (half <= threshold) return half;
  return Math.min(threshold * 1.5, threshold + (half - threshold) / 5);
}

function scrolledToTop(el: HTMLElement): boolean {
  return window.scrollY <= 0 && el.scrollTop <= 0;
}

function PullToRefresh({
  onRefresh,
  threshold = 64,
  disabled = false,
  button = 'auto',
  labels: labelsProp,
  className,
  children,
  ...props
}: PullToRefreshProps) {
  const labels = { ...LABELS, ...labelsProp };
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<PullToRefreshState>('idle');
  const [message, setMessage] = React.useState('');
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const refreshRef = React.useRef(onRefresh);
  refreshRef.current = onRefresh;
  const mounted = React.useRef(true);
  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const setPull = React.useCallback((px: number) => {
    const el = ref.current;
    /* c8 ignore next */
    if (!el) return;
    el.style.setProperty('--pull', `${px}px`);
  }, []);

  /** Spring back, then drop the transform so fixed children are not held by it. */
  const settleTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const settle = React.useCallback(() => {
    stateRef.current = 'settling';
    setState('settling');
    setPull(0);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (stateRef.current !== 'settling') return;
      stateRef.current = 'idle';
      setState('idle');
    }, SETTLE_MS);
  }, [setPull]);
  React.useEffect(() => () => clearTimeout(settleTimer.current), []);

  // Never re-entered: the button is disabled and a pull cannot start while refreshing.
  const refresh = React.useCallback(async () => {
    stateRef.current = 'refreshing';
    setState('refreshing');
    setMessage(labels.refreshing);
    setPull(threshold);
    let ok = true;
    try {
      await refreshRef.current();
    } catch {
      ok = false;
    }
    if (!mounted.current) return;
    setMessage(ok ? labels.done : labels.failed);
    settle();
  }, [labels.refreshing, labels.done, labels.failed, setPull, settle, threshold]);

  React.useEffect(() => {
    const el = ref.current;
    /* c8 ignore next */
    if (!el || disabled) return;
    let start: { x: number; y: number } | null = null;
    let pulling = false;
    let pull = 0;

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || stateRef.current === 'refreshing' || !scrolledToTop(el)) {
        start = null;
        return;
      }
      const touch = event.touches[0]!;
      start = { x: touch.clientX, y: touch.clientY };
      pulling = false;
      pull = 0;
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0]!;
      const dy = touch.clientY - start.y;
      const dx = touch.clientX - start.x;
      if (!pulling) {
        if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return;
        // Across or up: a scroll or a swipe, not a pull.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          start = null;
          return;
        }
        pulling = true;
      }
      if (event.cancelable) event.preventDefault();
      pull = dampPull(dy - SLOP, threshold);
      setPull(pull);
      const next = pull >= threshold ? 'armed' : 'pulling';
      if (stateRef.current !== next) {
        stateRef.current = next;
        setState(next);
      }
    };
    const onEnd = () => {
      if (!start || !pulling) {
        start = null;
        return;
      }
      start = null;
      pulling = false;
      if (pull >= threshold) {
        void refresh();
      } else {
        settle();
      }
    };

    // A cancel is the system cutting the gesture short (a call, a fourth finger): never refresh.
    const onCancel = () => {
      const wasPulling = start !== null && pulling;
      start = null;
      pulling = false;
      if (wasPulling) settle();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onCancel);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [disabled, refresh, setPull, settle, threshold]);

  const moving = state === 'pulling' || state === 'armed';
  return (
    <div
      ref={ref}
      data-slot="pull-to-refresh"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-state={state}
      aria-busy={state === 'refreshing' || undefined}
      className={cn('relative [--pull:0px]', moving && 'overscroll-y-contain', className)}
      {...props}
    >
      {button === 'hidden' ? null : (
        <div className="pointer-fine:flex pointer-fine:justify-end">
          <button
            type="button"
            data-slot="pull-to-refresh-button"
            disabled={disabled || state === 'refreshing'}
            onClick={() => void refresh()}
            className={cn(
              'sr-only focus-visible:not-sr-only pointer-fine:not-sr-only',
              'text-muted-foreground hover:text-foreground hover:bg-muted inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium',
              'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
              'disabled:pointer-events-none disabled:opacity-60',
            )}
          >
            <svg
              aria-hidden
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            {labels.button}
          </button>
        </div>
      )}
      <div
        aria-hidden
        data-slot="pull-to-refresh-indicator"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center',
          reduced ? 'translate-y-2' : 'translate-y-[calc(var(--pull)-2.75rem)]',
          state === 'idle' || state === 'settling' ? 'opacity-0' : 'opacity-100',
          !moving && 'motion-safe:transition-[translate,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-move',
        )}
      >
        <span className="bg-background border-border text-foreground flex size-9 items-center justify-center rounded-full border shadow-sm">
          {state === 'refreshing' ? (
            <Spinner decorative size="sm" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                'size-4',
                state === 'armed' && 'rotate-180',
                'motion-safe:transition-transform motion-safe:duration-(--duration-base) motion-safe:ease-move',
              )}
            >
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          )}
        </span>
      </div>
      <div
        data-slot="pull-to-refresh-content"
        className={cn(
          !reduced && state !== 'idle' && 'translate-y-(--pull)',
          !moving && 'motion-safe:transition-[translate] motion-safe:duration-(--duration-medium) motion-safe:ease-move',
        )}
      >
        {children}
      </div>
      <span role="status" className="sr-only">
        {message}
      </span>
    </div>
  );
}
PullToRefresh.displayName = 'PullToRefresh';

export { PullToRefresh };
