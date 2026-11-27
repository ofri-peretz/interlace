'use client';

/**
 * @interlace/ui — Presence and Swap
 *
 * Content that arrives and leaves instead of popping in and out. `Presence`
 * keeps a block on the page for the moment it takes to leave, so a hint, a
 * result or a "you got it" note fades away rather than vanishing. `Swap` trades
 * one piece of content for the next (a quiz question for the following one,
 * one step for another, today's card for tomorrow's): the old one leaves,
 * then the new one arrives, so the reader sees that something changed and in
 * which direction.
 *
 * ## How to use it
 *
 *   <Presence show={answered} effect="rise">
 *     <Callout>Right, and here is why.</Callout>
 *   </Presence>
 *
 *   <Swap swapKey={question.id} effect="slide" direction="forward">
 *     <QuizQuestion … />
 *   </Swap>
 *
 * `Presence` renders nothing while `show` is false and it has finished
 * leaving. `Swap` always renders exactly one version of its content: the old
 * one until it has left, then the new one, never both at once, so the reading
 * order never holds two copies.
 *
 * ## Content first
 *
 * The server renders what is shown, with no inline style, so a crawler or a
 * reader without scripts gets the content. Content on its way out is `inert`
 * and hidden from assistive technology at once: it can't take focus or be
 * read while it fades. When the content that leaves held the keyboard focus,
 * `Swap` moves focus to the new content (the wrapper takes `tabIndex={-1}`
 * for that moment), so a keyboard or screen reader user is never dropped back
 * to the top of the page.
 *
 * ## Motion
 *
 * Web Animations on `opacity`, `transform` and (for `blur`) `filter` only,
 * which the compositor runs, so nothing around the block reflows while it
 * moves; when the size changes, it changes once, while the content is
 * invisible. Arrival takes `--duration-medium` on `--ease-enter`; leaving is
 * quicker, `--duration-base` on `--ease-exit`. Both read the brand's motion
 * tokens when they play, so a brand that retunes motion retunes these too.
 * `slide` moves along the reading direction, and flips in a right-to-left
 * page. It travels 1.5rem past the block's edge, so a Swap as wide as its
 * page needs a container with `overflow-x: clip`, or the page scrolls
 * sideways for the length of the slide. A change that comes back before the leave has finished turns the
 * leave around instead of starting over. Under `prefers-reduced-motion:
 * reduce`, or without `element.animate`, content simply appears and goes.
 *
 * ## Composition
 *
 *   Presence                            (div by default, or `render` — data-slot="presence", data-state, data-effect)
 *     └─ children
 *   Swap                                (div by default, or `render` — data-slot="swap", data-state, data-effect)
 *     └─ children                       (the version now shown)
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `div` props                                          |
 * | R6   | data-slot per part      | presence / swap                                      |
 * | R7   | cn + ...rest            | `cn(className)` + `{...props}` + `useRender`         |
 * | R8   | Enums, not booleans     | `effect`, `direction`                                |
 * | R13  | Ecosystem first         | `useRender` to be the element itself                 |
 * | R19  | Tokens only             | `--duration-*`, `--ease-*` read at play time         |
 * | R25  | Client component        | plays in the browser                                 |
 * | R26  | A11y                    | leaving content is inert; focus follows a swap       |
 */

import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { motionDuration, motionEase } from '../lib/motion-token.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export type PresenceEffect = 'fade' | 'rise' | 'scale' | 'blur';
export type SwapEffect = PresenceEffect | 'slide';
export type SwapDirection = 'forward' | 'back';

/** Where each effect starts from when arriving. Every one rests at the element's own style. */
const AWAY = {
  fade: { opacity: 0 },
  rise: { opacity: 0, transform: 'translateY(0.75rem)' },
  scale: { opacity: 0, transform: 'scale(0.96)' },
  blur: { opacity: 0, filter: 'blur(0.375rem)' },
} as const satisfies Record<PresenceEffect, Keyframe>;

const HERE = {
  fade: { opacity: 1 },
  rise: { opacity: 1, transform: 'none' },
  scale: { opacity: 1, transform: 'none' },
  blur: { opacity: 1, filter: 'none' },
} as const satisfies Record<PresenceEffect, Keyframe>;

type Phase = 'enter' | 'exit';

