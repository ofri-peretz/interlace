/**
 * useAccount: the app's own sign-in service, as the state AccountMenu shows. A fake adapter
 * stands in for the service; the hook never reads a session itself.
 */
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '../src/patterns/account-menu-model.js';
import { useAccount, type AccountAdapter } from '../src/patterns/use-account.js';

afterEach(cleanup);

const dana: Account = { id: 'a1', firstName: 'Dana', email: 'dana@example.com' };
const noah: Account = { id: 'a2', firstName: 'Noah' };

/** An adapter whose subscribers and read promise the test controls. */
function fake(read: AccountAdapter['read']) {
  const listeners = new Set<(account: Account | null) => void>();
  const adapter: AccountAdapter = {
    read,
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  return { adapter, listeners, emit: (account: Account | null) => listeners.forEach((l) => l(account)) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAccount', () => {
  it('is unknown on the first render, then signed-in after a synchronous read', async () => {
    const { adapter } = fake(() => dana);
    const seen: string[] = [];
    function Probe() {
      seen.push(useAccount(adapter).status);
      return null;
    }
    render(<Probe />);
    await act(async () => {});
    expect(seen[0]).toBe('unknown');
    expect(seen.at(-1)).toBe('signed-in');
  });

  it('resolves a promise read to signed-in or signed-out', async () => {
    const signedIn = fake(async () => dana).adapter;
    const a = renderHook(() => useAccount(signedIn));
    await act(async () => {});
    expect(a.result.current).toEqual({ status: 'signed-in', account: dana });

    const signedOut = fake(async () => null).adapter;
    const b = renderHook(() => useAccount(signedOut));
    await act(async () => {});
    expect(b.result.current).toEqual({ status: 'signed-out' });
  });

  it('is signed-out when read rejects or throws', async () => {
    const rejecting = fake(() => Promise.reject(new Error('offline')));
    const a = renderHook(() => useAccount(rejecting.adapter));
    await act(async () => {});
    expect(a.result.current).toEqual({ status: 'signed-out' });

    const throwing = fake(() => {
      throw new Error('boom');
    });
    const b = renderHook(() => useAccount(throwing.adapter));
    await act(async () => {});
    expect(b.result.current).toEqual({ status: 'signed-out' });
  });

  it('follows changes from subscribe', async () => {
    const { adapter, emit } = fake(() => null);
    const { result } = renderHook(() => useAccount(adapter));
    await act(async () => {});
    expect(result.current.status).toBe('signed-out');
    act(() => emit(dana));
    expect(result.current).toEqual({ status: 'signed-in', account: dana });
    act(() => emit({ ...dana, firstName: 'Dana L.' }));
    expect(result.current).toEqual({ status: 'signed-in', account: { ...dana, firstName: 'Dana L.' } });
    act(() => emit(null));
    expect(result.current.status).toBe('signed-out');
  });

  it('a read that settles after a change does not overwrite it', async () => {
    const slow = deferred<Account | null>();
    const { adapter, emit } = fake(() => slow.promise);
    const { result } = renderHook(() => useAccount(adapter));
    act(() => emit(noah));
    await act(async () => slow.resolve(null));
    expect(result.current).toEqual({ status: 'signed-in', account: noah });
  });

  it('works for an adapter with no subscribe', async () => {
    const adapter: AccountAdapter = { read: () => dana };
    const { result } = renderHook(() => useAccount(adapter));
    await act(async () => {});
    expect(result.current.status).toBe('signed-in');
  });

  it('unsubscribes on unmount, and ignores a read that settles after it', async () => {
    const slow = deferred<Account | null>();
    const { adapter, listeners } = fake(() => slow.promise);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useAccount(adapter));
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
    await act(async () => slow.resolve(dana));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('ignores answers from an adapter that does not honour its unsubscribe, or that settles late', async () => {
    let push!: (account: Account | null) => void;
    const slow = deferred<Account | null>();
    const stubborn: AccountAdapter = {
      read: () => slow.promise,
      subscribe: (onChange) => {
        push = onChange;
        return () => {};
      },
    };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useAccount(stubborn));
    unmount();
    await act(async () => {
      push(dana);
      slow.reject(new Error('late'));
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('resubscribes, and starts from unknown, when the adapter changes', async () => {
    const first = fake(() => dana);
    const second = fake(() => null);
    const { result, rerender } = renderHook(({ adapter }) => useAccount(adapter), {
      initialProps: { adapter: first.adapter as AccountAdapter | null },
    });
    await act(async () => {});
    expect(result.current.status).toBe('signed-in');
    rerender({ adapter: second.adapter });
    expect(first.listeners.size).toBe(0);
    expect(second.listeners.size).toBe(1);
    await act(async () => {});
    expect(result.current.status).toBe('signed-out');
  });

  it('stays unknown with no adapter, and goes back to unknown when it is removed', async () => {
    const none = renderHook(() => useAccount(null));
    await act(async () => {});
    expect(none.result.current).toEqual({ status: 'unknown' });

    const { adapter } = fake(() => dana);
    const { result, rerender } = renderHook(({ a }) => useAccount(a), {
      initialProps: { a: adapter as AccountAdapter | null },
    });
    await act(async () => {});
    expect(result.current.status).toBe('signed-in');
    rerender({ a: null });
    expect(result.current.status).toBe('unknown');
  });

  it('touches no window or document while it renders: the server markup is the first client render', async () => {
    const { adapter } = fake(() => dana);
    function Probe() {
      return <span data-status={useAccount(adapter).status} />;
    }
    const html = renderToString(<Probe />);
    expect(html).toContain('data-status="unknown"');
    const { container } = render(<Probe />);
    expect(container.innerHTML).toBe(html);
    await act(async () => {});
  });
});
