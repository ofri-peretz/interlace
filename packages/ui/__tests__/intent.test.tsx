/**
 * User intent: each hook's timing rules, the provider's sink, declarative
 * `data-intent`, rage clicks, and page view/leave. Fake timers drive every
 * delay, and a stub IntersectionObserver drives visibility.
 */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMMIT_INTENT_DELAY_MS,
  DWELL_INTENT_DELAY_MS,
  IntentProvider,
  RAGE_CLICK_WINDOW_MS,
  VIEW_INTENT_DELAY_MS,
  inputOf,
  useActivateIntent,
  useCommitIntent,
  useDisclosureIntent,
  useDwellIntent,
  useFormIntent,
  useIntent,
  useViewIntent,
  type IntentEvent,
} from '../src/lib/intent.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function withProvider(sink: (e: IntentEvent) => void, props: Record<string, unknown> = {}) {
  return ({ children }: { children: ReactNode }) => (
    <IntentProvider onIntent={sink} {...props}>
      {children}
    </IntentProvider>
  );
}

describe('inputOf', () => {
  it('reads keyboard, touch, pen and mouse', () => {
    expect(inputOf({ detail: 0 })).toBe('keyboard');
    expect(inputOf({ detail: 1, nativeEvent: { pointerType: 'touch' } })).toBe('touch');
    expect(inputOf({ detail: 1, pointerType: 'pen' })).toBe('pen');
    expect(inputOf({ detail: 1, pointerType: 'mouse' })).toBe('mouse');
    expect(inputOf({ detail: 1 })).toBe('mouse');
  });
});

describe('useActivateIntent', () => {
  it('reports at once to its own callback and to the provider', () => {
    const local = vi.fn();
    const shared = vi.fn();
    const { result } = renderHook(() => useActivateIntent({ name: 'join', onIntent: local }), {
      wrapper: withProvider(shared, { rageClicks: false, declarative: false }),
    });
    result.current.onClick({ detail: 0 });
    const event = { kind: 'activate', name: 'join', input: 'keyboard' };
    expect(local).toHaveBeenCalledWith(event);
    expect(shared).toHaveBeenCalledWith(event);
  });

  it('works with no options and no provider', () => {
    const { result } = renderHook(() => useActivateIntent());
    expect(() => result.current.onClick({ detail: 1 })).not.toThrow();
  });

  it('swallows a throwing sink', () => {
    const { result } = renderHook(() =>
      useActivateIntent({
        onIntent: () => {
          throw new Error('adapter down');
        },
      }),
    );
    expect(() => result.current.onClick({ detail: 1 })).not.toThrow();
  });
});

describe('useIntent', () => {
  it('reports by hand to the provider', () => {
    const shared = vi.fn();
    const { result } = renderHook(() => useIntent(), {
      wrapper: withProvider(shared, { rageClicks: false, declarative: false }),
    });
    result.current({ kind: 'form', name: 'booking', phase: 'submit' });
    expect(shared).toHaveBeenCalledWith({ kind: 'form', name: 'booking', phase: 'submit' });
  });
});