/** The brand's motion tokens as they stand when the animation starts: arrival is slower than leaving. */
function motionTiming(el: Element, phase: Phase): KeyframeAnimationOptions {
  return {
    duration: motionDuration(el, phase === 'enter' ? 'medium' : 'base'),
    easing: motionEase(el, phase),
  };
}

function canAnimate(el: HTMLElement | null): el is HTMLElement {
  return !!el && typeof el.animate === 'function';
}

function slide(el: Element, offset: 1 | -1): [Keyframe, Keyframe] {
  const rtl = el.closest('[dir]')?.getAttribute('dir') === 'rtl';
  const x = `${(rtl ? -offset : offset) * 1.5}rem`;
  return [
    { opacity: 0, transform: `translateX(${x})` },
    { opacity: 1, transform: 'none' },
  ];
}

/* -------------------------------------------------------------------------- */
/* Presence                                                                   */
/* -------------------------------------------------------------------------- */

export interface PresenceProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Whether the content is on the page. Turning it off plays the leave, then removes it. */
  show: boolean;
  /** How it arrives and leaves. Every effect fades; `rise` also lifts, `scale` grows, `blur` sharpens. @default 'fade' */
  effect?: PresenceEffect;
  /** Play the arrival on the first render too, not only when `show` turns on later. @default false */
  appear?: boolean;
  /** Called once the content has left and is no longer rendered. */
  onExited?: () => void;
  /** Replace the rendered element, e.g. `<section />` or `<li />`. */
  render?: useRender.RenderProp;
}

export function Presence({
  show,
  effect = 'fade',
  appear = false,
  onExited,
  render,
  className,
  children,
  ...props
}: PresenceProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const [mounted, setMounted] = React.useState(show);
  const first = React.useRef(true);
  const running = React.useRef<{ animation: Animation; phase: Phase } | null>(null);
  // Whether the content is on the page, as the layout effect last left it.
  const onPage = React.useRef(show);
  const exited = React.useRef(onExited);
  React.useLayoutEffect(() => {
    exited.current = onExited;
  });

  // Turning on mounts at once, in the same render, so there is no blank frame.
  if (show && !mounted) setMounted(true);

  React.useLayoutEffect(() => {
    const el = ref.current;
    const isFirst = first.current;
    first.current = false;
    const current = running.current;

    if (show) {
      onPage.current = true;
      if (current?.phase === 'exit') {
        // Coming back mid-leave: turn the leave around from where it is.
        current.animation.onfinish = null;
        current.animation.reverse();
        running.current = { animation: current.animation, phase: 'enter' };
        return;
      }
      if ((isFirst && !appear) || reduced || !canAnimate(el)) return;
      const animation = el.animate([AWAY[effect], HERE[effect]], motionTiming(el, 'enter'));
      running.current = { animation, phase: 'enter' };
      animation.onfinish = () => {
        if (running.current?.animation === animation) running.current = null;
      };
      return;
    }

    if (!onPage.current) return;
    const done = () => {
      onPage.current = false;
      running.current = null;
      setMounted(false);
      exited.current?.();
    };
    if (reduced || !canAnimate(el)) {
      done();
      return;
    }
    current?.animation.cancel();
    const animation = el.animate([HERE[effect], AWAY[effect]], {
      ...motionTiming(el, 'exit'),
      fill: 'forwards',
    });
    running.current = { animation, phase: 'exit' };
    animation.onfinish = done;
  }, [show, reduced, effect, appear]);

  React.useEffect(
    () => () => {
      running.current?.animation.cancel();
    },
    [],
  );

  const element = useRender({
    render: render ?? <div />,
    ref,
    props: {
      'data-slot': 'presence',
      'data-state': show ? 'open' : 'closed',
      'data-effect': effect,
      inert: show ? undefined : true,
      'aria-hidden': show ? undefined : true,
      className: cn(className) || undefined,
      ...props,
      children,
    },
  });

  return mounted ? element : null;
}

/* -------------------------------------------------------------------------- */
/* Swap                                                                       */
/* -------------------------------------------------------------------------- */

