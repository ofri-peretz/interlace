/**
 * The rules of error reporting: what a report holds, the flood rule, the ring, containment of a
 * bad reporter, restore from untrusted storage, the device log, the global handlers, the native
 * handler, and the words on a fallback. Each case names the break it was shown red against.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createErrorLog,
  defaultMakeId,
  developmentReporter,
  formatReports,
  installErrorLog,
  isDevelopment,
  parseReports,
  referenceOf,
  resolveFallbackLabels,
  attachGlobalHandlers,
  toReport,
  trimMessage,
  trimStack,
  wrapNativeHandler,
  type ErrorLog,
  type ErrorReport,
  type ErrorStore,
} from '../src/lib/error-report-model.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** A log with a clock we move by hand and ids that count. */
function fixture(options: Parameters<typeof createErrorLog>[0] = {}) {
  let time = 1_000_000;
  let n = 0;
  const reporter = vi.fn();
  const log = createErrorLog({ now: () => time, makeId: () => `id${++n}`, ...options });
  log.setReporter(reporter);
  return {
    log,
    reporter,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

const LIMITS = { maxMessage: 300, maxStackLines: 12 };
const META = { id: 'abcd', at: 5 };

describe('toReport', () => {
  it('reads an Error: its message and its stack', () => {
    const err = new Error('disk full');
    const r = toReport(err, 'save', false, META, LIMITS);
    expect(r).toMatchObject({ id: 'abcd', at: 5, where: 'save', message: 'disk full', fatal: false, count: 1 });
    expect(r.stack).toContain('disk full');
  });

  it('makes text of anything else, and never throws on it', () => {
    expect(toReport('plain', 'w', false, META, LIMITS).message).toBe('plain');
    expect(toReport(42, 'w', false, META, LIMITS).message).toBe('42');
    expect(toReport(null, 'w', false, META, LIMITS).message).toBe('null');
    expect(toReport({ a: 1 }, 'w', false, META, LIMITS).message).toBe('[object Object]');
    expect(toReport('x', 'w', false, META, LIMITS).stack).toBeUndefined();
  });

  it('reads a thrown object whose toString throws as unprintable', () => {
    const hostile = {
      toString() {
        throw new Error('no');
      },
    };
    expect(toReport(hostile, 'w', false, META, LIMITS).message).toBe('[unprintable error]');
    expect(toReport(Object.create(null), 'w', false, META, LIMITS).message).toBe('[unprintable error]');
  });

  it('keeps no stack for an Error that has none, or an empty one', () => {
    const none = new Error('x');
    delete none.stack;
    expect(toReport(none, 'w', false, META, LIMITS)).not.toHaveProperty('stack');
    const empty = new Error('x');
    empty.stack = '';
    expect(toReport(empty, 'w', false, META, LIMITS)).not.toHaveProperty('stack');
    const odd = new Error('x');
    (odd as { stack: unknown }).stack = 7;
    expect(toReport(odd, 'w', false, META, LIMITS)).not.toHaveProperty('stack');
  });

  it('trims a 10 000 character message to the limit with an ellipsis', () => {
    const r = toReport('a'.repeat(10_000), 'w', false, META, LIMITS);
    expect(r.message).toHaveLength(300);
    expect(r.message.endsWith('…')).toBe(true);
    expect(toReport('a'.repeat(300), 'w', false, META, LIMITS).message).toHaveLength(300);
    expect(toReport('a'.repeat(300), 'w', false, META, LIMITS).message.endsWith('…')).toBe(false);
  });

  it('keeps the first 12 lines of a 200-line stack', () => {
    const err = new Error('deep');
    err.stack = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    const lines = (toReport(err, 'w', false, META, LIMITS).stack ?? '').split('\n');
    expect(lines).toHaveLength(12);
    expect(lines[0]).toBe('line 0');
    expect(lines[11]).toBe('line 11');
  });

  it('redacts message and stack', () => {
    const err = new Error('token=abc123');
    err.stack = 'Error: token=abc123\n  at f';
    const r = toReport(err, 'w', false, META, { ...LIMITS, redact: (t) => t.replace(/token=\w+/g, 'token=[x]') });
    expect(r.message).toBe('token=[x]');
    expect(r.stack).toBe('Error: token=[x]\n  at f');
  });

  it('redacts before it cuts, so a secret split by the cut is still removed', () => {
    const text = `${'a'.repeat(294)}SECRET-12345`;
    const r = toReport(text, 'w', false, META, {
      ...LIMITS,
      redact: (t) => t.replace(/SECRET-\d+/g, '[x]'),
    });
    expect(r.message).not.toContain('SECR');
    expect(r.message.endsWith('[x]')).toBe(true);
  });

  it('still builds the report when redact throws, with the text replaced', () => {
    const err = new Error('x');
    const r = toReport(err, 'w', false, META, {
      ...LIMITS,
      redact: () => {
        throw new Error('bad hook');
      },
    });
    expect(r.message).toBe('[redaction failed]');
    expect(r.stack).toBe('[redaction failed]');
  });

  it('trimMessage and trimStack are exact at their edges', () => {
    expect(trimMessage('abc', 3)).toBe('abc');
    expect(trimMessage('abcd', 3)).toBe('ab…');
    expect(trimMessage('abcd', 0)).toBe('…');
    expect(trimStack('a\nb', 2)).toBe('a\nb');
    expect(trimStack('a\nb\nc', 2)).toBe('a\nb');
  });
});

describe('createErrorLog', () => {
  it('keeps what it was told, with the id and time from its injected parts', () => {
    const { log } = fixture();
    const kept = log.report(new Error('boom'), 'where', true);
    expect(kept).toMatchObject({ id: 'id1', at: 1_000_000, where: 'where', message: 'boom', fatal: true, count: 1 });
    expect(log.recent()).toEqual([kept]);
  });

  it('is not fatal unless it is told so', () => {
    const { log } = fixture();
    expect(log.report('x', 'w')?.fatal).toBe(false);
  });

  it('drops the oldest at the ring size', () => {
    const { log, advance } = fixture({ max: 3 });
    for (const m of ['a', 'b', 'c', 'd']) {
      log.report(m, 'w');
      advance(5000);
    }
    expect(log.recent().map((r) => r.message)).toEqual(['b', 'c', 'd']);
  });

  it('defaults to 25 reports', () => {
    const { log, advance } = fixture();
    for (let i = 0; i < 40; i++) {
      log.report(`m${i}`, 'w');
      advance(5000);
    }
    expect(log.recent()).toHaveLength(25);
    expect(log.recent()[0].message).toBe('m15');
  });

  it('turns a flood of the same place and message into one report with a count', () => {
    const { log, reporter, advance } = fixture();
    log.report('same', 'w');
    advance(400);
    log.report('same', 'w');
    advance(400);
    const third = log.report('same', 'w');
    expect(log.recent()).toHaveLength(1);
    expect(third).toMatchObject({ count: 3, at: 1_000_800 });
    // the reporter heard every occurrence, with the running count
    expect(reporter.mock.calls.map(([r]) => r.count)).toEqual([1, 2, 3]);
  });

  it('starts a new report outside the window, and at its edge keeps counting', () => {
    const { log, advance } = fixture();
    log.report('same', 'w');
    advance(1000);
    expect(log.report('same', 'w')?.count).toBe(2);
    advance(1001);
    expect(log.report('same', 'w')?.count).toBe(1);
    expect(log.recent()).toHaveLength(2);
  });

  it('does not coalesce a different place, or a different message', () => {
    const { log } = fixture();
    log.report('same', 'one');
    log.report('same', 'two');
    log.report('other', 'two');
    expect(log.recent()).toHaveLength(3);
  });

  it('only coalesces with the newest report', () => {
    const { log } = fixture();
    log.report('a', 'w');
    log.report('b', 'w');
    log.report('a', 'w');
    expect(log.recent().map((r) => r.count)).toEqual([1, 1, 1]);
  });

  it('keeps fatal once any of the repeats was fatal', () => {
    const { log } = fixture();
    log.report('same', 'w', true);
    expect(log.report('same', 'w', false)?.fatal).toBe(true);
    const other = fixture();
    other.log.report('same', 'w', false);
    expect(other.log.report('same', 'w', true)?.fatal).toBe(true);
  });

  it('uses its own coalesce window', () => {
    const { log, advance } = fixture({ coalesceMs: 10 });
    log.report('same', 'w');
    advance(11);
    log.report('same', 'w');
    expect(log.recent()).toHaveLength(2);
  });

  it('does not throw when the reporter throws, and still keeps the report', () => {
    const { log, reporter } = fixture();
    reporter.mockImplementation(() => {
      throw new Error('vendor is down');
    });
    expect(() => log.report('x', 'w')).not.toThrow();
    expect(log.recent()).toHaveLength(1);
    // and it is usable afterwards
    expect(log.report('y', 'w')?.message).toBe('y');
  });

  it('does not re-enter a reporter that reports from inside itself', () => {
    const { log, reporter } = fixture();
    let inner: unknown = 'unset';
    reporter.mockImplementation(() => {
      inner = log.report('from the reporter', 'inside');
    });
    log.report('outer', 'w');
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(inner).toBeUndefined();
    expect(log.recent().map((r) => r.message)).toEqual(['outer']);
    // the guard is released afterwards
    log.report('next', 'w');
    expect(reporter).toHaveBeenCalledTimes(2);
  });

  it('releases the guard after a reporter that throws', () => {
    const { log, reporter } = fixture();
    reporter.mockImplementationOnce(() => {
      throw new Error('once');
    });
    log.report('a', 'w');
    log.report('b', 'w');
    expect(reporter).toHaveBeenCalledTimes(2);
  });

  it('loses the report, not the app, when the clock or the id maker throws', () => {
    const badClock = createErrorLog({
      now: () => {
        throw new Error('clock');
      },
    });
    expect(badClock.report('x', 'w')).toBeUndefined();
    const badId = createErrorLog({
      makeId: () => {
        throw new Error('id');
      },
    });
    expect(badId.report('x', 'w')).toBeUndefined();
    expect(badId.recent()).toEqual([]);
  });

  it('setReporter(null) restores the development logger, which only warns outside production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { log } = fixture();
    log.setReporter(null);
    log.report('visible', 'where');
    expect(warn).toHaveBeenCalledWith('[where] visible');
  });

  it('starts with the development logger as its only reporter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = createErrorLog();
    log.report('first', 'w');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('subscribers hear a report, a restore and a clear, and not after they unsubscribe', () => {
    const { log } = fixture();
    const listener = vi.fn();
    const off = log.subscribe(listener);
    log.report('x', 'w');
    expect(listener).toHaveBeenCalledTimes(1);
    log.restore([]);
    expect(listener).toHaveBeenCalledTimes(2);
    log.clear();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(log.recent()).toEqual([]);
    off();
    log.report('y', 'w');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('a subscriber that throws does not stop the others or lose the report', () => {
    const { log } = fixture();
    const after = vi.fn();
    log.subscribe(() => {
      throw new Error('listener bug');
    });
    log.subscribe(after);
    expect(() => log.report('x', 'w')).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(log.recent()).toHaveLength(1);
  });

  it('a subscriber that unsubscribes itself while it is called does not skip the next one', () => {
    const { log } = fixture();
    const second = vi.fn();
    const off = log.subscribe(() => off());
    log.subscribe(second);
    log.report('x', 'w');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('returns the same array until something changes', () => {
    const { log } = fixture();
    expect(log.recent()).toBe(log.recent());
    const before = log.recent();
    log.report('x', 'w');
    expect(log.recent()).not.toBe(before);
    expect(before).toEqual([]);
  });

  it('applies redact to everything it keeps and reports', () => {
    const { log, reporter } = fixture({ redact: (t) => t.replace(/\d{4}/g, '####') });
    log.report(new Error('card 1234'), 'w');
    expect(log.recent()[0].message).toBe('card ####');
    expect(reporter.mock.calls[0][0].message).toBe('card ####');
  });

  it('makes ids that are not derived from the message, one per report', () => {
    const a = createErrorLog({ now: () => 1 });
    const b = createErrorLog({ now: () => 99_999_999 });
    a.setReporter(() => undefined);
    b.setReporter(() => undefined);
    a.report('same message', 'w');
    b.report('same message', 'w');
    const ids = [a.recent()[0].id, b.recent()[0].id];
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).not.toContain('same');
  });
});

describe('defaultMakeId', () => {
  it('is a base-36 string of at least four characters, and differs each call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => defaultMakeId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-z]{7,}$/);
  });
});

describe('isDevelopment and the development reporter', () => {
  const report = { id: 'i', at: 1, where: 'w', message: 'm', fatal: false, count: 1 } satisfies ErrorReport;

  it('follows NODE_ENV on the web', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDevelopment()).toBe(false);
    developmentReporter(report);
    expect(warn).not.toHaveBeenCalled();
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDevelopment()).toBe(true);
    developmentReporter(report);
    expect(warn).toHaveBeenCalledWith('[w] m');
  });

  it('follows __DEV__ on React Native, ahead of NODE_ENV', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('__DEV__', false);
    expect(isDevelopment()).toBe(false);
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDevelopment()).toBe(true);
  });

  it('is quiet when there is no process to ask, and development when NODE_ENV is unset', () => {
    vi.stubGlobal('process', undefined);
    expect(isDevelopment()).toBe(false);
    vi.stubGlobal('process', { env: {} });
    expect(isDevelopment()).toBe(true);
  });
});

