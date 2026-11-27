/**
 * @interlace/ui: the rules of error reporting, as pure functions.
 *
 * What a report holds, how a flood of the same failure becomes one row with a count, how rows are
 * kept, trimmed, redacted, restored from storage and written as text, and the two functions that
 * make "nothing fails silently" true (`installGlobalHandlers` for the browser,
 * `wrapNativeHandler` for React Native). No DOM, no React, no storage library, no network: the
 * clock, the id maker, the storage and the event target are all passed in. `@interlace/native`
 * imports this file, it does not copy it.
 *
 * ## What a report holds, and what it never holds
 *
 * | Holds                                                      | Never holds                        |
 * | ---------------------------------------------------------- | ---------------------------------- |
 * | `where`: a place the developer named ('checkout: save')   | props, state, storage contents     |
 * | `message` and `stack`, redacted, then trimmed to a limit   | the URL's query string or hash     |
 * | a time, a count, a random id, whether it was fatal         | a name, an email, a device id      |
 *
 * Nothing here sends anything. The default reporter writes one development line to the console
 * and does nothing in production; a crash service is one `setReporter` call.
 */

/** One caught failure, as the log keeps it and a reporter receives it. */
export interface ErrorReport {
  /** A stable id for this report, from `makeId`; never derived from the message. */
  id: string;
  /** Epoch ms from the injected clock. */
  at: number;
  /** What the person was doing, chosen by the caller: 'checkout: save', 'uncaught', 'route: /play'. */
  where: string;
  /** Redacted, then trimmed to `maxMessage` characters. */
  message: string;
  /** Redacted, then trimmed to `maxStackLines` lines. Absent when the thrown value had no stack. */
  stack?: string;
  fatal: boolean;
  /** 1 for a single report; more when the same `where` and `message` repeated within `coalesceMs`. */
  count: number;
}

export type Reporter = (report: ErrorReport) => void;

export interface ErrorLogOptions {
  /** How many reports the log keeps. @default 25 */
  max?: number;
  /** Characters kept of a message. @default 300 */
  maxMessage?: number;
  /** Lines kept of a stack. @default 12 */
  maxStackLines?: number;
  /** Repeats of one `where` and `message` inside this window are one report with a count. @default 1000 */
  coalesceMs?: number;
  now?: () => number;
  makeId?: () => string;
  /** Applied to message and stack before anything is kept or reported. The app's redaction hook. */
  redact?: (text: string) => string;
}

export interface ErrorLog {
  /** Builds a report, keeps it, tells the reporter. Never throws. Returns the kept report, or
   * `undefined` when it was dropped (a reporter that reported from inside itself). */
  report(error: unknown, where: string, fatal?: boolean): ErrorReport | undefined;
  /** Oldest first. The same array until something changes, so it can feed `useSyncExternalStore`. */
  recent(): readonly ErrorReport[];
  /** Validated; rows already in the log (by id) are skipped; kept ones go in front. */
  restore(earlier: readonly unknown[]): void;
  /** `null` restores the development logger. */
  setReporter(next: Reporter | null): void;
  subscribe(listener: () => void): () => void;
  clear(): void;
}

export const DEFAULT_MAX = 25;
export const DEFAULT_MAX_MESSAGE = 300;
export const DEFAULT_MAX_STACK_LINES = 12;
export const DEFAULT_COALESCE_MS = 1000;
export const UNPRINTABLE = '[unprintable error]';
export const REDACTION_FAILED = '[redaction failed]';
export const ELLIPSIS = '…';

declare const __DEV__: boolean | undefined;
// Bundlers replace `process.env.NODE_ENV` at build time; this only types it, with no @types/node.
declare const process: { env: { NODE_ENV?: string } } | undefined;

