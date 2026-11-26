'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * User intent: what a person meant to do, as typed events, sent wherever the
 * app chooses.
 *
 * A raw DOM event says a button was clicked. An intent says the person meant
 * it: they activated "Join" with the keyboard, read the pricing table for a
 * second, opened the filters and dismissed them with Escape, started the form
 * and left the page. Product analytics, funnels and UX research want the
 * second, and every app ends up writing the same timers and observers to get
 * it. This module writes them once.
 *
 * ## Shape
 *
 * - **Hooks** report one kind of intent each. `useActivateIntent`,
 *   `useViewIntent`, `useDwellIntent`, `useCommitIntent`,
 *   `useDisclosureIntent` and `useFormIntent` return props to spread on the
 *   element (or a callback ref). Each takes a `name` and an optional
 *   `onIntent` callback.
 * - **`IntentProvider`** is the one sink. Every hook below it also reports to
 *   the provider's `onIntent`, so a whole app needs one adapter: the place
 *   that turns an `IntentEvent` into a call to whichever analytics tool the
 *   app uses. Nothing in this file names a vendor.
 * - **Declarative intent** needs no hook: any element with `data-intent="…"`
 *   reports an `activate` when clicked, through the provider. That works in
 *   server components, which cannot call hooks.
 * - **Page signals** come from the provider too: `page_view` and `page_leave`
 *   (how long the page was visible and how far down it was read) when given a
 *   `page`, and `rage_click` when someone clicks the same spot again and again
 *   because nothing seemed to happen.
 *
 * ## Privacy by construction
 *
 * An event carries a name the developer chose, numbers and enums. It never
 * carries what a person typed (`commit` reports the length, not the value),
 * element text, or anything about who they are. The adapter decides what
 * leaves the device; this module gives it nothing that identifies anyone.
 *
 * ## Never in the way
 *
 * A sink that throws is caught and ignored: analytics never breaks a page.
 * Nothing here touches a browser API during render, so every hook is safe in
 * server rendering and can be called with no options.
 */

/** How an activation happened. `keyboard` is Enter or Space on a control. */
export type IntentInput = 'keyboard' | 'mouse' | 'touch' | 'pen';

export type IntentEvent =
  | { kind: 'activate'; name: string; input: IntentInput }
  | { kind: 'view'; name: string; visibleMs: number }
  | {
      kind: 'dwell';
      name: string;
      input: 'pointer' | 'keyboard';
      dwellMs: number;
    }
  | { kind: 'commit'; name: string; length: number }
  | { kind: 'disclosure'; name: string; open: boolean; reason: string }
  | {
      kind: 'form';
      name: string;
      phase: 'start' | 'submit' | 'abandon';
      reason?: 'cancel' | 'page_leave';
    }
  | { kind: 'rage_click'; name: string; clicks: number }
  | { kind: 'page_view'; name: string }
  | { kind: 'page_leave'; name: string; visibleMs: number; depth: number };

export type IntentKind = IntentEvent['kind'];

export type IntentSink = (event: IntentEvent) => void;

/** A pointer must rest this long before a hover counts (ms). */
export const DWELL_INTENT_DELAY_MS = 500;
/** An element must stay in view this long before it counts as seen (ms). */
export const VIEW_INTENT_DELAY_MS = 1000;
/** The share of an element that must be visible to count as in view. */
export const VIEW_INTENT_THRESHOLD = 0.5;
/** A typed value commits after this long without a change (ms). */
export const COMMIT_INTENT_DELAY_MS = 400;
/** Clicks closer together than this (ms and px) belong to one burst. */
export const RAGE_CLICK_WINDOW_MS = 700;
export const RAGE_CLICK_RADIUS_PX = 30;
/** Clicks in one burst before it counts as a rage click. */
export const RAGE_CLICK_COUNT = 3;

const IntentContext = createContext<IntentSink | null>(null);