describe('parseReports and restore', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'keep1',
    at: 10,
    where: 'w',
    message: 'm',
    fatal: false,
    count: 2,
    ...over,
  });
  const ids = () => {
    let n = 0;
    return () => `made${++n}`;
  };

  it('keeps valid rows whole', () => {
    expect(parseReports([row({ stack: 'a\nb' })], ids())).toEqual([row({ stack: 'a\nb' })]);
  });

  it('is empty for anything that is not an array', () => {
    for (const bad of [null, undefined, 'x', 3, {}, { length: 1 }]) expect(parseReports(bad, ids())).toEqual([]);
  });

  it('drops rows missing at, where, message or fatal, or with the wrong types', () => {
    const bad = [
      null,
      'row',
      7,
      row({ at: undefined }),
      row({ at: '10' }),
      row({ at: Number.NaN }),
      row({ at: Number.POSITIVE_INFINITY }),
      row({ where: undefined }),
      row({ where: 5 }),
      row({ message: undefined }),
      row({ message: 5 }),
      row({ fatal: undefined }),
      row({ fatal: 'false' }),
    ];
    expect(parseReports(bad, ids())).toEqual([]);
  });

  it('repairs a missing count and a missing id; ignores a bad stack', () => {
    const [a, b, c, d, e] = parseReports(
      [
        row({ count: undefined, id: undefined }),
        row({ count: 0 }),
        row({ count: 1.5 }),
        row({ count: '3', id: '' }),
        row({ stack: 9 }),
      ],
      ids(),
    );
    expect(a).toMatchObject({ count: 1, id: 'made1' });
    expect(b.count).toBe(1);
    expect(c.count).toBe(1);
    expect(d).toMatchObject({ count: 1, id: 'made2' });
    expect(e).not.toHaveProperty('stack');
    expect(parseReports([row({ stack: '' })], ids())[0]).not.toHaveProperty('stack');
  });

  it('trims what it takes from storage to the log limits', () => {
    const long = 'x'.repeat(500);
    const lines = Array.from({ length: 30 }, (_, i) => `l${i}`).join('\n');
    const [r] = parseReports([row({ message: long, stack: lines })], ids());
    expect(r.message).toHaveLength(300);
    expect(r.stack?.split('\n')).toHaveLength(12);
    const [s] = parseReports([row({ message: long, stack: lines })], ids(), { maxMessage: 10, maxStackLines: 2 });
    expect(s.message).toHaveLength(10);
    expect(s.stack?.split('\n')).toHaveLength(2);
  });

  it('puts restored rows in front of this session’s, and keeps the newest when over the limit', () => {
    const { log } = fixture({ max: 3 });
    log.report('now', 'w');
    log.restore([row({ id: 'a', message: 'old1' }), row({ id: 'b', message: 'old2' }), row({ id: 'c', message: 'old3' })]);
    expect(log.recent().map((r) => r.message)).toEqual(['old2', 'old3', 'now']);
  });

  it('skips rows it already holds, so restoring twice adds nothing', () => {
    const { log } = fixture();
    const rows = [row({ id: 'a' }), row({ id: 'b' })];
    log.restore(rows);
    log.restore(rows);
    expect(log.recent()).toHaveLength(2);
  });

  it('drops invalid rows when restoring', () => {
    const { log } = fixture();
    log.restore([row({ message: undefined }), row({ id: 'ok' })]);
    expect(log.recent().map((r) => r.id)).toEqual(['ok']);
  });
});

