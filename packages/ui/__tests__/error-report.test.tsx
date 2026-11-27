/**
 * The default log as plain functions, the page handlers on a real window, and `useRecentErrors`.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  defaultErrorLog,
  installErrorLog,
  installGlobalHandlers,
  recentErrors,
  reportError,
  restoreRecent,
  setReporter,
  subscribeErrors,
} from '../src/lib/error-report.js';
import { useRecentErrors } from '../src/lib/use-recent-errors.js';
import { createErrorLog } from '../src/lib/error-report-model.js';

beforeEach(() => {
  defaultErrorLog.clear();
  setReporter(() => undefined);
});

afterEach(() => {
  cleanup();
  setReporter(null);
  defaultErrorLog.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the default log', () => {
  it('is one import at every call site', () => {
    const heard = vi.fn();
    setReporter(heard);
    const kept = reportError(new Error('boom'), 'checkout: save');
    expect(heard).toHaveBeenCalledWith(kept);
    expect(recentErrors()).toEqual([kept]);
    expect(reportError('again', 'w', true)?.fatal).toBe(true);
  });

  it('restores and notifies through the same functions', () => {
    const listener = vi.fn();
    const off = subscribeErrors(listener);
    restoreRecent([{ id: 'r1', at: 1, where: 'earlier', message: 'm', fatal: false }]);
    expect(recentErrors().map((r) => r.id)).toEqual(['r1']);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('keeps the default log on the device through installErrorLog', async () => {
    const saves: number[] = [];
    await installErrorLog({ load: () => null, save: (r) => void saves.push(r.length) });
    reportError('x', 'w');
    expect(saves).toEqual([1]);
    const other = createErrorLog();
    await installErrorLog({ load: () => null, save: (r) => void saves.push(100 + r.length) }, other);
    other.setReporter(() => undefined);
    other.report('y', 'w');
    expect(saves).toEqual([1, 101]);
  });
});

describe('installGlobalHandlers on the page', () => {
  it('reports a thrown error and an unhandled rejection from window', () => {
    const remove = installGlobalHandlers();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('from the page'), message: 'from the page' }));
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown };
    rejection.reason = new Error('rejected');
    window.dispatchEvent(rejection);
    expect(recentErrors().map((r) => [r.where, r.message])).toEqual([
      ['uncaught', 'from the page'],
      ['unhandled rejection', 'rejected'],
    ]);
    expect(installGlobalHandlers()).toBe(remove);
    remove();
    // nobody is listening for us any more; keep the test runner from treating this as its own error
    window.addEventListener('error', (e) => e.preventDefault(), { once: true });
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('after'), cancelable: true }));
    expect(recentErrors()).toHaveLength(2);
  });

  it('takes a target of its own and a log of its own', () => {
    const log = createErrorLog();
    log.setReporter(() => undefined);
    const target = new EventTarget();
    const remove = installGlobalHandlers(target, log);
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('mine') }));
    expect(log.recent()).toHaveLength(1);
    expect(recentErrors()).toHaveLength(0);
    remove();
  });

  it('does nothing on a server, where there is no window', () => {
    vi.stubGlobal('window', undefined);
    const remove = installGlobalHandlers();
    expect(remove()).toBeUndefined();
  });
});

describe('useRecentErrors', () => {
  function Probe({ log }: { log?: ReturnType<typeof createErrorLog> }) {
    const reports = useRecentErrors(log);
    return <p data-testid="out">{reports.map((r) => r.message).join('|') || 'none'}</p>;
  }

  it('re-renders when a report arrives, is restored, or the log is cleared', () => {
    render(<Probe />);
    expect(screen.getByTestId('out').textContent).toBe('none');
    act(() => void reportError('first', 'w'));
    expect(screen.getByTestId('out').textContent).toBe('first');
    act(() => restoreRecent([{ id: 'e', at: 1, where: 'w', message: 'earlier', fatal: false }]));
    expect(screen.getByTestId('out').textContent).toBe('earlier|first');
    act(() => defaultErrorLog.clear());
    expect(screen.getByTestId('out').textContent).toBe('none');
  });

  it('reads another log when given one', () => {
    const log = createErrorLog();
    log.setReporter(() => undefined);
    render(<Probe log={log} />);
    act(() => void log.report('mine', 'w'));
    expect(screen.getByTestId('out').textContent).toBe('mine');
  });

  it('is an empty list on the server, even when the log has reports', () => {
    reportError('x', 'w');
    expect(renderToString(<Probe />)).toContain('none');
  });
});
