/**
 * useReducedMotion — the gate every animated component in the DS hangs off.
 *
 * Worth real tests rather than a smoke check: if this hook silently returns
 * `false` forever, nothing breaks, nothing throws, and every motion-heavy
 * component quietly ignores an accessibility preference the user explicitly
 * set. That is a failure with no symptom, which is the kind that survives.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useReducedMotion } from '../src/lib/use-reduced-motion.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * A controllable `matchMedia` whose `change` listeners we can fire by hand.
 *
 * `matches` is MUTABLE and `emit` updates it before notifying, because that is
 * what the platform does: a `MediaQueryList` is live, and reading `.matches`
 * after a change event returns the NEW value. The first version of this stub
 * froze `matches` at construction and passed the new value only through the
 * event object — which quietly encoded the assumption that the hook trusts
 * `event.matches` rather than re-reading the list. `useSyncExternalStore` does
 * re-read it (that is the point: one source of truth, read at render), so the
 * frozen stub reported a failure that only existed in the stub.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const state = { matches };
  const removeEventListener = vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
    listeners.delete(fn);
  });
  const addEventListener = vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
    listeners.add(fn);
  });
  const matchMedia = vi.fn(() => ({
    get matches() {
      return state.matches;
    },
    addEventListener,
    removeEventListener,
  }));
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    addEventListener,
    removeEventListener,
    emit(next: boolean) {
      state.matches = next;
      for (const fn of listeners) fn({ matches: next } as MediaQueryListEvent);
    },
  };
}

function Probe() {
  return <span data-testid="v">{String(useReducedMotion())}</span>;
}

const value = () => screen.getByTestId('v').textContent;

describe('useReducedMotion', () => {
  it('reports the preference the user actually has, on mount', () => {
    stubMatchMedia(true);
    render(<Probe />);
    expect(value()).toBe('true');
  });

  it('is right on the FIRST render, not one frame later', () => {
    // The defect this pins: `useState(false)` + `useEffect` — the canonical
    // shape, shipped by MUI, Vercel, Linear and Stripe — returns `false` on
    // render 1 and the truth on render 2. Everything downstream therefore
    // paints one frame of exactly the motion the user turned off: AnimatedList's
    // `scale: 0`, FlipWords' 8px blur, Spotlight's `opacity: 0`.
    //
    // Recording every render (not just the committed DOM) is what makes that
    // observable — the assertion above passes under BOTH implementations,
    // because by the time RTL hands back the DOM the effect has already run.
    stubMatchMedia(true);
    const seen: boolean[] = [];
    function Recorder() {
      seen.push(useReducedMotion());
      return null;
    }
    render(<Recorder />);
    expect(seen[0], 'the first render already knows the preference').toBe(true);
  });

  it('reports false when the user has expressed no preference', () => {
    stubMatchMedia(false);
    render(<Probe />);
    expect(value()).toBe('false');
  });

  it('queries the reduce query specifically, not a near-miss string', () => {
    // `(prefers-reduced-motion)` alone matches "no-preference" too, which would
    // invert the whole gate.
    const mm = stubMatchMedia(true);
    render(<Probe />);
    expect(mm.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('follows the preference changing while the page is open', () => {
    const mm = stubMatchMedia(false);
    render(<Probe />);
    act(() => mm.emit(true));
    expect(value()).toBe('true');
    act(() => mm.emit(false));
    expect(value()).toBe('false');
  });

  it('renders on the server without touching matchMedia, and says false there', () => {
    // `getServerSnapshot` is only ever called by the server renderer, so a
    // client-only test suite leaves it uncovered — and it is not a formality:
    // it is the branch that decides what the SSR HTML contains. `false` is the
    // only honest answer (the server cannot know the preference), and it is
    // exactly why the hydration frame is unavoidable for any JS hook. The
    // stylesheet reset in preflight.css is what covers that case.
    const matchMedia = vi.fn();
    vi.stubGlobal('matchMedia', matchMedia);
    expect(renderToString(<Probe />)).toContain('false');
    expect(matchMedia, 'the server render must not query the environment').not.toHaveBeenCalled();
  });

  it('removes its listener on unmount, so a long-lived page does not leak one per mount', () => {
    const mm = stubMatchMedia(false);
    const { unmount } = render(<Probe />);
    expect(mm.addEventListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(mm.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('degrades to false where matchMedia does not exist, instead of throwing', () => {
    // The SSR/legacy path. A throw here would take down the whole render of
    // any page containing an animated component.
    vi.stubGlobal('matchMedia', undefined);
    expect(() => render(<Probe />)).not.toThrow();
    expect(value()).toBe('false');
  });
});