describe('installErrorLog', () => {
  const stored = (over: Partial<ErrorReport> = {}) => ({
    id: 'old',
    at: 1,
    where: 'earlier session',
    message: 'it closed the app',
    fatal: true,
    count: 1,
    ...over,
  });

  function memoryStore(initial: unknown = null) {
    const saves: ErrorReport[][] = [];
    const store: ErrorStore = {
      load: () => initial,
      save: (reports) => {
        saves.push([...reports]);
      },
    };
    return { store, saves };
  }

  it('restores the earlier session first, then saves after each report', async () => {
    const { log } = fixture();
    const { store, saves } = memoryStore([stored()]);
    await installErrorLog(store, log);
    expect(log.recent().map((r) => r.where)).toEqual(['earlier session']);
    log.report('new one', 'now');
    expect(saves).toHaveLength(1);
    expect(saves[0].map((r) => r.where)).toEqual(['earlier session', 'now']);
  });

  it('accepts a store whose load is async', async () => {
    const { log } = fixture();
    const saves: unknown[] = [];
    await installErrorLog(
      { load: async () => [stored()], save: async (r) => void saves.push(r.length) },
      log,
    );
    expect(log.recent()).toHaveLength(1);
    log.report('x', 'w');
    expect(saves).toEqual([2]);
  });

  it('starts empty when nothing was saved, or what was saved is not a list', async () => {
    for (const initial of [null, undefined, 'garbage', { not: 'a list' }]) {
      const { log } = fixture();
      await installErrorLog(memoryStore(initial).store, log);
      expect(log.recent()).toEqual([]);
    }
  });

  it('does not report an error when load rejects or throws', async () => {
    for (const load of [() => Promise.reject(new Error('read failed')), () => {
      throw new Error('read threw');
    }]) {
      const { log, reporter } = fixture();
      await expect(installErrorLog({ load, save: () => undefined }, log)).resolves.toBeUndefined();
      expect(reporter).not.toHaveBeenCalled();
      expect(log.recent()).toEqual([]);
    }
  });

  it('does not report an error when save rejects or throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const save of [
      () => Promise.reject(new Error('write failed')),
      () => {
        throw new Error('write threw');
      },
    ]) {
      const { log, reporter } = fixture();
      await installErrorLog({ load: () => null, save }, log);
      expect(() => log.report('real failure', 'w')).not.toThrow();
      await Promise.resolve();
      // the one report is the real failure; nothing about storing was reported
      expect(reporter).toHaveBeenCalledTimes(1);
      expect(log.recent().map((r) => r.message)).toEqual(['real failure']);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps saving when an app sets its own reporter afterwards', async () => {
    const { log, reporter } = fixture();
    const { store, saves } = memoryStore();
    await installErrorLog(store, log);
    log.report('x', 'w');
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(saves).toHaveLength(1);
  });

  it('two installs on one log save once per report, and the first one does not linger', async () => {
    const { log } = fixture();
    const a = memoryStore();
    const b = memoryStore();
    await installErrorLog(a.store, log);
    await installErrorLog(b.store, log);
    log.report('x', 'w');
    expect(a.saves).toHaveLength(0);
    expect(b.saves).toHaveLength(1);
  });

  it('an install that was overtaken while it loaded does nothing', async () => {
    const { log } = fixture();
    let release: (v: unknown) => void = () => undefined;
    const slow: ErrorStore = {
      load: () => new Promise((r) => (release = r)),
      save: vi.fn(),
    };
    const fast = memoryStore([stored({ id: 'fast' })]);
    const first = installErrorLog(slow, log);
    await installErrorLog(fast.store, log);
    release([stored({ id: 'slow' })]);
    await first;
    expect(log.recent().map((r) => r.id)).toEqual(['fast']);
    log.report('x', 'w');
    expect(slow.save).not.toHaveBeenCalled();
    expect(fast.saves).toHaveLength(1);
  });

  it('saves a clear, so the device log can be emptied', async () => {
    const { log } = fixture();
    const { store, saves } = memoryStore([stored()]);
    await installErrorLog(store, log);
    log.clear();
    expect(saves.at(-1)).toEqual([]);
  });
});

