/**
 * installNativeErrorHandler: uncaught JS errors reach `reportError`, then the platform's own
 * handler with the same arguments, so a production crash still crashes. The rules themselves are
 * tested in @interlace/ui (error-report-model); this proves the native wiring uses them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultErrorLog, setReporter } from '@interlace/ui/error-report';
import { installNativeErrorHandler } from '../src/error-handler';

afterEach(() => {
  vi.unstubAllGlobals();
  setReporter(null);
  defaultErrorLog.clear();
});

type Handler = (error: unknown, isFatal?: boolean) => void;

function fakeUtils(previous: Handler | undefined) {
  let current = previous;
  return {
    getGlobalHandler: () => current,
    setGlobalHandler: vi.fn((h: Handler) => {
      current = h;
    }),
    crash: (error: unknown, isFatal?: boolean) => current?.(error, isFatal),
  };
}

describe('installNativeErrorHandler', () => {
  it('reports an uncaught error to the default reporter, then to the handler that was there', () => {
    const heard = vi.fn();
    setReporter(heard);
    const previous = vi.fn();
    const utils = fakeUtils(previous);
    installNativeErrorHandler(utils);
    const error = new Error('uncaught on a phone');
    utils.crash(error, true);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0][0]).toMatchObject({ where: 'uncaught', message: 'uncaught on a phone', fatal: true });
    expect(previous).toHaveBeenCalledWith(error, true);
  });

  it('a second install adds nothing', () => {
    const utils = fakeUtils(vi.fn());
    installNativeErrorHandler(utils);
    installNativeErrorHandler(utils);
    expect(utils.setGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it('finds ErrorUtils on the global object when none is passed', () => {
    const utils = fakeUtils(vi.fn());
    vi.stubGlobal('ErrorUtils', utils);
    installNativeErrorHandler();
    expect(utils.setGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it('does nothing where there is no ErrorUtils', () => {
    vi.stubGlobal('ErrorUtils', undefined);
    expect(() => installNativeErrorHandler()).not.toThrow();
  });
});