describe('IntentProvider clicks', () => {
  function Page() {
    return (
      <div>
        <button type="button" data-intent="start_quiz">
          <span>Start</span>
        </button>
        <div data-slot="card">
          <span>card body</span>
        </div>
        <p>plain</p>
      </div>
    );
  }

  it('reports declared intents from inner clicks', () => {
    const sink = vi.fn();
    render(
      <IntentProvider onIntent={sink} rageClicks={false}>
        <Page />
      </IntentProvider>,
    );
    fireEvent.click(screen.getByText('Start'), { detail: 1 });
    expect(sink).toHaveBeenCalledWith({ kind: 'activate', name: 'start_quiz', input: 'mouse' });
    sink.mockClear();
    fireEvent.click(screen.getByText('plain'), { detail: 1 });
    expect(sink).not.toHaveBeenCalled();
  });

  it('ignores clicks on non-elements', () => {
    const sink = vi.fn();
    render(<IntentProvider onIntent={sink} />);
    act(() => {
      document.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });
    expect(sink).not.toHaveBeenCalled();
  });

  it('does nothing when both click features are off', () => {
    const sink = vi.fn();
    render(
      <IntentProvider onIntent={sink} rageClicks={false} declarative={false}>
        <Page />
      </IntentProvider>,
    );
    fireEvent.click(screen.getByText('Start'), { detail: 1 });
    expect(sink).not.toHaveBeenCalled();
  });

  function burst(target: Element, n: number, at = 0, x = 10) {
    for (let i = 0; i < n; i++) {
      const event = new MouseEvent('click', { bubbles: true, detail: 1, clientX: x, clientY: 10 });
      Object.defineProperty(event, 'timeStamp', { value: at + i * 100 });
      act(() => {
        target.dispatchEvent(event);
      });
    }
  }

  const rage = (sink: ReturnType<typeof vi.fn>) =>
    sink.mock.calls.map(([e]) => e as IntentEvent).filter((e) => e.kind === 'rage_click');

  it('reports a rage click once per burst, named by intent, slot or tag', () => {
    const sink = vi.fn();
    render(
      <IntentProvider onIntent={sink} declarative={false}>
        <Page />
      </IntentProvider>,
    );
    burst(screen.getByText('Start'), 5);
    expect(rage(sink)).toEqual([{ kind: 'rage_click', name: 'start_quiz', clicks: 3 }]);
    burst(screen.getByText('card body'), 3, 10_000);
    burst(screen.getByText('plain'), 3, 20_000);
    expect(rage(sink).map((e) => e.name)).toEqual(['start_quiz', 'card', 'p']);
  });

  it('starts a new burst after a pause or a move', () => {
    const sink = vi.fn();
    render(
      <IntentProvider onIntent={sink} declarative={false}>
        <Page />
      </IntentProvider>,
    );
    const target = screen.getByText('plain');
    burst(target, 2, 0);
    burst(target, 1, 100 + RAGE_CLICK_WINDOW_MS + 1);
    burst(target, 1, 5000, 10);
    burst(target, 1, 5100, 200);
    expect(rage(sink)).toEqual([]);
  });

  it('never counts keyboard clicks, and names document clicks', () => {
    const sink = vi.fn();
    render(<IntentProvider onIntent={sink} declarative={false} />);
    for (let i = 0; i < 3; i++) {
      act(() => {
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      });
    }
    expect(rage(sink)).toEqual([]);
    for (let i = 0; i < 3; i++) {
      act(() => {
        document.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      });
    }
    expect(rage(sink)).toEqual([{ kind: 'rage_click', name: 'document', clicks: 3 }]);
  });
});

describe('IntentProvider pages', () => {
  let visibility: DocumentVisibilityState = 'visible';
  beforeEach(() => {
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
  });

  const setHeight = (scrollHeight: number, innerHeight: number, scrollY: number) => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: scrollHeight,
      configurable: true,
    });
    vi.stubGlobal('innerHeight', innerHeight);
    vi.stubGlobal('scrollY', scrollY);
  };

  it('reports view, then leave with visible time and depth on route change', () => {
    setHeight(2000, 500, 0);
    const sink = vi.fn();
    const { rerender } = render(<IntentProvider onIntent={sink} page="/a" />);
    expect(sink).toHaveBeenLastCalledWith({ kind: 'page_view', name: '/a' });

    vi.setSystemTime(1000);
    setHeight(2000, 500, 1000);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    setHeight(2000, 500, 0);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    visibility = 'hidden';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    vi.setSystemTime(5000);
    visibility = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    vi.setSystemTime(5500);

    rerender(<IntentProvider onIntent={sink} page="/b" />);
    expect(sink).toHaveBeenCalledWith({ kind: 'page_leave', name: '/a', visibleMs: 1500, depth: 75 });
    expect(sink).toHaveBeenLastCalledWith({ kind: 'page_view', name: '/b' });
  });

  it('reports leave once on pagehide, and a new view after a cache restore', () => {
    setHeight(0, 500, 0);
    visibility = 'hidden';
    const sink = vi.fn();
    const { unmount } = render(<IntentProvider onIntent={sink} page="/a" />);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(sink).toHaveBeenCalledWith({ kind: 'page_leave', name: '/a', visibleMs: 0, depth: 100 });

    act(() => {
      const plain = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(plain, 'persisted', { value: false });
      window.dispatchEvent(plain);
    });
    expect(sink.mock.calls.filter(([e]) => e.kind === 'page_view')).toHaveLength(1);

    act(() => {
      const restored = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(restored, 'persisted', { value: true });
      window.dispatchEvent(restored);
    });
    expect(sink.mock.calls.filter(([e]) => e.kind === 'page_view')).toHaveLength(2);
    vi.setSystemTime(300);
    unmount();
    expect(sink).toHaveBeenLastCalledWith({ kind: 'page_leave', name: '/a', visibleMs: 300, depth: 100 });
    expect(sink.mock.calls.filter(([e]) => e.kind === 'page_leave')).toHaveLength(2);
  });

  it('sends nothing for pages without a page name', () => {
    const sink = vi.fn();
    render(<IntentProvider onIntent={sink} />);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(sink).not.toHaveBeenCalled();
  });
});