describe('formatReports', () => {
  const at = Date.UTC(2026, 10, 27, 10, 4);
  const base = { id: 'i', fatal: false, count: 1 };
  const opts = { locale: 'en-US', timeZone: 'UTC' };

  it('is empty for no reports', () => {
    expect(formatReports([])).toBe('');
  });

  it('writes one line per report, oldest first, with a count suffix only above one', () => {
    const text = formatReports(
      [
        { ...base, at, where: 'route: /play', message: 'Something broke', count: 3 },
        { ...base, at: at + 60_000, where: 'uncaught', message: 'Second' },
      ],
      opts,
    );
    expect(text.split('\n')).toEqual([
      'Nov 27, 2026, 10:04 AM  route: /play  Something broke (x3)',
      'Nov 27, 2026, 10:05 AM  uncaught  Second',
    ]);
  });

  it('writes the time in the asked locale', () => {
    const r = { ...base, at, where: 'w', message: 'm' };
    expect(formatReports([r], { locale: 'de-DE', timeZone: 'UTC' })).toContain('27.11.2026');
  });

  it('uses the device locale and zone when none are given', () => {
    const r = { ...base, at, where: 'w', message: 'm' };
    expect(formatReports([r])).toContain('2026');
  });

  it('never includes a stack, and keeps a message to one line', () => {
    const text = formatReports(
      [{ ...base, at, where: 'w', message: ' two\n  lines\there ', stack: 'Error: x\n    at secret.ts:1' }],
      opts,
    );
    expect(text).not.toContain('secret.ts');
    expect(text.split('\n')).toHaveLength(1);
    expect(text.endsWith('w  two lines here')).toBe(true);
  });
});