/** React Native sets `__DEV__`; on the web a bundler sets `process.env.NODE_ENV`. */
export function isDevelopment(): boolean {
  if (typeof __DEV__ !== 'undefined') return Boolean(__DEV__);
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

/** The only default reporter: one console line in development, nothing in production. */
export const developmentReporter: Reporter = (report) => {
  if (isDevelopment()) console.warn(`[${report.where}] ${report.message}`);
};

let idCounter = 0;
/** A short random id. Never derived from the message. */
export function defaultMakeId(): string {
  idCounter += 1;
  return Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')
    .concat(idCounter.toString(36));
}

/** Keep at most `max` characters, the last one an ellipsis when something was cut. */
export function trimMessage(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - ELLIPSIS.length)) + ELLIPSIS;
}

/** Keep the first `maxLines` lines. */
export function trimStack(text: string, maxLines: number): string {
  return text.split('\n').slice(0, maxLines).join('\n');
}

function printable(value: unknown): string {
  try {
    return String(value);
  } catch {
    return UNPRINTABLE;
  }
}

function applyRedact(text: string, redact: ((text: string) => string) | undefined): string {
  if (!redact) return text;
  try {
    return String(redact(text));
  } catch {
    return REDACTION_FAILED;
  }
}

type Limits = Required<Pick<ErrorLogOptions, 'maxMessage' | 'maxStackLines'>> &
  Pick<ErrorLogOptions, 'redact'>;

/** What was thrown, as a message and an optional stack. Anything at all can be thrown. */
export function toReport(
  error: unknown,
  where: string,
  fatal: boolean,
  meta: { id: string; at: number },
  limits: Limits,
): ErrorReport {
  const isError = error instanceof Error;
  const rawMessage = isError ? printable(error.message) : printable(error);
  // Redact the whole text first, then cut: a secret split by the cut would escape the pattern.
  const message = trimMessage(applyRedact(rawMessage, limits.redact), limits.maxMessage);
  const report: ErrorReport = { id: meta.id, at: meta.at, where, message, fatal, count: 1 };
  if (isError && typeof error.stack === 'string' && error.stack !== '') {
    report.stack = trimStack(applyRedact(error.stack, limits.redact), limits.maxStackLines);
  }
  return report;
}

/**
 * Rows from storage are untrusted. A row needs a finite numeric `at`, a string `where` and
 * `message`, and a boolean `fatal`; the rest is repaired (`count` 1, a fresh id) or dropped.
 */
export function parseReports(
  rows: unknown,
  makeId: () => string,
  limits: Pick<ErrorLogOptions, 'maxMessage' | 'maxStackLines'> = {},
): ErrorReport[] {
  if (!Array.isArray(rows)) return [];
  const maxMessage = limits.maxMessage ?? DEFAULT_MAX_MESSAGE;
  const maxStackLines = limits.maxStackLines ?? DEFAULT_MAX_STACK_LINES;
  const kept: ErrorReport[] = [];
  for (const row of rows as unknown[]) {
    // A row that is not an object has no `at`, `where` or `message` of its own and is dropped below.
    const r = (row ?? {}) as Record<string, unknown>;
    if (!Number.isFinite(r.at)) continue;
    if (typeof r.where !== 'string' || typeof r.message !== 'string') continue;
    if (typeof r.fatal !== 'boolean') continue;
    const report: ErrorReport = {
      id: typeof r.id === 'string' && r.id !== '' ? r.id : makeId(),
      at: r.at as number,
      where: r.where,
      message: trimMessage(r.message, maxMessage),
      fatal: r.fatal,
      count: Number.isInteger(r.count) ? Math.max(1, r.count as number) : 1,
    };
    if (typeof r.stack === 'string' && r.stack !== '') {
      report.stack = trimStack(r.stack, maxStackLines);
    }
    kept.push(report);
  }
  return kept;
}

