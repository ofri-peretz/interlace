'use client';

/**
 * @interlace/ui: `useRecentErrors`, the reports kept so far, for a diagnostics screen.
 *
 *   const reports = useRecentErrors();
 *   <pre>{formatReports(reports)}</pre>
 *
 * It re-renders when a report arrives, is restored from the device, or the log is cleared. On the
 * server it is an empty list, so the markup matches the first client render.
 */

import * as React from 'react';

import { defaultErrorLog } from './error-report.js';
import type { ErrorLog, ErrorReport } from './error-report-model.js';

const NONE: readonly ErrorReport[] = [];

export function useRecentErrors(log: ErrorLog = defaultErrorLog): readonly ErrorReport[] {
  return React.useSyncExternalStore(log.subscribe, log.recent, () => NONE);
}
