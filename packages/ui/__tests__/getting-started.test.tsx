/**
 * GettingStarted: the list, what a locked step says, what is celebrated and said (once, never on a
 * reload or a merge), persistence that never loses progress silently, and motion that has a still
 * form. Time is injected; storage is in memory.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({ useReducedMotion: () => reduced.value }));

const { GettingStarted, GettingStartedCelebration, GettingStartedGroup, GettingStartedHeader, GettingStartedStep, MIN_VIEWPORT } =
  await import('../src/games/getting-started.js');
const model = await import('../src/games/getting-started-model.js');
const { memoryStore } = await import('../src/games/getting-started-store.js');
import type { ChecklistDef, ChecklistSnapshot } from '../src/games/getting-started-model.js';
import type { ChecklistStore } from '../src/games/getting-started-store.js';

const { complete, emptySnapshot, markCelebrated, celebrationsFor } = model;
const UTC = 'UTC';
const T0 = Date.UTC(2026, 10, 20, 12);
const DAY = 86_400_000;

const def: ChecklistDef = {
  groups: [
    { id: 'plan', title: 'Plan' },
    { id: 'prepare', title: 'Prepare' },
  ],
  steps: [
    { id: 'date', title: 'Pick a date', group: 'plan', description: 'When it happens.' },
    { id: 'agenda', title: 'Write the agenda', group: 'plan', after: ['date'] },
    { id: 'invite', title: 'Invite people', group: 'prepare', after: ['date'] },
    { id: 'test', title: 'Test the room', group: 'prepare', after: ['agenda'] },
    { id: 'slides', title: 'Add slides', optional: true, group: 'prepare' },
    { id: 'run', title: 'Run the day', weight: 2, after: ['test', 'invite'] },
  ],
};

let clock = T0;
const now = () => clock;

beforeEach(() => {
  clock = T0;
  vi.useFakeTimers({ shouldAdvanceTime: false });
});
afterEach(() => {
  cleanup();
  reduced.value = false;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const view = (props: Partial<React.ComponentProps<typeof GettingStarted>> = {}) =>
  render(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} {...props} />);

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const imports = () => act(async () => { await vi.dynamicImportSettled(); });
const announce = () => document.querySelector('[data-slot="getting-started-announce"]')!.textContent!.replace(/ /g, '');
const row = (id: string) => document.querySelector(`[data-step="${id}"]`) as HTMLElement;
const box = (id: string) => within(row(id)).getByRole('checkbox');
/** Base UI toggles through its hidden input; a click on the visible root does not reach it in jsdom. */
const press = (id: string) => fireEvent.click(row(id).querySelector('input[type="checkbox"]')!);
const tick = async (id: string, after = clock) => {
  clock = after;
  press(id);
  await flush(450);
};
const doneState = (ids: string[]): ChecklistSnapshot => {
  let s = emptySnapshot();
  ids.forEach((id, i) => (s = complete(def, s, id, T0 + i, UTC)));
  return markCelebrated(s, celebrationsFor(def, emptySnapshot(), s));
};

