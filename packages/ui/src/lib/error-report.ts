/**
 * @interlace/ui: `reportError`, the one function every caught failure goes through.
 *
 *   import { reportError } from '@interlace/ui/error-report';
 *
 *   try { await save(draft); } catch (error) { reportError(error, 'checkout: save'); }
 *
 * It builds a typed report, keeps the last few in memory, and hands each to a reporter. The
 * default reporter is a development console line and nothing else: no report leaves the device
 * unless the app calls `setReporter` with a function of its own. Nothing here calls `fetch`.
 *
 *   setReporter((report) => crashService.capture(report));   // the whole vendor seam
 *   void installErrorLog(store);                              // keep the last reports on the device
 *   installGlobalHandlers();                                  // browser: error + unhandledrejection
 *
 * This file is the default log as plain functions; `createErrorLog()` (in `error-report-model`)
 * makes another for a test or for an app that wants two. See `ErrorFallback` for the screen.
 */

import {
  attachGlobalHandlers,
  createErrorLog,
  installErrorLog as installOn,
  type ErrorLog,
  type ErrorStore,
} from './error-report-model.js';

export * from './error-report-model.js';

/** The module's own log: one import at every call site. */
export const defaultErrorLog: ErrorLog = createErrorLog();

export const reportError: ErrorLog['report'] = (error, where, fatal) =>
  defaultErrorLog.report(error, where, fatal);
export const recentErrors: ErrorLog['recent'] = () => defaultErrorLog.recent();
export const setReporter: ErrorLog['setReporter'] = (next) => defaultErrorLog.setReporter(next);
export const restoreRecent: ErrorLog['restore'] = (earlier) => defaultErrorLog.restore(earlier);
export const subscribeErrors: ErrorLog['subscribe'] = (listener) =>
  defaultErrorLog.subscribe(listener);

/** Keep the default log (or `log`) on the device, in the app's own storage. */
export function installErrorLog(store: ErrorStore, log: ErrorLog = defaultErrorLog): Promise<void> {
  return installOn(store, log);
}

/**
 * Report `error` and `unhandledrejection` on the page (or on `target`). Idempotent; returns the
 * remover. It does not call `preventDefault`, so the browser console still logs. On a server,
 * where there is no `window`, it does nothing.
 */
export function installGlobalHandlers(
  target?: Parameters<typeof attachGlobalHandlers>[0],
  log: ErrorLog = defaultErrorLog,
): () => void {
  const where = target ?? (typeof window === 'undefined' ? undefined : window);
  return where ? attachGlobalHandlers(where, log) : () => undefined;
}
