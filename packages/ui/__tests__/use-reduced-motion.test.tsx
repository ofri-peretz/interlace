/**
 * useReducedMotion — the gate every animated component in the DS hangs off.
 *
 * Worth real tests rather than a smoke check: if this hook silently returns
 * `false` forever, nothing breaks, nothing throws, and every motion-heavy
 * component quietly ignores an accessibility preference the user explicitly
 * set. That is a failure with no symptom, which is the kind that survives.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useReducedMotion } from '../src/lib/use-reduced-motion.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A controllable `matchMedia` whose `change` listeners we can fire by hand. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const removeEventListener = vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
    listeners.delete(fn);
  });
  const addEventListener = vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
    listeners.add(fn);
  });
  const matchMedia = vi.fn(() => ({ matches, addEventListener, removeEventListener }));
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    addEventListener,
    removeEventListener,
    emit(next: boolean) {
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