describe('useViewIntent', () => {
  type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
  let observers: { callback: Callback; disconnect: ReturnType<typeof vi.fn> }[];

  beforeEach(() => {
    vi.useFakeTimers();
    observers = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn();
        constructor(callback: Callback) {
          observers.push({ callback, disconnect: this.disconnect });
        }
        observe() {}
      },
    );
  });

  const see = (ratio: number, isIntersecting = ratio > 0) =>
    act(() => {
      observers.at(-1)!.callback([{ isIntersecting, intersectionRatio: ratio }]);
    });

  function Seen(props: Parameters<typeof useViewIntent>[0]) {
    const { ref } = useViewIntent(props);
    return <section ref={ref}>report</section>;
  }

  it('reports once the element has stayed in view, once per mount', () => {
    const onIntent = vi.fn();
    render(<Seen name="pricing" onIntent={onIntent} />);
    see(0.6);
    see(0.8);
    act(() => {
      vi.advanceTimersByTime(VIEW_INTENT_DELAY_MS);
    });
    expect(onIntent).toHaveBeenCalledWith({ kind: 'view', name: 'pricing', visibleMs: 1000 });
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('reports nothing when scrolled past, or when below the threshold', () => {
    const onIntent = vi.fn();
    render(<Seen onIntent={onIntent} once={false} />);
    see(0.6);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    see(0.4, true);
    see(0, false);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onIntent).not.toHaveBeenCalled();
    see(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(observers[0].disconnect).not.toHaveBeenCalled();
  });

  it('never reports without IntersectionObserver, and cleans up on unmount', () => {
    const onIntent = vi.fn();
    const { unmount } = render(<Seen onIntent={onIntent} />);
    see(1);
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onIntent).not.toHaveBeenCalled();

    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Seen onIntent={onIntent} />);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('can be called with no options', () => {
    const { result } = renderHook(() => useViewIntent());
    expect(typeof result.current.ref).toBe('function');
  });
});

describe('useDwellIntent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function Target(props: Parameters<typeof useDwellIntent>[0]) {
    const dwell = useDwellIntent(props);
    return (
      <button type="button" {...dwell}>
        help
      </button>
    );
  }

  it('reports a pointer that rested, once per mount', () => {
    const onIntent = vi.fn();
    render(<Target name="help" onIntent={onIntent} />);
    const el = screen.getByText('help');
    fireEvent.pointerEnter(el, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(DWELL_INTENT_DELAY_MS);
    });
    fireEvent.pointerLeave(el);
    fireEvent.pointerEnter(el, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(DWELL_INTENT_DELAY_MS);
    });
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith({ kind: 'dwell', name: 'help', input: 'pointer', dwellMs: 500 });
  });

  it('ignores passing over and touch; reports each rest when not once', () => {
    const onIntent = vi.fn();
    render(<Target onIntent={onIntent} once={false} />);
    const el = screen.getByText('help');
    fireEvent.pointerEnter(el, { pointerType: 'touch' });
    fireEvent.pointerEnter(el, { pointerType: 'pen' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.pointerLeave(el);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIntent).not.toHaveBeenCalled();
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerEnter(el, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(DWELL_INTENT_DELAY_MS);
      });
      fireEvent.pointerLeave(el);
    }
    expect(onIntent).toHaveBeenCalledTimes(2);
  });

  it('counts visible keyboard focus only', () => {
    const onIntent = vi.fn();
    render(<Target onIntent={onIntent} />);
    const el = screen.getByText('help');
    const matches = vi.spyOn(el, 'matches');

    matches.mockReturnValue(false);
    fireEvent.focus(el);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    matches.mockImplementation(() => {
      throw new SyntaxError('unsupported selector');
    });
    fireEvent.focus(el);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIntent).not.toHaveBeenCalled();

    matches.mockReturnValue(true);
    fireEvent.focus(el);
    fireEvent.blur(el);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIntent).not.toHaveBeenCalled();
    fireEvent.focus(el);
    act(() => {
      vi.advanceTimersByTime(DWELL_INTENT_DELAY_MS);
    });
    expect(onIntent).toHaveBeenCalledWith({ kind: 'dwell', name: 'dwell', input: 'keyboard', dwellMs: 500 });
  });

  it('never reports touch', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useDwellIntent({ onIntent }));
    result.current.onPointerEnter({ pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(DWELL_INTENT_DELAY_MS * 2);
    });
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('can be called with no options', () => {
    const { result } = renderHook(() => useDwellIntent());
    expect(typeof result.current.onBlur).toBe('function');
  });
});