/** The log, with its own state. The module-level functions in `error-report.ts` wrap one of these. */
export function createErrorLog(options: ErrorLogOptions = {}): ErrorLog {
  const max = options.max ?? DEFAULT_MAX;
  const coalesceMs = options.coalesceMs ?? DEFAULT_COALESCE_MS;
  const now = options.now ?? Date.now;
  const makeId = options.makeId ?? defaultMakeId;
  const limits: Limits = {
    maxMessage: options.maxMessage ?? DEFAULT_MAX_MESSAGE,
    maxStackLines: options.maxStackLines ?? DEFAULT_MAX_STACK_LINES,
    redact: options.redact,
  };

  let reports: readonly ErrorReport[] = [];
  let reporter: Reporter = developmentReporter;
  let reporting = false;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // A listener's bug is not a reason to lose the report that woke it.
      }
    }
  };

  return {
    report(error, where, fatal = false) {
      // A reporter that reports from inside itself is dropped: a reporter bug cannot loop.
      if (reporting) return undefined;
      try {
        const at = now();
        const built = toReport(error, where, fatal, { id: makeId(), at }, limits);
        const newest = reports[reports.length - 1];
        let kept: ErrorReport;
        if (
          newest !== undefined &&
          newest.where === built.where &&
          newest.message === built.message &&
          at - newest.at <= coalesceMs
        ) {
          kept = { ...newest, at, count: newest.count + 1, fatal: newest.fatal || built.fatal };
          reports = [...reports.slice(0, -1), kept];
        } else {
          kept = built;
          reports = [...reports, built].slice(-max);
        }
        reporting = true;
        try {
          reporter(kept);
        } catch {
          // Reporting must never become the next crash.
        } finally {
          reporting = false;
        }
        notify();
        return kept;
      } catch {
        // A clock or an id maker that throws: the report is lost, the app is not.
      }
      return undefined;
    },
    recent: () => reports,
    restore(earlier) {
      const known = new Set(reports.map((r) => r.id));
      const fresh = parseReports(earlier, makeId, limits).filter((r) => !known.has(r.id));
      reports = [...fresh, ...reports].slice(-max);
      notify();
    },
    setReporter(next) {
      reporter = next ?? developmentReporter;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      reports = [];
      notify();
    },
  };
}

/** Reports kept on the device. `load` returns what was saved; anything it returns is untrusted. */
export interface ErrorStore {
  load(): unknown | null | Promise<unknown | null>;
  save(reports: readonly ErrorReport[]): void | Promise<void>;
}

const persistence = new WeakMap<ErrorLog, { off?: () => void }>();

/**
 * Keep the log on the device. Loads what an earlier session saved, restores it (so a diagnostics
 * screen reads earlier sessions first), then saves after every change. A `load` or `save` that
 * throws or rejects is swallowed: failing to store an error must not report an error.
 *
 * It listens to the log; it does not take the reporter, so a crash service's `setReporter` and
 * the device log work together. Installing again on the same log replaces the first install.
 */
export async function installErrorLog(store: ErrorStore, log: ErrorLog): Promise<void> {
  persistence.get(log)?.off?.();
  const entry: { off?: () => void } = {};
  persistence.set(log, entry);
  let earlier: unknown = null;
  try {
    earlier = await store.load();
  } catch {
    // Nothing was kept, or it could not be read: start empty.
  }
  if (persistence.get(log) !== entry) return; // a newer install took over while this one waited
  log.restore(earlier as readonly unknown[]); // untrusted: anything that is not a list restores nothing
  entry.off = log.subscribe(() => {
    try {
      Promise.resolve(store.save(log.recent())).catch(() => undefined);
    } catch {
      // Failing to store an error is not an error to report.
    }
  });
}

export interface ErrorFormatOptions {
  /** A BCP 47 tag for the time. Defaults to the device's. */
  locale?: string;
  /** An IANA zone for the time. Defaults to the device's. */
  timeZone?: string;
}

/**
 * Plain text, one line per report, oldest first: `Nov 27, 2026, 10:04 AM  route: /play  Something
 * broke (x3)`. It never includes a stack: a person shares this text.
 */
export function formatReports(
  reports: readonly ErrorReport[],
  options: ErrorFormatOptions = {},
): string {
  const time = new Intl.DateTimeFormat(options.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: options.timeZone,
  });
  return reports
    .map((r) => {
      const message = r.message.replace(/\s+/g, ' ').trim();
      const count = r.count > 1 ? ` (x${r.count})` : '';
      return `${time.format(r.at)}  ${r.where}  ${message}${count}`;
    })
    .join('\n');
}