describe('attachGlobalHandlers', () => {
  function fakeTarget() {
    const listeners = new Map<string, Set<(e: never) => void>>();
    return {
      listeners,
      target: {
        addEventListener: vi.fn((type: string, l: (e: never) => void) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)?.add(l);
        }),
        removeEventListener: vi.fn((type: string, l: (e: never) => void) => {
          listeners.get(type)?.delete(l);
        }),
      },
      fire(type: string, event: object) {
        for (const l of listeners.get(type) ?? []) (l as (e: object) => void)(event);
      },
    };
  }

  it('reports an error event by its error, then by its message', () => {
    const { log } = fixture();
    const t = fakeTarget();
    attachGlobalHandlers(t.target as never, log);
    const err = new Error('thrown');
    t.fire('error', { error: err, message: 'ignored' });
    t.fire('error', { message: 'Script error.' });
    const [a, b] = log.recent();
    expect(a).toMatchObject({ where: 'uncaught', message: 'thrown', fatal: false });
    expect(b).toMatchObject({ where: 'uncaught', message: 'Script error.' });
  });

  it('reports an unhandled rejection with any reason', () => {
    const { log } = fixture();
    const t = fakeTarget();
    attachGlobalHandlers(t.target as never, log);
    t.fire('unhandledrejection', { reason: 'a string reason' });
    t.fire('unhandledrejection', { reason: new Error('an error reason') });
    expect(log.recent().map((r) => [r.where, r.message])).toEqual([
      ['unhandled rejection', 'a string reason'],
      ['unhandled rejection', 'an error reason'],
    ]);
  });

  it('does not call preventDefault, so the browser console still logs', () => {
    const { log } = fixture();
    const t = fakeTarget();
    attachGlobalHandlers(t.target as never, log);
    const preventDefault = vi.fn();
    t.fire('error', { error: new Error('x'), preventDefault });
    t.fire('unhandledrejection', { reason: 'x', preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('the remover removes both, and a second install on the same target adds nothing', () => {
    const { log } = fixture();
    const t = fakeTarget();
    const remove = attachGlobalHandlers(t.target as never, log);
    const again = attachGlobalHandlers(t.target as never, log);
    expect(again).toBe(remove);
    expect(t.target.addEventListener).toHaveBeenCalledTimes(2);
    t.fire('error', { error: new Error('once') });
    expect(log.recent()).toHaveLength(1);
    remove();
    expect(t.target.removeEventListener).toHaveBeenCalledTimes(2);
    t.fire('error', { error: new Error('gone') });
    t.fire('unhandledrejection', { reason: 'gone' });
    expect(log.recent()).toHaveLength(1);
    // removed, so it can be installed again
    attachGlobalHandlers(t.target as never, log);
    expect(t.target.addEventListener).toHaveBeenCalledTimes(4);
  });
});

describe('wrapNativeHandler', () => {
  function fakeUtils(previous?: (e: unknown, f?: boolean) => void) {
    let current = previous;
    return {
      getGlobalHandler: () => current,
      setGlobalHandler: vi.fn((h: (e: unknown, f?: boolean) => void) => {
        current = h;
      }),
      call: (e: unknown, f?: boolean) => current?.(e, f),
    };
  }

  it('reports the error, then calls the previous handler with the same arguments', () => {
    const { log } = fixture();
    const order: string[] = [];
    const previous = vi.fn(() => void order.push('previous'));
    log.subscribe(() => order.push('report'));
    const utils = fakeUtils(previous);
    wrapNativeHandler(utils, log);
    const err = new Error('native crash');
    utils.call(err, true);
    expect(previous).toHaveBeenCalledWith(err, true);
    expect(order).toEqual(['report', 'previous']);
    expect(log.recent()[0]).toMatchObject({ where: 'uncaught', message: 'native crash', fatal: true });
  });

  it('is not fatal when the platform says nothing', () => {
    const { log } = fixture();
    const utils = fakeUtils(vi.fn());
    wrapNativeHandler(utils, log);
    utils.call(new Error('x'));
    expect(log.recent()[0].fatal).toBe(false);
  });

  it('works when there was no previous handler, or no way to read one', () => {
    const { log } = fixture();
    const utils = fakeUtils(undefined);
    wrapNativeHandler(utils, log);
    expect(() => utils.call(new Error('x'))).not.toThrow();
    let set: ((e: unknown) => void) | undefined;
    wrapNativeHandler({ setGlobalHandler: (h) => (set = h) }, log);
    expect(() => set?.(new Error('y'))).not.toThrow();
    expect(log.recent()).toHaveLength(2);
  });

  it('does nothing without ErrorUtils', () => {
    const { log } = fixture();
    expect(() => wrapNativeHandler(undefined, log)).not.toThrow();
    expect(() => wrapNativeHandler(null, log)).not.toThrow();
  });

  it('a second call adds nothing', () => {
    const { log } = fixture();
    const previous = vi.fn();
    const utils = fakeUtils(previous);
    wrapNativeHandler(utils, log);
    wrapNativeHandler(utils, log);
    expect(utils.setGlobalHandler).toHaveBeenCalledTimes(1);
    utils.call(new Error('x'));
    expect(previous).toHaveBeenCalledTimes(1);
    expect(log.recent()).toHaveLength(1);
  });
});

describe('the words on a fallback', () => {
  it('names only the actions the screen offers', () => {
    const d = (canRetry: boolean, canBack: boolean) => resolveFallbackLabels(undefined, { canRetry, canBack }).description;
    expect(d(true, true)).toBe('Try again, or go back.');
    expect(d(true, false)).toBe('Try again in a moment.');
    expect(d(false, true)).toBe('Go back and try something else.');
    expect(d(false, false)).toBe('Please come back in a moment.');
    expect(d(false, false).toLowerCase()).not.toContain('try again');
    expect(d(false, true).toLowerCase()).not.toContain('try again');
  });

  it('has plain defaults for every other string', () => {
    const l = resolveFallbackLabels(undefined, { canRetry: true, canBack: true });
    expect(l).toMatchObject({ title: 'Something went wrong here', retry: 'Try again', back: 'Go back' });
    expect(l.referenceLine('ab12')).toBe('Reference: ab12');
  });

  it('takes the app’s words as given, and ignores a label left undefined', () => {
    const l = resolveFallbackLabels(
      { title: 'Oops', description: 'Custom.', retry: undefined },
      { canRetry: false, canBack: false },
    );
    expect(l).toMatchObject({ title: 'Oops', description: 'Custom.', retry: 'Try again' });
  });

  it('shows the first four characters of an id as the reference', () => {
    expect(referenceOf('ab12cd34')).toBe('ab12');
    expect(referenceOf('ab')).toBe('ab');
  });
});

export type { ErrorLog };