describe('GettingStarted, the list', () => {
  it('draws the steps from the definition, in groups, with progress said in words', () => {
    view();
    const root = screen.getByTestId('gs');
    expect(root.getAttribute('data-min-viewport')).toBe(String(MIN_VIEWPORT));
    expect(root.getAttribute('data-state')).toBe('active');
    expect(root.getAttribute('data-motion')).toBe('full');
    expect(screen.getByRole('heading', { level: 2, name: 'Getting started' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Plan · 0 of 2', 'Prepare · 0 of 3']);
    const lists = document.querySelectorAll('ol[data-slot="getting-started-list"]');
    expect(lists).toHaveLength(3); // steps with no group, then each group; each is ordered: order matters
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('0 of 5 steps done');
    expect(row('date').getAttribute('data-state')).toBe('next');
    expect(row('invite').getAttribute('data-state')).toBe('locked');
    expect(row('slides').getAttribute('data-state')).toBe('todo');
    expect(screen.getByText('When it happens.')).toBeTruthy();
  });

  it('draws steps with no group at the top, and composed parts in the order the app wrote them', () => {
    const flat: ChecklistDef = { steps: [{ id: 'a', title: 'First' }, { id: 'b', title: 'Second', after: ['a'] }] };
    const { rerender } = render(<GettingStarted data-testid="gs" definition={flat} now={now} />);
    expect(document.querySelectorAll('ol')).toHaveLength(1);
    rerender(
      <GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC}>
        <GettingStartedStep id="slides" action={<a href="/slides">Open slides</a>} />
        <GettingStartedGroup id="plan" />
        <GettingStartedGroup id="nope" />
        <GettingStartedStep id="ghost" />
        <GettingStartedHeader />
        <GettingStartedCelebration />
      </GettingStarted>,
    );
    expect(document.querySelector('[data-step="ghost"]')).toBeNull();
    expect(row('slides')).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="getting-started-step"]')).toHaveLength(3);
  });

  it('refuses a part used outside the list', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<GettingStartedHeader />)).toThrow(/inside <GettingStarted>/);
  });

  it('opens the next step by default, all, or none', async () => {
    const open = (id: string) => within(row(id)).getAllByRole('button').find((b) => b.hasAttribute('aria-expanded'))!.getAttribute('aria-expanded');
    const withBody = (defaultOpen: 'next' | 'none' | 'all') =>
      render(
        <GettingStarted data-testid="gs" definition={def} now={now} defaultOpen={defaultOpen}>
          <GettingStartedStep id="date" action={<button>Go</button>} />
          <GettingStartedStep id="slides" action={<button>Go slides</button>} />
        </GettingStarted>,
      );
    withBody('next');
    expect(open('date')).toBe('true');
    expect(open('slides')).toBe('false');
    cleanup();
    withBody('none');
    expect(open('date')).toBe('false');
    cleanup();
    withBody('all');
    expect(open('slides')).toBe('true');
  });
});

describe('a locked step', () => {
  it('is focusable, aria-disabled, and says why in text and to a screen reader', async () => {
    view();
    const locked = box('agenda');
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(locked.hasAttribute('disabled')).toBe(false);
    expect(locked.tabIndex).toBeGreaterThanOrEqual(0);
    locked.focus();
    expect(document.activeElement).toBe(locked);
    expect(within(row('agenda')).getByText('Finish Pick a date first')).toBeTruthy();
    const reason = row('agenda').querySelector('[data-slot="getting-started-reason"]')!;
    expect(locked.getAttribute('aria-describedby')).toContain(reason.id);
  });

  it('does not toggle on a click or Enter, says what it waits for, and keeps focus', async () => {
    const onValueChange = vi.fn();
    view({ onValueChange });
    const locked = box('agenda');
    locked.focus();
    press('agenda');
    await flush(450);
    expect(locked.getAttribute('aria-checked')).toBe('false');
    expect(announce()).toBe('Pick a date first, then this step.');
    fireEvent.keyDown(locked, { key: 'Enter' });
    await flush(450);
    expect(announce()).toBe('Pick a date first, then this step.');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(locked);
  });

  it('unlocks when what it waits for is done', async () => {
    view();
    await tick('date');
    expect(box('agenda').hasAttribute('aria-disabled')).toBe(false);
    expect(row('agenda').getAttribute('data-state')).toBe('next');
  });
});