/** The slice of an event target the browser handlers need (a `Window`, or a test's fake). */
export type GlobalEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

interface ErrorEventLike {
  error?: unknown;
  message?: unknown;
}
interface RejectionEventLike {
  reason?: unknown;
}

const installed = new WeakMap<object, () => void>();

/**
 * Report `error` and `unhandledrejection` on `target`. Idempotent per target; returns the remover.
 * It never calls `preventDefault`, so the browser console still logs.
 */
export function attachGlobalHandlers(target: GlobalEventTarget, log: ErrorLog): () => void {
  const existing = installed.get(target);
  if (existing) return existing;
  const onError = (event: ErrorEventLike) => {
    log.report(event.error ?? event.message, 'uncaught', false);
  };
  const onRejection = (event: RejectionEventLike) => {
    log.report(event.reason, 'unhandled rejection', false);
  };
  target.addEventListener('error', onError as EventListener);
  target.addEventListener('unhandledrejection', onRejection as EventListener);
  const remove = () => {
    target.removeEventListener('error', onError as EventListener);
    target.removeEventListener('unhandledrejection', onRejection as EventListener);
    installed.delete(target);
  };
  installed.set(target, remove);
  return remove;
}

type NativeHandler = (error: unknown, isFatal?: boolean) => void;

/** React Native's `ErrorUtils`, as far as this needs it. */
export interface ErrorUtilsLike {
  getGlobalHandler?: () => NativeHandler | undefined;
  setGlobalHandler: (handler: NativeHandler) => void;
}

const wrapped = new WeakSet<object>();

/**
 * Route uncaught JS errors through `log`, then to the platform's own handler with the same
 * arguments, so the red screen in development and the crash in production still happen.
 * Idempotent. Without `utils` it does nothing.
 */
export function wrapNativeHandler(utils: ErrorUtilsLike | null | undefined, log: ErrorLog): void {
  if (!utils || wrapped.has(utils)) return;
  wrapped.add(utils);
  const previous = utils.getGlobalHandler?.();
  utils.setGlobalHandler((error, isFatal) => {
    log.report(error, 'uncaught', Boolean(isFatal));
    previous?.(error, isFatal);
  });
}

/* ───────────────────────── ErrorFallback copy, shared by web and native ───────────────────── */

export interface ErrorFallbackLabels {
  title: string;
  description: string;
  retry: string;
  back: string;
  /** Receives the four-character reference, not the whole id. */
  referenceLine: (reference: string) => string;
}

/** Said when the screen has no way to retry and none to leave: no instruction it cannot honour. */
const DESCRIPTIONS = {
  both: 'Try again, or go back.',
  retry: 'Try again in a moment.',
  back: 'Go back and try something else.',
  neither: 'Please come back in a moment.',
} as const;

export const DEFAULT_ERROR_FALLBACK_LABELS: ErrorFallbackLabels = {
  title: 'Something went wrong here',
  description: DESCRIPTIONS.both, // `resolveFallbackLabels` picks the one that fits the actions
  retry: 'Try again',
  back: 'Go back',
  referenceLine: (reference) => `Reference: ${reference}`,
};

/**
 * The words on a fallback. A `description` the app wrote is used as given; otherwise the default
 * names only the actions the screen actually offers.
 */
export function resolveFallbackLabels(
  labels: Partial<ErrorFallbackLabels> | undefined,
  actions: { canRetry: boolean; canBack: boolean },
): ErrorFallbackLabels {
  const key = actions.canRetry
    ? actions.canBack
      ? 'both'
      : 'retry'
    : actions.canBack
      ? 'back'
      : 'neither';
  const given = Object.fromEntries(
    Object.entries(labels ?? {}).filter(([, value]) => value !== undefined),
  );
  return { ...DEFAULT_ERROR_FALLBACK_LABELS, description: DESCRIPTIONS[key], ...given };
}

/** The short reference a person can quote: the first four characters of the id. */
export function referenceOf(id: string): string {
  return id.slice(0, 4);
}