function safely(sink: IntentSink | null | undefined, event: IntentEvent) {
  try {
    sink?.(event);
  } catch {
    // A failing adapter must never break the interaction it measures.
  }
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * The reporter a hook uses: the hook's own `onIntent` first, then the
 * provider's. Stable for the life of the component.
 */
function useReporter(local?: IntentSink): IntentSink {
  const shared = useContext(IntentContext);
  const localRef = useLatest(local);
  const sharedRef = useLatest(shared);
  return useCallback(
    (event: IntentEvent) => {
      safely(localRef.current, event);
      safely(sharedRef.current, event);
    },
    [localRef, sharedRef],
  );
}

/**
 * Report an intent by hand, for a moment no hook covers (a server confirmed
 * a booking, a game round ended). Reports to the nearest `IntentProvider`;
 * without one it does nothing.
 */
export function useIntent(): IntentSink {
  return useReporter();
}

type ClickLike = {
  detail: number;
  nativeEvent?: { pointerType?: string };
  pointerType?: string;
};

/** Enter or Space on a control fires a click with `detail` 0. */
export function inputOf(event: ClickLike): IntentInput {
  if (event.detail === 0) return 'keyboard';
  const type = event.nativeEvent?.pointerType ?? event.pointerType;
  return type === 'touch' || type === 'pen' ? type : 'mouse';
}

/** The name an element reports under: its intent, else its slot, else its tag. */
function nameOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const declared = target.closest('[data-intent]');
  if (declared) return declared.getAttribute('data-intent');
  const slot = target.closest('[data-slot]');
  if (slot) return slot.getAttribute('data-slot');
  return target.tagName.toLowerCase();
}

function scrollDepth(): number {
  const doc = document.documentElement;
  const height = doc.scrollHeight;
  if (height <= 0) return 100;
  const seen = (window.scrollY + window.innerHeight) / height;
  return Math.round(Math.min(1, Math.max(0, seen)) * 100);
}

/* ---------------------------------------------------------------- Provider */

export interface IntentProviderProps {
  /** Where every intent below this provider goes: the app's adapter. */
  onIntent: IntentSink;
  /**
   * The current page's name, usually its route. When set, the provider
   * reports `page_view` for it, and `page_leave` when it changes or the
   * document is hidden for good (`pagehide`), with the visible time and the
   * deepest point read (0–100).
   */
  page?: string;
  /** Report rage clicks anywhere below the document. Default `true`. */
  rageClicks?: boolean;
  /** Report clicks on `[data-intent]` elements as `activate`. Default `true`. */
  declarative?: boolean;
  children?: ReactNode;
}

export function IntentProvider({
  onIntent,
  page,
  rageClicks = true,
  declarative = true,
  children,
}: IntentProviderProps) {
  const sinkRef = useLatest(onIntent);
  const [sink] = useState<IntentSink>(
    () => (event: IntentEvent) => safely(sinkRef.current, event),
  );

  // Declarative activations and rage clicks share one document listener.
  useEffect(() => {
    if (!declarative && !rageClicks) return;
    let burst: { x: number; y: number; at: number; clicks: number } | null =
      null;
    const onClick = (event: MouseEvent) => {
      if (declarative && event.target instanceof Element) {
        const declared = event.target.closest('[data-intent]');
        if (declared) {
          sink({
            kind: 'activate',
            name: declared.getAttribute('data-intent') as string,
            input: inputOf(event as MouseEvent & { pointerType?: string }),
          });
        }
      }
      if (!rageClicks || event.detail === 0) return;
      const at = event.timeStamp;
      const prev = burst;
      const near =
        prev !== null &&
        at - prev.at <= RAGE_CLICK_WINDOW_MS &&
        Math.hypot(event.clientX - prev.x, event.clientY - prev.y) <=
          RAGE_CLICK_RADIUS_PX;
      burst = {
        x: event.clientX,
        y: event.clientY,
        at,
        clicks: near ? prev.clicks + 1 : 1,
      };
      // Once per burst: the third click reports, the fourth does not.
      if (burst.clicks === RAGE_CLICK_COUNT) {
        sink({
          kind: 'rage_click',
          name: nameOf(event.target) ?? 'document',
          clicks: burst.clicks,
        });
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [declarative, rageClicks, sink]);

  // Page view and leave, with visible time and read depth.
  useEffect(() => {
    if (page === undefined) return;
    let visibleMs = 0;
    let since: number | null =
      document.visibilityState === 'visible' ? Date.now() : null;
    let depth = scrollDepth();
    let left = false;
    sink({ kind: 'page_view', name: page });

    const onScroll = () => {
      depth = Math.max(depth, scrollDepth());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        since ??= Date.now();
      } else if (since !== null) {
        visibleMs += Date.now() - since;
        since = null;
      }
    };
    const leave = () => {
      if (left) return;
      left = true;
      onVisibility();
      const total = visibleMs + (since === null ? 0 : Date.now() - since);
      sink({ kind: 'page_leave', name: page, visibleMs: total, depth });
    };
    // A page restored from the back-forward cache is a new view.
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      left = false;
      visibleMs = 0;
      since = Date.now();
      sink({ kind: 'page_view', name: page });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', onShow);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', onShow);
      leave();
    };
  }, [page, sink]);

  return createElement(IntentContext.Provider, { value: sink }, children);
}

