'use client';

import { useCallback, useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Returns `true` when the user has `prefers-reduced-motion: reduce` set.
 *
 * Use to gate motion-heavy components: animation should be disabled or
 * dramatically reduced when this returns `true`.
 *
 * ## Why `useSyncExternalStore` and not `useState` + `useEffect`
 *
 * The canonical hook — the one MUI, Vercel, Linear and Stripe all ship — is
 * `useState(false)` plus an effect that calls `matchMedia` on mount. It is
 * SSR-safe, and it is **one frame late**: the first render always returns
 * `false`, so a component that gates on it paints its animated first frame and
 * only then snaps to the still state.
 *
 * For most gates that is invisible. For the ones this package ships it is not —
 * the frame that gets painted is `AnimatedList`'s `scale: 0`, `FlipWords`' 8px
 * blur, `Spotlight`'s `opacity: 0`. A user who set the preference precisely
 * because motion makes them ill gets one frame of exactly the motion they
 * turned off, on every mount. WCAG 2.3.3 is not satisfied by "briefly".
 *
 * `useSyncExternalStore` reads the store DURING the first render, so on a
 * client-rendered mount — which is where every decorative component in this
 * package actually lives — the first painted frame is already correct.
 *
 * **The honest statement is that this closes the gap on CSR and cannot close it
 * on hydration.** The server genuinely cannot know the preference, so
 * `getServerSnapshot` must return `false` and the hydration frame is
 * unavoidable for any JavaScript hook. The only thing that closes THAT is CSS,
 * which is why `preflight.css` clamps `animation-duration` and
 * `transition-duration` under `reduce` for `*`: that reset is live before the
 * first paint and needs no JavaScript at all.
 *
 * So this hook is for the motion CSS cannot reach — `motion/react`,
 * `requestAnimationFrame`, timer-driven steps. The registry publishes that
 * split per component as `a11y.motion.driver`.
 *
 * @example
 * ```tsx
 * const reduceMotion = useReducedMotion();
 * <div className={reduceMotion ? 'static' : 'animate-bounce'} />
 * ```
 */
export function useReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    // `matchMedia` is absent in jsdom without a shim and in any non-browser
    // runtime. A no-op unsubscribe leaves the store at the server snapshot
    // rather than throwing — the same failure mode as the effect-based hook,
    // minus the crash.
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mql = window.matchMedia(QUERY);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  }, []);

  // The server cannot know the preference. `false` is the only honest answer,
  // and it is why the hydration frame above is unavoidable.
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