describe('celebrations and announcements', () => {
  it('says each change once, with the count, and never on the first render', async () => {
    const onValueChange = vi.fn();
    const onCelebrate = vi.fn();
    view({ onValueChange, onCelebrate });
    await flush(1000);
    expect(announce()).toBe('');
    await tick('date');
    expect(announce()).toBe('Pick a date done. 1 of 5 steps done.');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]![1]).toEqual({ type: 'complete', stepId: 'date' });
    expect(onCelebrate).toHaveBeenCalledWith({ type: 'step', stepId: 'date' });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('1 of 5 steps done');
  });

  it('coalesces fast changes into the last sentence', async () => {
    view();
    clock = T0 + 10;
    press('date');
    press('slides');
    await flush(450);
    expect(announce()).toBe('Add slides done.');
  });

  it('shows a milestone line, then the finish, and un-ticking and ticking again repeats nothing', async () => {
    const onCelebrate = vi.fn();
    view({ onCelebrate });
    await tick('date');
    await tick('agenda', T0 + 10); // 2 of 6 weight: crosses 25
    expect(document.querySelector('[data-slot="getting-started-celebration"]')!.textContent).toBe('25 percent of the way.');
    expect(announce()).toBe('25 percent: 2 of 5 steps done.');
    await tick('invite', T0 + 20);
    await tick('test', T0 + 30);
    await tick('run', T0 + 40);
    const banner = document.querySelector('[data-slot="getting-started-celebration"]')!;
    expect(banner.textContent).toBe('All set. You are ready.');
    expect(announce()).toBe('All 5 steps done. You are ready.');
    expect(screen.getByTestId('gs').getAttribute('data-state')).toBe('complete');
    const count = onCelebrate.mock.calls.length;
    await tick('run', T0 + 50); // un-tick
    expect(announce()).toBe('Run the day is open again.');
    await tick('run', T0 + 60); // tick again
    expect(onCelebrate.mock.calls.length).toBe(count);
    expect(announce()).not.toBe('');
  });

  it('is silent when it opens with progress already made: no celebration, no announcement', async () => {
    const onCelebrate = vi.fn();
    view({ defaultValue: doneState(['date', 'agenda', 'invite']), onCelebrate });
    await flush(2000);
    expect(onCelebrate).not.toHaveBeenCalled();
    expect(announce()).toBe('');
    expect(document.querySelector('[data-slot="getting-started-celebration"]')!.textContent).toBe('');
  });

  it('shows the finish in words on a reload of a finished list, without a burst', async () => {
    const all = doneState(['date', 'agenda', 'invite', 'test', 'run']);
    view({ defaultValue: all, celebrate: 'full' });
    await flush(100);
    expect(document.querySelector('[data-slot="getting-started-celebration"]')!.textContent).toBe('All set. You are ready.');
    expect(document.querySelector('[data-slot="getting-started-burst"]')).toBeNull();
  });

  it('plays the burst only in full mode, once, on the finish made here', async () => {
    const nearly = doneState(['date', 'agenda', 'invite', 'test']);
    const { unmount } = view({ defaultValue: nearly, celebrate: 'full' });
    await tick('run');
    await imports();
    expect(document.querySelectorAll('[data-slot="getting-started-burst"]')).toHaveLength(1);
    unmount();
    view({ defaultValue: nearly, celebrate: 'quiet' });
    await tick('run');
    await flush(10);
    expect(document.querySelector('[data-slot="getting-started-burst"]')).toBeNull();
    expect(screen.getByText('All set. You are ready.')).toBeTruthy();
  });

  it('does not mount the burst under reduced motion, and says the same in words', async () => {
    reduced.value = true;
    const nearly = doneState(['date', 'agenda', 'invite', 'test']);
    view({ defaultValue: nearly, celebrate: 'full' });
    expect(screen.getByTestId('gs').getAttribute('data-motion')).toBe('reduced');
    await tick('run');
    await flush(10);
    expect(document.querySelectorAll('[data-slot="getting-started-burst"]')).toHaveLength(0);
    expect(screen.getByText('All set. You are ready.')).toBeTruthy();
  });

  it('celebrate off still says the finish, but shows no milestone lines and no burst', async () => {
    const onCelebrate = vi.fn();
    view({ celebrate: 'off', onCelebrate, defaultValue: doneState(['date']) });
    await tick('agenda');
    expect(document.querySelector('[data-slot="getting-started-celebration"]')!.textContent).toBe('');
    expect(onCelebrate).toHaveBeenCalled(); // the app can still hear it
    expect(announce()).toBe('25 percent: 2 of 5 steps done.');
  });
});