export interface SwapProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Names the content now shown. When it changes, the old content leaves, then the new arrives. */
  swapKey: React.Key;
  /** How the versions trade places. `slide` moves along the reading direction. @default 'fade' */
  effect?: SwapEffect;
  /** For `slide`: `forward` (next, the default) arrives from the inline end; `back` from the inline start. @default 'forward' */
  direction?: SwapDirection;
  /** Replace the rendered element, e.g. `<section />` or `<li />`. */
  render?: useRender.RenderProp;
}

type Shown = { key: React.Key; node: React.ReactNode };

export function Swap({
  swapKey,
  effect = 'fade',
  direction = 'forward',
  render,
  className,
  children,
  onBlur,
  ...props
}: SwapProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const [shown, setShown] = React.useState<Shown>({ key: swapKey, node: children });
  const latest = React.useRef<Shown>({ key: swapKey, node: children });
  const leave = React.useRef<Animation | null>(null);
  const arrive = React.useRef<Animation | null>(null);
  const hadFocus = React.useRef(false);
  const arriving = React.useRef(false);
  const ended = React.useRef<Animation | null>(null);
  const [focusable, setFocusable] = React.useState(false);

  // While the key holds, new children for it show at once.
  const settled = swapKey === shown.key;
  if (settled && children !== shown.node) setShown({ key: swapKey, node: children });

  React.useLayoutEffect(() => {
    latest.current = { key: swapKey, node: children };
  });

  const keyframes = React.useCallback(
    (el: Element, phase: Phase): Keyframe[] => {
      if (effect !== 'slide') {
        return phase === 'enter' ? [AWAY[effect], HERE[effect]] : [HERE[effect], AWAY[effect]];
      }
      const forward = direction === 'forward' ? 1 : -1;
      // Forward: the old one leaves toward the inline start, the new one comes from the inline end.
      if (phase === 'enter') return slide(el, forward);
      const [away, here] = slide(el, forward === 1 ? -1 : 1);
      return [here, away];
    },
    [effect, direction],
  );

  // The key changed: play the leave, then show the latest content.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (settled) {
      // Came back to the shown key before the leave finished: stay.
      if (leave.current) {
        leave.current.onfinish = null;
        leave.current.cancel();
        leave.current = null;
      }
      return;
    }
    if (el && typeof document !== 'undefined' && el.contains(document.activeElement)) {
      hadFocus.current = true;
    }
    const commit = () => {
      ended.current = leave.current;
      leave.current = null;
      arriving.current = true;
      setShown(latest.current);
    };
    if (reduced || !canAnimate(el)) {
      commit();
      return;
    }
    if (leave.current) return; // already leaving: the finish shows whatever is latest then
    arrive.current?.cancel();
    const animation = el.animate(keyframes(el, 'exit'), { ...motionTiming(el, 'exit'), fill: 'forwards' });
    leave.current = animation;
    animation.onfinish = commit;
  }, [settled, swapKey, reduced, keyframes]);

  // The new content is in: clear the leave's end state, play the arrival, hand focus over.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!arriving.current || !el) return;
    arriving.current = false;
    ended.current?.cancel();
    ended.current = null;
    if (!reduced && canAnimate(el)) {
      arrive.current = el.animate(keyframes(el, 'enter'), motionTiming(el, 'enter'));
    }
    if (hadFocus.current) {
      hadFocus.current = false;
      setFocusable(true);
    }
  }, [shown.key, reduced, keyframes]);

  // Focus moves once the wrapper can take it, then the wrapper leaves the tab order again on blur.
  React.useEffect(() => {
    if (!focusable) return;
    ref.current?.focus({ preventScroll: true });
  }, [focusable]);

  React.useEffect(
    () => () => {
      leave.current?.cancel();
      arrive.current?.cancel();
    },
    [],
  );

  const leaving = !settled;
  return useRender({
    render: render ?? <div />,
    ref,
    props: {
      'data-slot': 'swap',
      'data-state': leaving ? 'leaving' : 'shown',
      'data-effect': effect,
      inert: leaving ? true : undefined,
      'aria-hidden': leaving ? true : undefined,
      tabIndex: focusable ? -1 : undefined,
      className: cn(className) || undefined,
      ...props,
      onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
        // Out of the tab order again once focus moves on from the wrapper itself.
        if (focusable && event.target === event.currentTarget) setFocusable(false);
        onBlur?.(event);
      },
      children: shown.node,
    },
  });
}
