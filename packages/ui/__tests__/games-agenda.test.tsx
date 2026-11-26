/**
 * Agenda: the running order of a session, as pure state the presenter's
 * console and the room's screen both read, and the two views.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reduced = { value: false };
vi.mock('../src/lib/use-reduced-motion.js', () => ({
  useReducedMotion: () => reduced.value,
}));

const { agendaStatus, applyAgendaEvent, createAgenda, formatClock } = await import('../src/games/agenda-model.js');
const { Agenda, AgendaNow, MIN_VIEWPORT } = await import('../src/games/agenda.js');

type AgendaEvent = Parameters<typeof applyAgendaEvent>[2];
type AgendaState = ReturnType<typeof createAgenda>;

const MIN = 60_000;
const items = [
  { id: 'a', title: 'Welcome', minutes: 5, notes: 'Say hello.\nShow the join code.' },
  { id: 'b', title: 'Warm up', minutes: 10 },
  { id: 'c', title: 'Close', minutes: 2 },
];

function run(events: readonly AgendaEvent[], state: AgendaState = createAgenda()): AgendaState {
  return events.reduce((s, e) => applyAgendaEvent(items, s, e), state);
}

afterEach(() => {
  cleanup();
  reduced.value = false;
  vi.useRealTimers();
});

describe('agenda-model', () => {
  it('starts once, and says what is on and how long is left', () => {
    const s = run([
      { type: 'start', at: 0 },
      { type: 'start', at: 99 },
    ]);
    expect(s.startedAt).toBe(0);
    const st = agendaStatus(items, s, 2 * MIN);
    expect(st).toMatchObject({ phase: 'running', index: 0, leftMs: 3 * MIN, driftMs: 0, totalMs: 17 * MIN });
    expect(st.item?.id).toBe('a');
    expect(st.next?.id).toBe('b');
    expect(st.endsAt).toBe(2 * MIN + 3 * MIN + 12 * MIN);
    expect(applyAgendaEvent([], createAgenda(), { type: 'start', at: 0 })).toEqual(createAgenda());
  });

  it('before the start, shows the first item as next and no clock', () => {
    const st = agendaStatus(items, createAgenda(), 0);
    expect(st).toMatchObject({ phase: 'before', index: -1, item: null, endsAt: null });
    expect(st.next?.id).toBe('a');
  });

  it('moves on once when the same next arrives twice', () => {
    const next: AgendaEvent = { type: 'next', from: 0, at: 6 * MIN };
    const s = run([{ type: 'start', at: 0 }, next, next]);
    expect(s.current).toBe(1);
    expect(s.spent).toEqual({ a: 6 * MIN });
    // One minute over on the first item puts the session one minute behind.
    expect(agendaStatus(items, s, 6 * MIN).driftMs).toBe(MIN);
  });

  it('runs over, counting the overrun into the drift', () => {
    const s = run([{ type: 'start', at: 0 }]);
    const st = agendaStatus(items, s, 7 * MIN);
    expect(st).toMatchObject({ phase: 'over', leftMs: -2 * MIN, driftMs: 2 * MIN });
    expect(st.endsAt).toBe(7 * MIN + 12 * MIN);
  });

  it('pauses and resumes without losing time, and ignores repeats', () => {
    const s = run([
      { type: 'start', at: 0 },
      { type: 'pause', at: MIN },
      { type: 'pause', at: 2 * MIN },
    ]);
    expect(agendaStatus(items, s, 10 * MIN)).toMatchObject({ phase: 'paused', elapsedMs: MIN });
    const r = run(
      [
        { type: 'resume', at: 4 * MIN },
        { type: 'resume', at: 5 * MIN },
      ],
      s,
    );
    expect(agendaStatus(items, r, 5 * MIN)).toMatchObject({ phase: 'running', elapsedMs: 2 * MIN });
    // Resume with nothing paused, or before the start, changes nothing.
    expect(run([{ type: 'resume', at: 0 }])).toEqual(createAgenda());
    expect(run([{ type: 'pause', at: 0 }])).toEqual(createAgenda());
  });

  it('goes back to where the earlier item stopped, from an item or from the end', () => {
    const s = run([
      { type: 'start', at: 0 },
      { type: 'next', from: 0, at: 4 * MIN },
      { type: 'back', from: 1, at: 5 * MIN },
      { type: 'back', from: 1, at: 5 * MIN },
    ]);
    expect(s.current).toBe(0);
    expect(agendaStatus(items, s, 5 * MIN).elapsedMs).toBe(4 * MIN);
    expect(s.spent).toEqual({ b: MIN });
    // Back at the first item does nothing.
    expect(applyAgendaEvent(items, s, { type: 'back', from: 0, at: 6 * MIN })).toBe(s);

    const done = run([
      { type: 'start', at: 0 },
      { type: 'next', from: 0, at: 5 * MIN },
      { type: 'next', from: 1, at: 15 * MIN },
      { type: 'next', from: 2, at: 18 * MIN },
    ]);
    expect(agendaStatus(items, done, 20 * MIN)).toMatchObject({ phase: 'finished', item: null, driftMs: MIN });
    expect(applyAgendaEvent(items, done, { type: 'next', from: 3, at: 0 })).toBe(done);
    const reopened = applyAgendaEvent(items, done, { type: 'back', from: 3, at: 20 * MIN });
    expect(reopened.current).toBe(2);
    expect(agendaStatus(items, reopened, 20 * MIN).elapsedMs).toBe(3 * MIN);
  });

  it('extends the item that is on, never below its plan', () => {
    const s = run([
      { type: 'start', at: 0 },
      { type: 'extend', minutes: 2 },
    ]);
    expect(agendaStatus(items, s, 0).plannedMs).toBe(7 * MIN);
    expect(run([{ type: 'extend', minutes: -5 }], s).extra).toEqual({ a: 0 });
    expect(run([{ type: 'extend', minutes: 1 }])).toEqual(createAgenda());
    expect(run([{ type: 'reset' }], s)).toEqual(createAgenda());
  });

  it('survives a JSON round trip, as a refreshed tab would read it', () => {
    const s = run([
      { type: 'start', at: 0 },
      { type: 'next', from: 0, at: 5 * MIN },
      { type: 'extend', minutes: 1 },
    ]);
    const saved = JSON.parse(JSON.stringify(s)) as AgendaState;
    expect(agendaStatus(items, saved, 9 * MIN)).toEqual(agendaStatus(items, s, 9 * MIN));
  });

  it('reads a hand-built state with no start time as a fresh item', () => {
    const odd: AgendaState = { ...createAgenda(), current: 1 };
    expect(agendaStatus(items, odd, 5 * MIN)).toMatchObject({ phase: 'running', elapsedMs: 0, leftMs: 10 * MIN });
  });

  it('formats a clock as m:ss, rounded up', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(1)).toBe('0:01');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(-90_000)).toBe('1:30');
  });
});

describe('Agenda', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  function Harness({ initial = createAgenda(), shortcuts = false }: { initial?: AgendaState; shortcuts?: boolean }) {
    const [state, setState] = React.useState(initial);
    return (
      <Agenda
        items={items}
        state={state}
        shortcuts={shortcuts}
        locale="en-US"
        onEvent={(e) => setState((s) => applyAgendaEvent(items, s, e))}
      />
    );
  }

  it('starts, shows notes, ticks, and moves on with the buttons', () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('[data-slot="agenda"]')?.getAttribute('data-min-viewport')).toBe(
      String(MIN_VIEWPORT),
    );
    expect(screen.getByText('Starting soon')).toBeTruthy();
    expect(screen.queryByRole('timer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('timer').textContent).toContain('5:00');
    expect(screen.getByText(/Show the join code/)).toBeTruthy();
    expect(screen.getByText(/On plan\. Ends around/)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(61_100);
    });
    expect(screen.getByRole('timer').textContent).toContain('3:59');
    const current = container.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain('Welcome');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    });
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Warm up');
    expect(container.querySelector('[data-slot="agenda-announce"]')?.textContent).toBe('Now: Warm up');
    // The finished item shows how long it really ran.
    expect(container.querySelector('[data-state="done"]')?.textContent).toContain('1:02');
  });

  it('pauses, extends, runs over in words, and finishes', () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('timer').textContent).toContain('Paused');
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole('timer').textContent).toContain('5:00');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a minute' }));
    expect(screen.getByRole('timer').textContent).toContain('6:00');
    act(() => {
      vi.advanceTimersByTime(5 * MIN + 2_000);
    });
    expect(container.querySelector('[data-slot="agenda-announce"]')?.textContent).toBe('One minute left on Welcome');
    act(() => {
      vi.advanceTimersByTime(2 * MIN);
    });
    expect(container.querySelector('[data-slot="agenda"]')?.getAttribute('data-phase')).toBe('over');
    expect(screen.getByRole('timer').textContent).toMatch(/over/);
    expect(container.querySelector('[data-slot="agenda-announce"]')?.textContent).toBe('Time is up on Welcome');
    expect(screen.getByText(/1 min behind plan/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    expect(screen.getByText("That's all")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Close');
  });

  it('follows a presentation remote when shortcuts are on, but not while typing', () => {
    const { container } = render(
      <>
        <Harness shortcuts />
        <input aria-label="field" />
      </>,
    );
    const at = () => container.querySelector('[aria-current="step"]')?.textContent ?? '';
    fireEvent.keyDown(document.body, { key: 'PageDown' });
    expect(at()).toContain('Welcome');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(at()).toContain('Warm up');
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'PageDown' });
    expect(at()).toContain('Warm up');
    fireEvent.keyDown(document.body, { key: 'PageDown', ctrlKey: true });
    expect(at()).toContain('Warm up');
    fireEvent.keyDown(document.body, { key: 'PageUp' });
    expect(at()).toContain('Welcome');
    fireEvent.keyDown(document.body, { key: 'p' });
    expect(screen.getByRole('timer').textContent).toContain('Paused');
    fireEvent.keyDown(document.body, { key: 'p' });
    expect(screen.getByRole('timer').textContent).not.toContain('Paused');
    fireEvent.keyDown(document.body, { key: 'x' });
    expect(at()).toContain('Welcome');
  });

  it('does not announce what is already on after a refresh, and animates the bar to the end', () => {
    const animate = vi.fn(() => ({ cancel: () => undefined }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const state = run([{ type: 'start', at: -2 * MIN }]);
    const { container } = render(<Harness initial={state} />);
    expect(container.querySelector('[data-slot="agenda-announce"]')?.textContent).toBe('');
    expect(screen.getByRole('timer').textContent).toContain('3:00');
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'scaleX(0.6)' }, { transform: 'scaleX(0)' }],
      expect.objectContaining({ duration: 3 * MIN, easing: 'linear' }),
    );
    animate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    // The new title rises in.
    expect(animate).toHaveBeenCalledWith(
      [
        { transform: 'translateY(0.5em)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      expect.objectContaining({ duration: 200 }),
    );
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  });

  it('moves nothing under reduced motion', () => {
    reduced.value = true;
    const animate = vi.fn(() => ({ cancel: () => undefined }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    render(<Harness initial={run([{ type: 'start', at: 0 }])} />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(animate).not.toHaveBeenCalled();
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  });

  it('takes labels and a custom pace line', () => {
    render(
      <Agenda
        items={items}
        state={run([{ type: 'start', at: 0 }])}
        onEvent={() => undefined}
        labels={{ now: 'Jetzt', pace: ({ drift }) => `Drift ${drift}`, minutes: (m) => `${m}m` }}
      />,
    );
    expect(screen.getByText('Jetzt')).toBeTruthy();
    expect(screen.getByText('Drift 0')).toBeTruthy();
    expect(screen.getByText('10m')).toBeTruthy();
  });

  it('freezes at a given moment', () => {
    const state = run([{ type: 'start', at: 0 }]);
    render(<Agenda items={items} state={state} frozenAt={2 * MIN} onEvent={() => undefined} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole('timer').textContent).toContain('3:00');
    cleanup();
    render(<AgendaNow items={items} state={state} frozenAt={4 * MIN} />);
    expect(screen.getByRole('timer').textContent).toBe('1:00');
  });

  it('cannot start an empty agenda', () => {
    render(<Agenda items={[]} state={createAgenda()} onEvent={() => undefined} />);
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('AgendaNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  it('shows the room what is on, the time left and what is next', () => {
    const { rerender, container } = render(<AgendaNow items={items} state={createAgenda()} />);
    expect(screen.getByText('Starting soon')).toBeTruthy();
    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(screen.queryByText(/Up next/)).toBeNull();
    const on = run([{ type: 'start', at: 0 }]);
    rerender(<AgendaNow items={items} state={on} size="stage" />);
    expect(screen.getByRole('timer').textContent).toBe('5:00');
    expect(container.textContent).toContain('Up next: Warm up');
    rerender(<AgendaNow items={items} state={run([{ type: 'pause', at: 0 }], on)} />);
    expect(screen.getByRole('timer').textContent).toBe('Paused');
    act(() => {
      vi.setSystemTime(9 * MIN);
    });
    rerender(<AgendaNow items={items} state={on} showTime={false} />);
    expect(screen.queryByRole('timer')).toBeNull();
    const done = run(
      [
        { type: 'next', from: 0, at: 1 },
        { type: 'next', from: 1, at: 2 },
        { type: 'next', from: 2, at: 3 },
      ],
      on,
    );
    rerender(<AgendaNow items={items} state={done} />);
    expect(screen.getByText("That's all")).toBeTruthy();
    expect(container.querySelector('[data-phase="finished"]')).toBeTruthy();
  });
});