/* ------------------------------------------------------------------- Hooks */

interface BaseOptions {
  /** What this intent is called in reports, e.g. `join_room`. */
  name?: string;
  /** Called for this element's intents, before the provider's sink. */
  onIntent?: IntentSink;
}

/**
 * Every activation, at once, with how it happened. A click is already
 * intentional, so there is no delay. Call `onClick` from the control's own
 * click handler.
 */
export function useActivateIntent({
  name = 'activate',
  onIntent,
}: BaseOptions = {}) {
  const report = useReporter(onIntent);
  const onClick = useCallback(
    (event: ClickLike) => report({ kind: 'activate', name, input: inputOf(event) }),
    [report, name],
  );
  return { onClick };
}

export interface ViewIntentOptions extends BaseOptions {
  /** Time in view before it counts. Default 1000 ms. */
  delayMs?: number;
  /** Share visible to count as in view, 0–1. Default 0.5. Lower it for tall elements. */
  threshold?: number;
  /** Report at most once per mount. Default `true`; `false` reports each stay. */
  once?: boolean;
}

/**
 * The element was seen: at least `threshold` of it stayed visible for
 * `delayMs`. Scrolling past reports nothing. Without `IntersectionObserver`
 * it never reports, because a false "seen" is worse than a missing one.
 */
export function useViewIntent({
  name = 'view',
  onIntent,
  delayMs = VIEW_INTENT_DELAY_MS,
  threshold = VIEW_INTENT_THRESHOLD,
  once = true,
}: ViewIntentOptions = {}) {
  const report = useReporter(onIntent);
  const [element, setElement] = useState<Element | null>(null);

  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1) as IntersectionObserverEntry;
        const inView =
          entry.isIntersecting && entry.intersectionRatio >= threshold;
        if (inView && timer === undefined) {
          timer = setTimeout(() => {
            report({ kind: 'view', name, visibleMs: delayMs });
            if (once) observer.disconnect();
          }, delayMs);
        } else if (!inView) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: [0, threshold] },
    );
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [element, delayMs, threshold, once, name, report]);

  return { ref: setElement };
}

export interface DwellIntentOptions extends BaseOptions {
  /** Rest time before it counts. Default 500 ms. */
  delayMs?: number;
  /** Report at most once per mount. Default `true`. */
  once?: boolean;
}

/**
 * Attention that rested: a pointer hovering, or keyboard focus sitting, on
 * the element for `delayMs`. Passing over it reports nothing. Touch never
 * dwells (a tap is an activation), and focus counts only when it is visible
 * keyboard focus, never focus a click or the app moved.
 *
 * A disabled button gets no pointer events: spread these on a wrapper.
 */