describe('useCommitIntent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('reports the settled length after a pause, never the value', () => {
    const onIntent = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useCommitIntent({ name: 'search', value, onIntent }),
      { initialProps: { value: '' } },
    );
    rerender({ value: 'j' });
    rerender({ value: 'je' });
    act(() => {
      vi.advanceTimersByTime(COMMIT_INTENT_DELAY_MS - 1);
    });
    expect(onIntent).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onIntent).toHaveBeenCalledWith({ kind: 'commit', name: 'search', length: 2 });
  });

  it('commits at once on blur, never the same value twice, and not a cleared value', () => {
    const onIntent = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ value }: { value: string | undefined }) => useCommitIntent({ value, onIntent }),
      { initialProps: { value: 'a' as string | undefined } },
    );
    act(() => result.current.onBlur());
    expect(onIntent).not.toHaveBeenCalled();

    rerender({ value: 'ab' });
    act(() => result.current.onBlur());
    expect(onIntent).toHaveBeenCalledTimes(1);

    rerender({ value: 'abc' });
    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIntent).toHaveBeenCalledTimes(1);

    rerender({ value: undefined });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIntent).toHaveBeenCalledTimes(1);

    rerender({ value: 'x' });
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  it('can be called with no options', () => {
    const { result } = renderHook(() => useCommitIntent());
    expect(typeof result.current.onBlur).toBe('function');
  });
});

describe('useDisclosureIntent', () => {
  it('reports real transitions with their reason', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useDisclosureIntent({ name: 'filters', onIntent }));
    result.current.onOpenChange(false);
    result.current.onOpenChange(true);
    result.current.onOpenChange(true);
    result.current.onOpenChange(false, { reason: 'escape-key' });
    expect(onIntent.mock.calls.map(([e]) => e)).toEqual([
      { kind: 'disclosure', name: 'filters', open: true, reason: 'none' },
      { kind: 'disclosure', name: 'filters', open: false, reason: 'escape-key' },
    ]);
  });

  it('honours initialOpen and no options', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useDisclosureIntent({ initialOpen: true, onIntent }));
    result.current.onOpenChange(true);
    expect(onIntent).not.toHaveBeenCalled();
    expect(renderHook(() => useDisclosureIntent()).result.current.onOpenChange).toBeTypeOf('function');
  });
});

describe('useFormIntent', () => {
  it('starts on the first change and submits once', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useFormIntent({ name: 'booking', onIntent }));
    act(() => result.current.markCancelled());
    act(() => result.current.onChange());
    act(() => result.current.onChange());
    act(() => result.current.markSubmitted());
    act(() => result.current.markSubmitted());
    act(() => result.current.markCancelled());
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(onIntent.mock.calls.map(([e]) => e)).toEqual([
      { kind: 'form', name: 'booking', phase: 'start' },
      { kind: 'form', name: 'booking', phase: 'submit' },
    ]);
  });

  it('reports a cancel after starting', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useFormIntent({ onIntent }));
    act(() => result.current.onChange());
    act(() => result.current.markCancelled());
    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'form',
      name: 'form',
      phase: 'abandon',
      reason: 'cancel',
    });
  });

  it('reports leaving the page after starting, once', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useFormIntent({ onIntent }));
    act(() => result.current.onChange());
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(onIntent.mock.calls.map(([e]) => e.phase)).toEqual(['start', 'abandon']);
    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'form',
      name: 'form',
      phase: 'abandon',
      reason: 'page_leave',
    });
  });

  it('sends no abandon when the page leaves in the same tick as a submit', () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useFormIntent({ onIntent }));
    act(() => result.current.onChange());
    act(() => {
      result.current.markSubmitted();
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(onIntent.mock.calls.map(([e]) => e.phase)).toEqual(['start', 'submit']);
  });

  it('submits without starting, and can be called with no options', () => {
    const { result } = renderHook(() => useFormIntent());
    expect(() => act(() => result.current.markSubmitted())).not.toThrow();
  });
});