describe('the burst itself', () => {
  it('draws nothing under reduced motion, even if something mounts it', async () => {
    const { default: Burst } = await import('../src/games/getting-started-burst.js');
    reduced.value = true;
    const { container, unmount } = render(<Burst />);
    expect(container.firstChild).toBeNull();
    unmount();
    reduced.value = false;
    const again = render(<Burst />);
    expect(again.container.querySelectorAll('[data-slot="getting-started-burst"] > span')).toHaveLength(16);
  });
});

describe('optional steps, dismissing and pace', () => {
  it('skips and un-skips an optional step, and a skipped one still reads as skipped', async () => {
    view();
    expect(within(row('date')).queryByRole('button', { name: 'Skip' })).toBeNull();
    fireEvent.click(within(row('slides')).getByRole('button', { name: 'Skip' }));
    await flush(450);
    expect(row('slides').getAttribute('data-state')).toBe('skipped');
    expect(within(row('slides')).getByText('Skipped')).toBeTruthy();
    expect(announce()).toBe('Add slides skipped.');
    fireEvent.click(within(row('slides')).getByRole('button', { name: 'Do this step' }));
    await flush(450);
    expect(row('slides').getAttribute('data-state')).toBe('todo');
  });

  it('hides a finished list, moves focus on to what follows, and says so', async () => {
    const all = doneState(['date', 'agenda', 'invite', 'test', 'run']);
    render(
      <>
        <GettingStarted data-testid="gs" definition={def} defaultValue={all} dismissible now={now} />
        <a href="/next">Next page</a>
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    await flush(450);
    expect(screen.getByTestId('gs').getAttribute('data-state')).toBe('dismissed');
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Next page' }));
    expect(announce()).toBe('Checklist hidden');
    expect(screen.queryByRole('heading', { name: 'Getting started' })).toBeNull();
  });

  it('offers Hide only when dismissible and complete', () => {
    view({ defaultValue: doneState(['date', 'agenda', 'invite', 'test', 'run']) });
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
  });

  it('says the pace in words from a due date, and nothing without one', () => {
    const { rerender } = view({ dueAt: T0 + 4 * DAY });
    expect(document.querySelector('[data-slot="getting-started-pace"]')!.textContent).toBe('5 steps left, 4 days to go. On track.');
    rerender(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} dueAt={T0 + DAY} />);
    expect(document.querySelector('[data-slot="getting-started-pace"]')!.textContent).toBe('5 steps left, 1 day to go. A little behind.');
    rerender(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} dueAt={T0 - DAY} />);
    expect(document.querySelector('[data-slot="getting-started-pace"]')!.textContent).toBe('5 steps left. The date has passed.');
    rerender(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} />);
    expect(document.querySelector('[data-slot="getting-started-pace"]')).toBeNull();
  });
});

describe('the streak', () => {
  const days = (n: number, endAt = T0) => Array.from({ length: n }, (_, i) => model.parseSnapshot({ v: 1, activeDays: [new Date(endAt - i * DAY).toISOString().slice(0, 10)] })!.activeDays[0]!);
  const withDays = (list: string[]): ChecklistSnapshot => ({ ...emptySnapshot(), activeDays: list });

  it('is absent unless the app asks for it', () => {
    view({ defaultValue: withDays(days(3)) });
    expect(document.querySelector('[data-slot="getting-started-streak"]')).toBeNull();
  });

  it('says days in a row, what to do today, and that a rest day is safe, and never the language of loss', () => {
    const line = () => document.querySelector('[data-slot="getting-started-streak"]')?.textContent ?? null;
    const { rerender } = view({ streak: {}, defaultValue: withDays(days(3)) });
    expect(line()).toBe('3 days in a row');
    rerender(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} streak={{}} defaultValue={withDays(days(3, T0 - DAY))} key="pending" />);
    expect(line()).toBe('Do one step today to keep your 3 days going');
    const rest = { weekdays: [new Date(T0).getUTCDay()] };
    rerender(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} streak={{ rest }} defaultValue={withDays(days(3, T0 - DAY))} key="rest" />);
    expect(line()).toBe('Rest day. Your 3 days are safe');
    rerender(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} streak={{}} defaultValue={withDays([])} key="none" />);
    expect(line()).toBeNull();
    rerender(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} streak={{}} defaultValue={withDays(days(1))} key="one" />);
    expect(line()).toBe('1 day in a row');
  });

  it('counts a day the person does something', async () => {
    view({ streak: {} });
    await tick('date');
    expect(document.querySelector('[data-slot="getting-started-streak"]')!.textContent).toBe('1 day in a row');
  });
});