export function useDwellIntent({
  name = 'dwell',
  onIntent,
  delayMs = DWELL_INTENT_DELAY_MS,
  once = true,
}: DwellIntentOptions = {}) {
  const report = useReporter(onIntent);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const done = useRef(false);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  const start = useCallback(
    (input: 'pointer' | 'keyboard') => {
      if (done.current) return;
      cancel();
      timer.current = setTimeout(() => {
        timer.current = undefined;
        if (once) done.current = true;
        report({ kind: 'dwell', name, input, dwellMs: delayMs });
      }, delayMs);
    },
    [cancel, delayMs, name, once, report],
  );
  useEffect(() => cancel, [cancel]);

  return {
    onPointerEnter: (event: { pointerType?: string }) => {
      if (event.pointerType !== 'touch') start('pointer');
    },
    onPointerLeave: cancel,
    onFocus: (event: { currentTarget: Element }) => {
      let visible = false;
      try {
        visible = event.currentTarget.matches(':focus-visible');
      } catch {
        visible = false;
      }
      if (visible) start('keyboard');
    },
    onBlur: cancel,
  };
}

export interface CommitIntentOptions<T> extends BaseOptions {
  /** The field's current value. Its value at mount is the baseline. */
  value?: T;
  /** Pause after the last change before the value commits. Default 400 ms. */
  delayMs?: number;
}

/**
 * A typed value the person settled on: `delayMs` after the last change, or at
 * once when they leave the field. Never per keystroke, never the same value
 * twice in a row. Reports the value's length only, never the value.
 */
export function useCommitIntent<T>({
  name = 'commit',
  onIntent,
  value,
  delayMs = COMMIT_INTENT_DELAY_MS,
}: CommitIntentOptions<T> = {}) {
  const report = useReporter(onIntent);
  const last = useRef(value);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (!next || Object.is(next.value, last.current)) return;
    last.current = next.value;
    if (next.value === undefined || next.value === null) return;
    report({ kind: 'commit', name, length: String(next.value).length });
  }, [name, report]);

  useEffect(() => {
    if (Object.is(value, last.current) && !pending.current) return;
    pending.current = { value: value as T };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delayMs);
  }, [value, delayMs, flush]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return { onBlur: flush };
}

export interface DisclosureIntentOptions extends BaseOptions {
  /** Whether the overlay is open at mount. Default `false`. */
  initialOpen?: boolean;
}

/**
 * Each real open and close of an overlay (dialog, popover, menu, drawer),
 * with why it closed. Pass `onOpenChange` to the overlay, or call it from
 * yours. A controlled overlay repeating its state reports nothing. `reason`
 * is whatever the overlay gives (Base UI: `escape-key`, `outside-press`, …),
 * or `none`.
 */
export function useDisclosureIntent({
  name = 'disclosure',
  onIntent,
  initialOpen = false,
}: DisclosureIntentOptions = {}) {
  const report = useReporter(onIntent);
  const open = useRef(initialOpen);
  const onOpenChange = useCallback(
    (next: boolean, details?: { reason?: string }) => {
      if (next === open.current) return;
      open.current = next;
      report({
        kind: 'disclosure',
        name,
        open: next,
        reason: details?.reason ?? 'none',
      });
    },
    [name, report],
  );
  return { onOpenChange };
}

/**
 * A form's life: `start` on the first change, `submit`, or `abandon` when it
 * was started and then cancelled or the page was left. Each reports at most
 * once per mount, and nothing follows a submit.
 */
export function useFormIntent({ name = 'form', onIntent }: BaseOptions = {}) {
  const report = useReporter(onIntent);
  const [phase, setPhase] = useState<'idle' | 'started' | 'done'>('idle');
  const phaseRef = useRef(phase);
  const move = useCallback((next: 'started' | 'done') => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const onChange = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    move('started');
    report({ kind: 'form', name, phase: 'start' });
  }, [move, name, report]);
  const markSubmitted = useCallback(() => {
    if (phaseRef.current === 'done') return;
    move('done');
    report({ kind: 'form', name, phase: 'submit' });
  }, [move, name, report]);
  const markCancelled = useCallback(() => {
    if (phaseRef.current !== 'started') return;
    move('done');
    report({ kind: 'form', name, phase: 'abandon', reason: 'cancel' });
  }, [move, name, report]);

  useEffect(() => {
    if (phase !== 'started') return;
    const onLeave = () => {
      if (phaseRef.current !== 'started') return;
      move('done');
      report({ kind: 'form', name, phase: 'abandon', reason: 'page_leave' });
    };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [phase, move, name, report]);

  return { onChange, markSubmitted, markCancelled };
}
