/**
 * PresenterNotes and useAgenda: what the presenter sees, the keys, the spoken signals, and a
 * second screen that stays right through reloads, repeats and messages out of order.
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyAgendaEvent,
  createAgenda,
  createAgendaStore,
  restoreAgenda,
  serializeAgenda,
  type AgendaEvent,
  type AgendaMessage,
  type AgendaState,
} from '../src/games/agenda-model.js';
import { createMemoryRoomHub, type RoomTransport } from '../src/games/room-model.js';
import { PresenterNotes, useAgenda, type UseAgendaResult } from '../src/games/presenter-notes.js';
import { flakyReceiver } from './flaky-transport.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const T0 = 1_700_000_000_000;
const MIN = 60_000;

const sections = () => [
  { id: 'intro', title: 'Welcome', notes: 'Say hello.\nName the goal.', plannedSeconds: 300 },
  { id: 'demo', title: 'Demo', notes: 'Show the room.', plannedSeconds: 600 },
  { id: 'qa', title: 'Questions', plannedSeconds: 120 },
];

const at = (events: [AgendaEvent['type'] | AgendaEvent, number][]) =>
  events.reduce(
    (s, [e, ms]) => applyAgendaEvent(s, typeof e === 'string' ? ({ type: e } as AgendaEvent) : e, T0 + ms),
    createAgenda(sections()),
  );

function show(agenda: AgendaState, clock: { t: number }, props: Partial<React.ComponentProps<typeof PresenterNotes>> = {}) {
  const send = vi.fn();
  const view = render(<PresenterNotes agenda={agenda} send={send} now={() => clock.t} {...props} />);
  const again = (next: AgendaState) =>
    view.rerender(<PresenterNotes agenda={next} send={send} now={() => clock.t} {...props} />);
  return { send, again, ...view };
}

const pace = () => screen.getByText((_, el) => el?.getAttribute('data-slot') === 'presenter-notes-pace');
const announce = () => document.querySelector('[data-slot="presenter-notes-announce"]')!.textContent;

describe('PresenterNotes', () => {
  it('shows the section, its notes as plain text, and the time against the plan', () => {
    const clock = { t: T0 + 90_000 };
    const agenda = at([['start', 0]]);
    show(agenda, clock);
    expect(screen.getByRole('region', { name: 'Presenter notes' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeTruthy();
    expect(screen.getByText('Section 1 of 3')).toBeTruthy();
    const notes = screen.getByRole('region', { name: 'Notes' });
    expect(notes.textContent).toBe('Say hello.\nName the goal.');
    expect(notes.getAttribute('tabindex')).toBe('0'); // scrollable, so reachable by keyboard
    const clockEl = screen.getByRole('timer', { name: 'Time in this section' });
    expect(within(clockEl).getByText('1:30')).toBeTruthy();
    expect(within(clockEl).getByText('of 5:00 planned')).toBeTruthy();
    expect(pace().textContent).toBe('On time');
  });

  it('never reads notes as HTML', () => {
    const agenda = createAgenda([{ title: 'T', notes: '<img src=x onerror="window.__pwned=1"><b>bold</b>' }]);
    const { container } = show(agenda, { t: T0 });
    expect(container.querySelector('img, b')).toBeNull();
    expect(screen.getByRole('region', { name: 'Notes' }).textContent).toContain('<b>bold</b>');
  });

  it('says it in words: not started, paused, nearly out of time, and how far over', () => {
    const clock = { t: T0 };
    expect(show(createAgenda(sections()), clock).container && pace().textContent).toBe('Not started');
    cleanup();
    show(at([['start', 0], ['pause', 10_000]]), clock);
    expect(pace().textContent).toBe('Paused');
    cleanup();
    show(at([['start', 0]]), { t: T0 + 4.5 * MIN });
    expect(pace().textContent).toBe('Nearly out of time');
    expect(document.querySelector('[data-slot="presenter-notes"]')!.getAttribute('data-tier')).toBe('near');
    cleanup();
    show(at([['start', 0]]), { t: T0 + 6 * MIN + 5000 });
    expect(pace().textContent).toBe('1:05 over');
    expect(document.querySelector('[data-slot="presenter-notes-clock"]')!.getAttribute('data-tier')).toBe('over');
  });

  it('shows no planned time for a section without one, and says there are no notes', () => {
    const agenda = applyAgendaEvent(createAgenda([{ title: 'Open floor' }]), { type: 'start' }, T0);
    show(agenda, { t: T0 + MIN });
    expect(screen.getByText('no time planned')).toBeTruthy();
    expect(screen.getByText('No notes for this section.')).toBeTruthy();
    expect(pace().textContent).toBe('On time');
  });

  it('lists the agenda with the current section marked, and a click jumps to a section', () => {
    const { send } = show(at([['start', 0], ['next', MIN]]), { t: T0 + 2 * MIN });
    const list = screen.getByRole('list', { name: 'Agenda' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[1]!.getAttribute('aria-current')).toBe('step');
    expect(buttons[0]!.getAttribute('aria-current')).toBeNull();
    expect(buttons[0]!.textContent).toContain('Done');
    expect(buttons[0]!.textContent).toContain('1:00 used of 5:00');
    expect(buttons[2]!.textContent).toContain('Later');
    fireEvent.click(buttons[2]!);
    expect(send).toHaveBeenCalledWith({ type: 'goto', index: 2 });
  });

  it('shows how far over the plan the session is, and "on plan" otherwise', () => {
    show(at([['start', 0], ['next', 7 * MIN]]), { t: T0 + 8 * MIN });
    expect(document.querySelector('[data-slot="presenter-notes-total"]')!.textContent).toBe(
      'Total 8:00 of 17:00 planned. 2:00 behind plan.',
    );
    cleanup();
    show(at([['start', 0]]), { t: T0 + MIN });
    expect(document.querySelector('[data-slot="presenter-notes-total"]')!.textContent).toBe(
      'Total 1:00 of 17:00 planned. On plan.',
    );
  });

  describe('buttons', () => {
    it('start, pause, resume and start again follow the status', () => {
      const clock = { t: T0 };
      const primary = () => screen.getByRole('button', { name: /Start again|Start|Pause|Resume/ });
      const states: [AgendaState, string, AgendaEvent['type']][] = [
        [createAgenda(sections()), 'Start', 'start'],
        [at([['start', 0]]), 'Pause', 'pause'],
        [at([['start', 0], ['pause', 1]]), 'Resume', 'resume'],
        [at([['start', 0], ['next', 1], ['next', 2], ['next', 3]]), 'Start again', 'reset'],
      ];
      for (const [agenda, label, type] of states) {
        const { send } = show(agenda, clock);
        expect(primary().textContent).toBe(label);
        fireEvent.click(primary());
        expect(send).toHaveBeenCalledWith({ type });
        cleanup();
      }
    });

    it('next, previous and a minute more, with the right ones disabled', () => {
      const { send } = show(at([['start', 0], ['next', MIN]]), { t: T0 + 2 * MIN });
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add a minute' }));
      expect(send.mock.calls.map((c) => c[0])).toEqual([{ type: 'previous' }, { type: 'next' }, { type: 'add-time', seconds: 60 }]);
      cleanup();
      show(createAgenda(sections()), { t: T0 });
      expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
      cleanup();
      show(at([['start', 0]]), { t: T0 });
      expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
      cleanup();
      const last = at([['start', 0], ['next', 1], ['next', 2]]);
      show(last, { t: T0 + 3 });
      expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
      cleanup();
      show(at([['start', 0], ['next', 1], ['next', 2], ['next', 3]]), { t: T0 + 4 });
      expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('keyboard', () => {
    const press = (key: string, init: KeyboardEventInit = {}, target: Element | Document = document.body) =>
      fireEvent.keyDown(target, { key, ...init });

    it('Space, the arrows, N, P and + do what the buttons do', () => {
      const { send } = show(createAgenda(sections()), { t: T0 });
      press(' ');
      press('ArrowRight');
      press('n');
      press('N');
      press('ArrowLeft');
      press('p');
      press('+');
      press('=');
      expect(send.mock.calls.map((c) => c[0])).toEqual([
        { type: 'start' },
        { type: 'next' },
        { type: 'next' },
        { type: 'next' },
        { type: 'previous' },
        { type: 'previous' },
        { type: 'add-time', seconds: 60 },
        { type: 'add-time', seconds: 60 },
      ]);
    });

    it('Space pauses what runs and resumes what is paused, and does nothing once done', () => {
      const run = show(at([['start', 0]]), { t: T0 });
      press(' ');
      expect(run.send).toHaveBeenLastCalledWith({ type: 'pause' });
      cleanup();
      const paused = show(at([['start', 0], ['pause', 1]]), { t: T0 });
      press(' ');
      expect(paused.send).toHaveBeenLastCalledWith({ type: 'resume' });
      cleanup();
      const done = show(at([['start', 0], ['next', 1], ['next', 2], ['next', 3]]), { t: T0 + 4 });
      press(' ');
      expect(done.send).not.toHaveBeenCalled();
    });

    it('leaves typing alone: fields, selects, editable text and sliders', () => {
      const { send } = show(createAgenda(sections()), { t: T0 });
      const input = document.createElement('input');
      const select = document.createElement('select');
      const editable = document.createElement('div');
      Object.defineProperty(editable, 'isContentEditable', { value: true });
      const slider = document.createElement('div');
      slider.setAttribute('role', 'slider');
      document.body.append(input, select, editable, slider);
      for (const el of [input, select, editable, slider]) {
        press('n', {}, el);
        press(' ', {}, el);
        press('ArrowRight', {}, el);
      }
      expect(send).not.toHaveBeenCalled();
      [input, select, editable, slider].forEach((el) => el.remove());
    });

    it('leaves Space to a focused button, but not the arrows', () => {
      const { send } = show(createAgenda(sections()), { t: T0 });
      const button = screen.getByRole('button', { name: 'Add a minute' });
      press(' ', {}, button);
      expect(send).not.toHaveBeenCalled();
      press('ArrowRight', {}, button);
      expect(send).toHaveBeenCalledWith({ type: 'next' });
      const link = document.createElement('a');
      const tab = document.createElement('div');
      tab.setAttribute('role', 'tab');
      document.body.append(link, tab);
      press(' ', {}, link);
      press(' ', {}, tab);
      expect(send).toHaveBeenCalledTimes(1);
      link.remove();
      tab.remove();
    });

    it('ignores a held key, a chord, and a key something else already handled', () => {
      const { send } = show(createAgenda(sections()), { t: T0 });
      press('ArrowRight', { repeat: true });
      press('n', { ctrlKey: true });
      press('n', { metaKey: true });
      press('n', { altKey: true });
      const handled = new KeyboardEvent('keydown', { key: 'n', cancelable: true, bubbles: true });
      handled.preventDefault();
      document.body.dispatchEvent(handled);
      press('x');
      expect(send).not.toHaveBeenCalled();
    });

    it('can be switched off by the presenter, and by the app', () => {
      const { send } = show(createAgenda(sections()), { t: T0 });
      fireEvent.click(screen.getByText('Keyboard shortcuts'));
      const box = screen.getByRole('checkbox', { name: 'Use keyboard shortcuts' }) as HTMLInputElement;
      expect(box.checked).toBe(true);
      fireEvent.click(box);
      press('n');
      expect(send).not.toHaveBeenCalled();
      fireEvent.click(box);
      press('n');
      expect(send).toHaveBeenCalledTimes(1);
      cleanup();
      const off = show(createAgenda(sections()), { t: T0 }, { shortcuts: false });
      press('n');
      expect(off.send).not.toHaveBeenCalled();
      expect(screen.queryByText('Keyboard shortcuts')).toBeNull();
    });

    it('lists the keys, and names them on the buttons', () => {
      show(createAgenda(sections()), { t: T0 });
      const keys = document.querySelector('[data-slot="presenter-notes-keys"]')!;
      expect(keys.textContent).toContain('Start, pause or resume');
      expect(keys.textContent).toContain('Add a minute');
      expect(screen.getByRole('button', { name: 'Next' }).getAttribute('aria-keyshortcuts')).toBe('ArrowRight N');
      expect(screen.getByRole('button', { name: 'Start' }).getAttribute('aria-keyshortcuts')).toBe('Space');
    });

    it('stops listening when it unmounts', () => {
      const { send, unmount } = show(createAgenda(sections()), { t: T0 });
      unmount();
      press('n');
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('the clock', () => {
    it('ticks each second while running, and stands still when paused', () => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      const agenda = at([['start', 0]]);
      show(agenda, { t: 0 }, { now: Date.now });
      const elapsed = () => document.querySelector('[data-slot="presenter-notes-elapsed"]')!.textContent;
      expect(elapsed()).toBe('0:00');
      act(() => void vi.advanceTimersByTime(3100));
      expect(elapsed()).toBe('0:03');
      cleanup();
      show(at([['start', 0], ['pause', 5000]]), { t: 0 }, { now: Date.now });
      act(() => void vi.advanceTimersByTime(60_000));
      expect(document.querySelector('[data-slot="presenter-notes-elapsed"]')!.textContent).toBe('0:05');
    });
  });

  describe('spoken signals', () => {
    it('says nothing on the first look, and nothing while the seconds go by', () => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      show(at([['start', 0]]), { t: 0 }, { now: Date.now });
      expect(announce()).toBe('');
      act(() => void vi.advanceTimersByTime(30_000));
      expect(announce()).toBe('');
    });

    it('says once when the section nears its time and once when it goes over', () => {
      const clock = { t: T0 + 3 * MIN };
      const agenda = at([['start', 0]]);
      const { again } = show(agenda, clock);
      expect(announce()).toBe('');
      clock.t = T0 + 4.2 * MIN;
      again(agenda);
      expect(announce()).toBe('Welcome: nearly out of time');
      again(agenda); // the same state again says it no more
      clock.t = T0 + 4.6 * MIN;
      again(agenda);
      expect(announce()).toBe('Welcome: nearly out of time');
      clock.t = T0 + 5 * MIN + 7000;
      again(agenda);
      expect(announce()).toBe('Welcome: 0:07 over time');
    });

    it('does not say "nearly out of time" again when only the status changes while still near', () => {
      const clock = { t: T0 + 4.2 * MIN };
      const { again } = show(at([['start', 0]]), clock);
      expect(announce()).toBe('');
      // The section is near; then the presenter moves on and comes back: the last thing said is the move.
      again(at([['start', 0]]));
      clock.t = T0 + 4.3 * MIN;
      again(at([['start', 0], ['next', 4.2 * MIN]]));
      clock.t = T0 + 4.4 * MIN;
      again(at([['start', 0], ['next', 4.2 * MIN], ['previous', 4.3 * MIN]]));
      expect(announce()).toBe('Now: Welcome. Section 1 of 3.');
      // Pausing changes the status, not the tier: nothing new is said.
      again(at([['start', 0], ['next', 4.2 * MIN], ['previous', 4.3 * MIN], ['pause', 4.4 * MIN]]));
      expect(announce()).toBe('Now: Welcome. Section 1 of 3.');
    });

    it('says which section it moved to, and when the agenda is complete', () => {
      const clock = { t: T0 + MIN };
      const { again } = show(at([['start', 0]]), clock);
      again(at([['start', 0], ['next', MIN]]));
      expect(announce()).toBe('Now: Demo. Section 2 of 3.');
      again(at([['start', 0], ['next', MIN], ['next', 2 * MIN], ['next', 3 * MIN]]));
      expect(announce()).toBe('The agenda is complete.');
    });

    it('uses the app\'s words', () => {
      const clock = { t: T0 + MIN };
      const { again } = show(at([['start', 0]]), clock, {
        labels: { moved: (title) => `Weiter: ${title}`, nearSaid: () => 'bald', overSaid: () => 'zu lang', doneSaid: 'Fertig' },
      });
      again(at([['start', 0], ['next', MIN]]));
      expect(announce()).toBe('Weiter: Demo');
    });
  });

  describe('prefers-reduced-motion', () => {
    const bar = () => document.querySelector('[data-slot="presenter-notes-bar"] > span')!;

    it('moves the bar with a transition by default', () => {
      show(at([['start', 0]]), { t: T0 + MIN });
      expect(bar().className).toContain('transition-transform');
      expect((bar() as HTMLElement).style.transform).toBe('scaleX(0.2)');
    });

    it('leaves the bar still under reduced motion, and the numbers say the same', () => {
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: q.includes('reduce'),
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      show(at([['start', 0]]), { t: T0 + MIN });
      expect(bar().className).not.toContain('transition');
      expect(document.querySelector('[data-slot="presenter-notes-elapsed"]')!.textContent).toBe('1:00');
    });
  });

  it('copes with a long agenda', () => {
    const many = createAgenda(Array.from({ length: 60 }, (_, i) => ({ title: `Part ${i + 1}`, plannedSeconds: 60 })));
    show(applyAgendaEvent(many, { type: 'start' }, T0), { t: T0 + 1000 });
    expect(within(screen.getByRole('list', { name: 'Agenda' })).getAllByRole('button')).toHaveLength(60);
  });

  it('renders nothing for an agenda with no sections', () => {
    const { container } = show(createAgenda([]), { t: T0 });
    expect(container.innerHTML).toBe('');
  });

  it('sets the notes large on a stage screen', () => {
    show(createAgenda(sections()), { t: T0 }, { size: 'stage' });
    expect(screen.getByRole('region', { name: 'Notes' }).className).toContain('text-2xl');
  });
});

// --- useAgenda: a second screen -------------------------------------------------------------

type Hub = ReturnType<typeof createMemoryRoomHub<AgendaMessage>>;

function Screen({
  hub,
  transport,
  initial,
  onApi,
  onChange,
  now,
}: {
  hub?: Hub;
  transport?: RoomTransport<AgendaMessage> | null;
  initial?: AgendaState;
  onApi: (api: UseAgendaResult) => void;
  onChange?: (a: AgendaState) => void;
  now?: () => number;
}) {
  const [t] = React.useState(() => (transport !== undefined ? transport : hub!.connect()));
  const api = useAgenda({ transport: t, initial, now, onChange });
  onApi(api);
  return null;
}

const settle = () => act(async () => {});

describe('useAgenda', () => {
  it('shows the controlling window\'s agenda on a second screen, and follows every change', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaResult;
    let second!: UseAgendaResult;
    render(
      <>
        <Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    expect(main.controls).toBe(true);
    expect(second.controls).toBe(false);
    expect(second.agenda?.sections).toHaveLength(3);
    await act(async () => main.send({ type: 'start' }));
    expect(second.agenda).toMatchObject({ status: 'running', seq: 1 });
    await act(async () => main.send({ type: 'next' }));
    expect(second.agenda?.current).toBe(1);
  });

  it('a screen opened late asks and is told', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaResult;
    const first = render(<Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />);
    await settle();
    await act(async () => main.send({ type: 'start' }));
    let second!: UseAgendaResult;
    first.rerender(
      <>
        <Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    expect(second.agenda).toBeNull();
    await settle();
    expect(second.agenda?.status).toBe('running');
  });

  it('applies a second screen\'s tap on the controlling window, with its clock', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaResult;
    let second!: UseAgendaResult;
    render(
      <>
        <Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0 + 5000} />
        <Screen hub={hub} onApi={(a) => (second = a)} now={() => 0} />
      </>,
    );
    await settle();
    await act(async () => second.send({ type: 'start' }));
    expect(main.agenda).toMatchObject({ status: 'running', since: T0 + 5000 });
    expect(second.agenda?.status).toBe('running');
  });

  it('applies a repeated tap once, and drops one made against an older screen', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    let main!: UseAgendaResult;
    let second!: UseAgendaResult;
    render(
      <>
        <Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    await act(async () => second.send({ type: 'start' }));
    const seq = main.agenda!.seq;
    const intent: AgendaMessage = { kind: 'agenda-intent', id: 'tap-1', seq, event: { type: 'next' } };
    await act(async () => spy.send(intent));
    expect(main.agenda?.current).toBe(1);
    await act(async () => spy.send(intent)); // the network delivers it again
    await act(async () => spy.send(intent));
    expect(main.agenda?.current).toBe(1);
    expect(main.agenda?.seq).toBe(seq + 1);
    // Made against the state before the first tap: dropped, and the screen is brought up to date.
    await act(async () => spy.send({ kind: 'agenda-intent', id: 'tap-2', seq, event: { type: 'next' } }));
    expect(main.agenda?.current).toBe(1);
    expect(second.agenda?.current).toBe(1);
  });

  it('answers a tap made against an older screen with the current state, so that screen catches up', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    const heard: AgendaMessage[] = [];
    spy.subscribe((m) => heard.push(m));
    let main!: UseAgendaResult;
    render(<Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />);
    await settle();
    await act(async () => main.send({ type: 'start' }));
    heard.length = 0;
    await act(async () => spy.send({ kind: 'agenda-intent', id: 'old-tap', seq: 0, event: { type: 'next' } }));
    expect(main.agenda?.current).toBe(0);
    const told = heard.filter((m) => m.kind === 'agenda-state');
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ state: { seq: 1, status: 'running' } });
  });

  it('keeps the newest state when messages arrive late, repeated and out of order', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let main!: UseAgendaResult;
    let second!: UseAgendaResult;
    const flaky = flakyReceiver(hub.connect());
    render(
      <>
        <Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />
        <Screen transport={flaky.transport} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    flaky.hold();
    await act(async () => main.send({ type: 'start' }));
    await act(async () => main.send({ type: 'next' }));
    await act(async () => main.send({ type: 'next' }));
    await act(async () => main.send({ type: 'pause' }));
    expect(flaky.held()).toHaveLength(4);
    expect(second.agenda?.seq).toBe(0);
    act(() => flaky.release({ order: 'reverse', repeat: 2 }));
    expect(second.agenda).toMatchObject({ seq: 4, current: 2, status: 'paused' });
    act(() => flaky.release()); // nothing more held: no change
    expect(second.agenda?.seq).toBe(4);
  });

  it('ignores a controlling window\'s intents and a second screen\'s states it should not read', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    let main!: UseAgendaResult;
    let second!: UseAgendaResult;
    render(
      <>
        <Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    await act(async () => spy.send({ kind: 'agenda-hello' }));
    await act(async () => spy.send({ kind: 'agenda-intent', id: 'x', seq: 0, event: { type: 'start' } }));
    expect(second.agenda?.status).toBe('running'); // the screen followed, because the main window applied it
    // A second screen ignores another screen's intent and hello (only the controlling window answers them).
    const seq = second.agenda!.seq;
    await act(async () => spy.send({ kind: 'agenda-hello' }));
    expect(second.agenda?.seq).toBe(seq);
    expect(main.agenda?.seq).toBe(seq);
  });

  it('follows a controlling window that comes back after a refresh, with or without a saved agenda', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const storage = new Map<string, string>();
    const store = createAgendaStore(
      { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) },
      'agenda',
    );
    let second!: UseAgendaResult;
    let main!: UseAgendaResult;
    const clock = { t: T0 };
    const boot = (initial: AgendaState) => (
      <>
        <Screen key={String(initial.seq)} hub={hub} initial={initial} onApi={(a) => (main = a)} onChange={store.save} now={() => clock.t} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>
    );
    const view = render(boot(createAgenda(sections())));
    await settle();
    await act(async () => main.send({ type: 'start' }));
    await act(async () => main.send({ type: 'next' }));
    expect(store.load()?.current).toBe(1);
    // The presenter's page is refreshed: the saved agenda comes back, with the clock still running.
    clock.t = T0 + 3 * MIN;
    view.unmount();
    const restored = store.load()!;
    render(boot(restored));
    await settle();
    expect(main.agenda).toMatchObject({ current: 1, status: 'running' });
    expect(second.agenda?.seq).toBe(restored.seq);
    expect(second.agenda?.current).toBe(1);
    await act(async () => main.send({ type: 'next' }));
    expect(second.agenda?.current).toBe(2);
  });

  it('follows a controlling window that restarts with nothing saved, though its seq starts again', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let second!: UseAgendaResult;
    let main!: UseAgendaResult;
    const view = render(
      <>
        <Screen key="a" hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    for (let i = 0; i < 3; i++) await act(async () => main.send({ type: i === 0 ? 'start' : 'next' }));
    expect(second.agenda?.seq).toBe(3);
    view.rerender(
      <>
        <Screen key="b" hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    expect(second.agenda).toMatchObject({ seq: 0, status: 'idle', current: 0 });
    await act(async () => main.send({ type: 'start' }));
    expect(second.agenda?.status).toBe('running');
  });

  it('reads the controlling window\'s clock: a second screen with the wrong clock agrees', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    let second!: UseAgendaResult;
    let main!: UseAgendaResult;
    const real = Date.now();
    render(
      <>
        <Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => real + 90_000} />
        <Screen hub={hub} onApi={(a) => (second = a)} />
      </>,
    );
    await settle();
    await act(async () => main.send({ type: 'start' }));
    expect(main.now()).toBe(real + 90_000);
    expect(second.now() - Date.now()).toBeGreaterThan(89_000);
    expect(second.now() - Date.now()).toBeLessThanOrEqual(90_000);
  });

  it('does nothing without a transport, and a second screen with no agenda yet sends nothing', async () => {
    let alone!: UseAgendaResult;
    const hub = createMemoryRoomHub<AgendaMessage>();
    let blank!: UseAgendaResult;
    render(
      <>
        <Screen transport={null} initial={createAgenda(sections())} onApi={(a) => (alone = a)} />
        <Screen hub={hub} onApi={(a) => (blank = a)} />
      </>,
    );
    await act(async () => alone.send({ type: 'start' }));
    expect(alone.agenda?.status).toBe('running'); // a presenter alone on one screen still works
    await act(async () => blank.send({ type: 'start' }));
    expect(blank.agenda).toBeNull();
    const none = vi.fn();
    render(<Screen hub={hub} onApi={none} initial={createAgenda([])} />);
    await act(async () => none.mock.calls.at(-1)![0].send({ type: 'start' }));
  });

  it('remembers a bounded number of taps', async () => {
    const hub = createMemoryRoomHub<AgendaMessage>();
    const spy = hub.connect();
    let main!: UseAgendaResult;
    render(<Screen hub={hub} initial={createAgenda(sections())} onApi={(a) => (main = a)} now={() => T0} />);
    await settle();
    for (let i = 0; i < 250; i++) {
      await act(async () =>
        spy.send({ kind: 'agenda-intent', id: `t${i}`, seq: main.agenda!.seq, event: { type: 'add-time', seconds: i % 2 ? -1 : 1 } }),
      );
    }
    expect(main.agenda!.seq).toBe(250);
  });

  it('keeps the agenda it was restored from intact, over a real save', () => {
    const a = at([['start', 0]]);
    expect(restoreAgenda(serializeAgenda(a))?.sections).toEqual(a.sections);
  });
});