describe('copy', () => {
  it('has no word of loss anywhere in the default words, in any state', async () => {
    const texts: string[] = [];
    const grab = () => texts.push(document.body.textContent ?? '', announce());
    const behind = view({ streak: {}, dueAt: T0 + DAY, defaultValue: { ...emptySnapshot(), activeDays: ['2026-11-18', '2026-11-17'] } });
    grab();
    behind.unmount();
    view({ dueAt: T0 - DAY });
    grab();
    await tick('date');
    grab();
    await tick('date', T0 + 5);
    grab();
    const all = doneState(['date', 'agenda', 'invite', 'test', 'run']);
    cleanup();
    view({ defaultValue: all, dismissible: true });
    grab();
    expect(texts.join(' ')).not.toMatch(/\b(lost|loss|broken|broke|missed|miss|failed|streak (is )?over)\b/i);
  });
});

describe('persistence', () => {
  const stored = (store: ReturnType<typeof memoryStore>) => store.current();

  it('shows the list as a shell while it loads, then the saved progress, silently', async () => {
    let resolve!: (s: ChecklistSnapshot | null) => void;
    const store: ChecklistStore = { load: () => new Promise((r) => (resolve = r)), save: vi.fn() };
    const onCelebrate = vi.fn();
    view({ store, onCelebrate });
    const root = screen.getByTestId('gs');
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.getAttribute('data-state')).toBe('loading');
    const shell = document.querySelector('[data-slot="getting-started-loading"]') as HTMLElement;
    expect(shell.style.minHeight).toBe(`${def.steps.length * 3.5}rem`);
    expect(document.querySelector('[data-step]')).toBeNull();
    await flush(0); // the effect asks for the saved progress
    resolve(doneState(['date', 'agenda']));
    await flush(10);
    expect(root.hasAttribute('aria-busy')).toBe(false);
    expect(row('agenda').getAttribute('data-state')).toBe('done');
    expect(onCelebrate).not.toHaveBeenCalled();
    expect(announce()).toBe('');
  });

  it('falls back to the default and says once when loading fails', async () => {
    const store: ChecklistStore = { load: () => Promise.reject(new Error('offline')), save: vi.fn() };
    view({ store, defaultValue: doneState(['date']) });
    await flush(10);
    expect(document.querySelector('[data-slot="getting-started-save"]')!.textContent).toBe('Could not load your saved progress.');
    expect(row('date').getAttribute('data-state')).toBe('done');
  });

  it('uses the default when nothing is saved yet, and does not trust what it loads', async () => {
    const hostile = { v: 1, done: { __proto__: 1, date: 5, ghost: 9 }, celebrated: ['step:ghost'], at: -1 } as unknown as ChecklistSnapshot;
    view({ store: memoryStore(hostile) });
    await flush(10);
    expect(row('date').getAttribute('data-state')).toBe('done');
    cleanup();
    view({ store: memoryStore(null), defaultValue: doneState(['date']) });
    await flush(10);
    expect(row('date').getAttribute('data-state')).toBe('done');
  });

  it('saves once for five changes made within a moment, with the last state, and flushes on pagehide', async () => {
    const save = vi.fn();
    const store: ChecklistStore = { load: () => null, save };
    view({ store });
    await flush(10);
    for (const id of ['date', 'slides', 'slides', 'slides', 'slides']) {
      clock += 5;
      press(id);
      await flush(100); // each change is within 300ms of the last: the save keeps waiting
    }
    expect(save).not.toHaveBeenCalled();
    await flush(250);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].done).toHaveProperty('date');
    clock += 5;
    press('agenda');
    window.dispatchEvent(new Event('pagehide'));
    expect(save).toHaveBeenCalledTimes(2); // at once: a page that is going has no later tick
    await flush(1000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('keeps the progress, says once that it is not saved, retries, and clears the line on success', async () => {
    let fail = true;
    const save = vi.fn(() => (fail ? Promise.reject(new Error('down')) : Promise.resolve()));
    view({ store: { load: () => null, save } });
    await flush(10);
    await tick('date');
    await flush(300);
    const line = () => document.querySelector('[data-slot="getting-started-save"]')!;
    expect(line().textContent).toBe('Not saved yet. Your progress is kept on this page.');
    expect(line().getAttribute('role')).toBe('status');
    expect(row('date').getAttribute('data-state')).toBe('done'); // kept on the page
    const first = save.mock.calls.length;
    await flush(2000); // the first retry, still failing: the line says the same, it does not speak again
    expect(save.mock.calls.length).toBe(first + 1);
    expect(line().textContent).toBe('Not saved yet. Your progress is kept on this page.');
    fail = false;
    await flush(8000);
    expect(line().textContent).toBe('');
    const after = save.mock.calls.length;
    await flush(60_000);
    expect(save.mock.calls.length).toBe(after); // no more once it worked
  });

  it('stops retrying after the third try until the next change', async () => {
    const save = vi.fn(() => Promise.reject(new Error('down')));
    view({ store: { load: () => null, save } });
    await flush(10);
    await tick('date');
    await flush(300 + 2000 + 8000 + 30_000);
    const total = save.mock.calls.length;
    expect(total).toBe(4); // the save, then 2s, 8s and 30s
    await flush(120_000);
    expect(save.mock.calls.length).toBe(total);
    clock += 5;
    press('slides');
    await flush(350);
    expect(save.mock.calls.length).toBe(total + 1);
  });

  it('merges another tab in, reports it as a merge, and celebrates nothing', async () => {
    const store = memoryStore(null);
    const onValueChange = vi.fn();
    const onCelebrate = vi.fn();
    view({ store, onValueChange, onCelebrate });
    await flush(10);
    const other = doneState(['date', 'agenda']);
    act(() => store.save({ ...other, at: other.at + 1 }));
    await flush(10);
    expect(row('agenda').getAttribute('data-state')).toBe('done');
    expect(onValueChange.mock.calls.at(-1)![1]).toEqual({ type: 'merge' });
    expect(onCelebrate).not.toHaveBeenCalled();
    expect(announce()).toBe('');
    // The same snapshot again changes nothing and reports nothing.
    const calls = onValueChange.mock.calls.length;
    act(() => store.save({ ...other, at: other.at + 1 }));
    await flush(10);
    expect(onValueChange.mock.calls.length).toBe(calls);
    // A snapshot that is not one is ignored.
    act(() => store.save({ v: 9 } as unknown as ChecklistSnapshot));
    await flush(10);
    expect(row('agenda').getAttribute('data-state')).toBe('done');
  });

  it('keeps an un-tick made on another tab', async () => {
    const store = memoryStore(null);
    view({ store });
    await flush(10);
    await tick('date', T0 + 10);
    const mine = stored(store)!;
    act(() => store.save(model.uncomplete(def, mine, 'date', T0 + 99_000)));
    await flush(10);
    expect(row('date').getAttribute('data-state')).toBe('next');
  });

  it('is controlled by value, and then ignores the store', async () => {
    const save = vi.fn();
    const store: ChecklistStore = { load: () => doneState(['date']), save };
    const onValueChange = vi.fn();
    const { rerender } = view({ value: emptySnapshot(), onValueChange, store });
    await flush(10);
    expect(row('date').getAttribute('data-state')).toBe('next'); // the store's saved date is ignored
    await tick('date');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(row('date').getAttribute('data-state')).toBe('next'); // the app has not passed it back yet
    rerender(<GettingStarted data-testid="gs" definition={def} now={now} timeZone={UTC} value={onValueChange.mock.calls[0]![0]} onValueChange={onValueChange} store={store} />);
    expect(row('date').getAttribute('data-state')).toBe('done');
    await flush(1000);
    expect(save).not.toHaveBeenCalled();
  });
});
