/**
 * BreakoutHost and BreakoutCard: opening groups, the message to every group, the recall, and what
 * a phone shows, says and does when states arrive twice, late or out of order.
 */
import * as React from 'react';
import axe from 'axe-core';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyRoomEvent, createRoom, type RoomHostEvent, type RoomState } from '../src/games/room-model.js';
import { seededRandom } from '../src/games/group-model.js';
import { BreakoutCard, BreakoutHost } from '../src/games/breakout-room.js';
import {
  breakoutsEvent,
  broadcast,
  groupOf,
  openBreakouts,
  readBreakouts,
  recallBreakouts,
  type BreakoutsState,
} from '../src/games/breakout-model.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const HOST = 'host';
const NOW = 2_000_000;

function roomOf(n: number): RoomState {
  let r = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  for (let i = 0; i < n; i++) r = applyRoomEvent(r, { type: 'join', playerId: `p${i}`, name: `Player ${i}` }, `p${i}`);
  return r;
}

const withState = (room: RoomState, state: BreakoutsState | null) => applyRoomEvent(room, breakoutsEvent(state), HOST);

function opened(n = 6, groups = 2, seconds: number | null = 600) {
  const room = roomOf(n);
  const state = openBreakouts(room.players, { groups, seconds, now: NOW, random: seededRandom(5) })!;
  return { room: withState(room, state), state };
}

function Wired({ start, extra }: { start: RoomState; extra?: Partial<React.ComponentProps<typeof BreakoutHost>> }) {
  const [room, setRoom] = React.useState(start);
  const sends = React.useRef(0);
  const send = React.useCallback((e: RoomHostEvent) => {
    sends.current++;
    setRoom((r) => applyRoomEvent(r, e, HOST));
  }, []);
  return (
    <>
      <BreakoutHost room={room} send={send} now={() => NOW} random={seededRandom(2)} {...extra} />
      <output data-testid="sends">{sends.current}</output>
      <output data-testid="state">{JSON.stringify(readBreakouts(room))}</output>
      <button type="button" onClick={() => setRoom((r) => applyRoomEvent(r, { type: 'join', playerId: 'late', name: 'Late Larry' }, 'late'))}>
        late join
      </button>
    </>
  );
}
const stateOut = () => JSON.parse(screen.getByTestId('state').textContent!) as BreakoutsState | null;

describe('BreakoutHost', () => {
  it('opens groups of the size and time chosen, split from the players who are here', async () => {
    const send = vi.fn();
    render(<BreakoutHost room={roomOf(9)} send={send} now={() => NOW} random={seededRandom(1)} />);
    expect(screen.getByRole('region', { name: 'Breakouts' }).getAttribute('data-state')).toBe('none');
    await userEvent.selectOptions(screen.getByLabelText('Number of groups'), '3');
    await userEvent.selectOptions(screen.getByLabelText('Time for each group'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Open breakouts' }));
    const state = (send.mock.calls[0]![0] as { value: BreakoutsState }).value;
    expect(state).toMatchObject({ status: 'open', startedAt: NOW, endsAt: NOW + 300_000 });
    expect(state.groups).toHaveLength(3);
    expect(Object.keys(state.members)).toHaveLength(9);
  });

  it('can open without a timer, and not at all with nobody here', async () => {
    const send = vi.fn();
    const { rerender } = render(<BreakoutHost room={roomOf(0)} send={send} />);
    expect((screen.getByRole('button', { name: 'Open breakouts' }) as HTMLButtonElement).disabled).toBe(true);
    const away = applyRoomEvent(roomOf(2), { type: 'leave', playerId: 'p0' }, 'p0');
    rerender(<BreakoutHost room={applyRoomEvent(away, { type: 'leave', playerId: 'p1' }, 'p1')} send={send} />);
    expect((screen.getByRole('button', { name: 'Open breakouts' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    render(<BreakoutHost room={roomOf(4)} send={send} defaultMinutes={0} defaultGroups={2} now={() => NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open breakouts' }));
    expect((send.mock.calls[0]![0] as { value: BreakoutsState }).value.endsAt).toBeNull();
  });

  it('shows every group with its people, and moves someone by a select', async () => {
    const { room, state } = opened(6, 3);
    const send = vi.fn();
    render(<BreakoutHost room={room} send={send} autoPlace={false} />);
    const groups = document.querySelectorAll('[data-slot="breakout-host-group"]');
    expect(groups).toHaveLength(3);
    expect(within(groups[0] as HTMLElement).getByText('2 people')).toBeTruthy();
    const select = screen.getByLabelText('Move Player 0 to') as HTMLSelectElement;
    const to = select.value === 'g1' ? 'g2' : 'g1';
    await userEvent.selectOptions(select, to);
    expect(groupOf((send.mock.calls[0]![0] as { value: BreakoutsState }).value, 'p0')!.id).toBe(to);
    expect(state.groups.map((g) => g.name)).toEqual(['Group 1', 'Group 2', 'Group 3']);
  });

  it('shows the time left, and gives two minutes more', async () => {
    const { room, state } = opened(4, 2, 300);
    const send = vi.fn();
    render(<BreakoutHost room={room} send={send} now={() => NOW + 60_000} />);
    expect(screen.getByRole('timer', { name: 'Time left' }).textContent).toContain('4:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 minutes' }));
    expect((send.mock.calls[0]![0] as { value: BreakoutsState }).value.endsAt).toBe(state.endsAt! + 120_000);
  });

  it('sends a message to every group, keeps the box tidy and says it was sent', async () => {
    const { room } = opened(6, 3);
    render(<Wired start={room} />);
    const box = screen.getByLabelText('Message to every group') as HTMLTextAreaElement;
    const send = screen.getByRole('button', { name: 'Send to all groups' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    expect(screen.getByText('280 characters left')).toBeTruthy();
    await userEvent.type(box, 'Wrap up in two minutes');
    expect(screen.getByText('258 characters left')).toBeTruthy();
    expect(box.getAttribute('maxlength')).toBe('280');
    await userEvent.click(send);
    expect(stateOut()!.message).toMatchObject({ n: 1, text: 'Wrap up in two minutes', at: NOW });
    expect(box.value).toBe('');
    expect(document.querySelector('[data-slot="breakout-host-announce"]')!.textContent).toBe('Message sent to 3 groups');
    expect(screen.getByText('Last message: Wrap up in two minutes')).toBeTruthy();
    await userEvent.type(box, '   ');
    expect((screen.getByRole('button', { name: 'Send to all groups' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('can be driven by the keyboard alone, from the box to the send button', async () => {
    const { room } = opened(4, 2);
    render(<Wired start={room} />);
    await userEvent.click(screen.getByLabelText('Message to every group'));
    await userEvent.keyboard('Time check');
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send to all groups' }));
    await userEvent.keyboard('{Enter}');
    expect(stateOut()!.message?.text).toBe('Time check');
  });

  it('does not send a message that is only spaces, even by submitting the form', () => {
    const { room } = opened(4, 2);
    render(<Wired start={room} />);
    const form = document.querySelector('[data-slot="breakout-host-message"]') as HTMLFormElement;
    form.requestSubmit();
    expect(Number(screen.getByTestId('sends').textContent)).toBe(0);
  });

  it('recalls everyone, then sends them out again with a fresh timer, or closes', async () => {
    const { room } = opened(4, 2, 600);
    render(<Wired start={room} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bring everyone back' }));
    expect(stateOut()).toMatchObject({ status: 'recalled', endsAt: null, recalledAt: NOW });
    expect(screen.getByText('Everyone is back in the main room.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Breakouts' }).getAttribute('data-state')).toBe('recalled');
    await userEvent.click(screen.getByRole('button', { name: 'Send them out again' }));
    expect(stateOut()).toMatchObject({ status: 'open', startedAt: NOW, endsAt: NOW + 600_000, recalledAt: null });
    await userEvent.click(screen.getByRole('button', { name: 'Bring everyone back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close breakouts' }));
    expect(stateOut()).toBeNull();
    expect(screen.getByRole('region', { name: 'Breakouts' }).getAttribute('data-state')).toBe('none');
  });

  it('puts someone who joins late in the smallest group, once, and not when told not to', async () => {
    const { room } = opened(6, 3);
    render(<Wired start={room} />);
    const before = Number(screen.getByTestId('sends').textContent);
    await userEvent.click(screen.getByRole('button', { name: 'late join' }));
    expect(groupOf(stateOut()!, 'late')).not.toBeNull();
    expect(Number(screen.getByTestId('sends').textContent)).toBe(before + 1);
    cleanup();
    render(<Wired start={room} extra={{ autoPlace: false }} />);
    await userEvent.click(screen.getByRole('button', { name: 'late join' }));
    expect(groupOf(stateOut()!, 'late')).toBeNull();
  });

  it('leaves a player who is away out of the split, and puts them in a group when they are back', async () => {
    const away = applyRoomEvent(roomOf(6), { type: 'leave', playerId: 'p5' }, 'p5');
    const state = openBreakouts(away.players.filter((p) => p.connected), { groups: 2, now: NOW, random: seededRandom(1) })!;
    function Back() {
      const [room, setRoom] = React.useState(withState(away, state));
      const send = (e: RoomHostEvent) => setRoom((r) => applyRoomEvent(r, e, HOST));
      return (
        <>
          <BreakoutHost room={room} send={send} />
          <output data-testid="state">{JSON.stringify(readBreakouts(room))}</output>
          <button type="button" onClick={() => setRoom((r) => applyRoomEvent(r, { type: 'join', playerId: 'p5', name: 'Player 5' }, 'p5'))}>
            back
          </button>
        </>
      );
    }
    render(<Back />);
    expect(groupOf(stateOut()!, 'p5')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(groupOf(stateOut()!, 'p5')).not.toBeNull();
  });

  it('lists 40 people in their groups, each with a labelled select', () => {
    const { room } = opened(40, 8);
    render(<BreakoutHost room={room} send={() => {}} />);
    expect(screen.getAllByRole('combobox', { name: /^Move Player/ })).toHaveLength(40);
    expect(document.querySelectorAll('[data-slot="breakout-host-group"]')).toHaveLength(8);
  });

  it('marks a player who is away, and uses the app\'s words', () => {
    const { room } = opened(4, 2);
    const away = applyRoomEvent(room, { type: 'leave', playerId: 'p1' }, 'p1');
    render(<BreakoutHost room={away} send={() => {}} labels={{ name: 'Gruppen', recall: 'Zurückholen', away: 'weg', size: (n) => `${n} Leute` }} />);
    expect(screen.getByRole('region', { name: 'Gruppen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zurückholen' })).toBeTruthy();
    expect(document.querySelector('[data-player-id="p1"]')!.textContent).toContain('weg');
    expect(screen.getAllByText('2 Leute').length).toBe(2);
  });

  it('has no accessibility violations a DOM check can find', async () => {
    const { container } = render(<BreakoutHost room={opened(8, 2).room} send={() => {}} />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
    cleanup();
    const setup = render(<BreakoutHost room={roomOf(3)} send={() => {}} />);
    expect((await axe.run(setup.container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});

describe('BreakoutCard', () => {
  it('shows nothing before there are breakouts', () => {
    const { container } = render(<BreakoutCard room={roomOf(3)} selfId="p0" />);
    expect(container.innerHTML).toBe('');
    cleanup();
    expect(render(<BreakoutCard room={null} selfId="p0" />).container.innerHTML).toBe('');
  });

  it('shows the player\'s group, who is in it, and the time left', () => {
    const { room } = opened(6, 2, 600);
    render(<BreakoutCard room={room} selfId="p3" now={() => NOW + 30_000} />);
    const mine = groupOf(readBreakouts(room)!, 'p3')!;
    expect(screen.getByRole('heading', { name: `You are in ${mine.name}` })).toBeTruthy();
    expect(screen.getByRole('timer', { name: 'Time left' }).textContent).toContain('9:30');
    const members = within(document.querySelector('[data-slot="breakout-card-members"]') as HTMLElement).getAllByRole('listitem');
    expect(members).toHaveLength(3);
    expect(document.querySelector('[data-self]')!.textContent).toContain('Player 3');
    expect(document.querySelector('[data-self]')!.textContent).toContain('You');
    expect(screen.getByRole('region', { name: mine.name }).getAttribute('data-state')).toBe('open');
  });

  it('marks a groupmate who is away', () => {
    const { room } = opened(4, 1);
    const away = applyRoomEvent(room, { type: 'leave', playerId: 'p2' }, 'p2');
    render(<BreakoutCard room={away} selfId="p0" />);
    expect(document.querySelector('[data-away]')!.textContent).toContain('away');
  });

  it('says the time is up, in words', () => {
    const { room } = opened(4, 2, 60);
    render(<BreakoutCard room={room} selfId="p0" now={() => NOW + 61_000} />);
    expect(screen.getByRole('timer').textContent).toContain('Time is up. Wait for the host.');
  });

  it('says it is finding a group for someone not placed yet, and has no timer without one', () => {
    const { room } = opened(4, 2, null);
    const room2 = applyRoomEvent(room, { type: 'join', playerId: 'late', name: 'Late' }, 'late');
    render(<BreakoutCard room={room2} selfId="late" />);
    expect(screen.getByRole('status').textContent).toBe('Finding your group…');
    expect(screen.getByRole('region').getAttribute('data-state')).toBe('waiting');
    cleanup();
    render(<BreakoutCard room={room} selfId="p0" />);
    expect(screen.getByRole('timer').textContent).toContain('No timer');
  });

  it('says plainly that everyone is called back', () => {
    const { room, state } = opened(4, 2);
    render(<BreakoutCard room={withState(room, recallBreakouts(state, NOW + 5))} selfId="p0" />);
    const note = document.querySelector('[data-slot="breakout-card-recalled"]')!;
    expect(note.getAttribute('role')).toBe('status');
    expect(note.getAttribute('aria-live')).toBe('assertive');
    expect(note.textContent).toContain('Back in the main room');
    expect(screen.getByRole('region').getAttribute('data-state')).toBe('recalled');
  });

  describe('the host\'s message', () => {
    const message = () => document.querySelector('[data-slot="breakout-card-message"]') as HTMLElement;

    it('is a status region that is there, empty, from the start, so a new message is spoken', () => {
      const { room } = opened(4, 2);
      render(<BreakoutCard room={room} selfId="p0" />);
      expect(message().getAttribute('role')).toBe('status');
      expect(message().textContent).toBe('');
    });

    it('shows the newest message, keeps it when an older state arrives late, and clears it with a new session', () => {
      const { room, state } = opened(4, 2);
      const second = broadcast(broadcast(state, 'First', NOW + 1), 'Second', NOW + 2);
      const first = broadcast(state, 'First', NOW + 1);
      const view = (s: BreakoutsState) => <BreakoutCard room={withState(room, s)} selfId="p0" />;
      const { rerender } = render(view(state));
      rerender(view(first));
      expect(message().textContent).toContain('First');
      rerender(view(second));
      expect(message().textContent).toContain('Second');
      expect(message().textContent).toContain('Message from the host');
      rerender(view(first)); // a delayed older state
      expect(message().textContent).toContain('Second');
      rerender(view(state)); // a delayed state from before any message
      expect(message().textContent).toContain('Second');
      rerender(view(second)); // the same state again
      expect(message().textContent).toContain('Second');
      // The host sends everyone out again: a new session starts at message 1 and replaces it.
      const again = broadcast({ ...state, startedAt: NOW + 9_000 }, 'New round', NOW + 9_001);
      rerender(view(again));
      expect(message().textContent).toContain('New round');
      rerender(view({ ...again, message: null }));
      expect(message().textContent).toContain('New round');
      // A recall clears it.
      rerender(view(recallBreakouts(again, NOW + 10_000)));
      expect(document.querySelector('[data-slot="breakout-card-message"]')).toBeNull();
    });

    it('does not say a message again when the same state is shown twice, and clears on recall', () => {
      const { room, state } = opened(4, 2);
      const sent = broadcast(state, 'Hello', NOW + 1);
      const { rerender } = render(<BreakoutCard room={withState(room, sent)} selfId="p0" />);
      const el = message();
      const observer = vi.fn();
      const watch = new MutationObserver(observer);
      watch.observe(el, { childList: true, subtree: true, characterData: true });
      rerender(<BreakoutCard room={withState(room, sent)} selfId="p0" />);
      rerender(<BreakoutCard room={withState(room, { ...sent })} selfId="p0" />);
      expect(watch.takeRecords()).toEqual([]);
      watch.disconnect();
      rerender(<BreakoutCard room={withState(room, recallBreakouts(sent, NOW + 3))} selfId="p0" />);
      expect(document.querySelector('[data-slot="breakout-card-message"]')).toBeNull();
    });

    it('shows a message already sent to a phone that joined late, without a pulse', () => {
      const animate = vi.fn();
      HTMLElement.prototype.animate = animate as never;
      const { room, state } = opened(4, 2);
      render(<BreakoutCard room={withState(room, broadcast(state, 'Already here', NOW + 1))} selfId="p0" />);
      expect(message().textContent).toContain('Already here');
      expect(animate).not.toHaveBeenCalled();
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    });
  });

  describe('prefers-reduced-motion', () => {
    const arrive = () => {
      const animate = vi.fn();
      HTMLElement.prototype.animate = animate as never;
      const { room, state } = opened(4, 2);
      const view = (s: BreakoutsState) => <BreakoutCard room={withState(room, s)} selfId="p0" />;
      const { rerender } = render(view(state));
      rerender(view(broadcast(state, 'One', NOW + 1)));
      rerender(view(broadcast(broadcast(state, 'One', NOW + 1), 'Two', NOW + 2)));
      return animate;
    };
    afterEach(() => void delete (HTMLElement.prototype as { animate?: unknown }).animate);

    it('pulses the box once for each new message', () => {
      const animate = arrive();
      expect(animate).toHaveBeenCalledTimes(2);
      expect(animate.mock.calls[0]![0]).toEqual([{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }]);
    });

    it('does not move at all under reduced motion, and still shows the message', () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }));
      const animate = arrive();
      expect(animate).not.toHaveBeenCalled();
      expect(document.querySelector('[data-slot="breakout-card-message"]')!.textContent).toContain('Two');
    });
  });

  it('uses the app\'s words', () => {
    const { room } = opened(4, 2);
    render(<BreakoutCard room={room} selfId="p0" labels={{ in: (g) => `Du bist in ${g}`, members: 'In deiner Gruppe', you: 'Du' }} />);
    expect(screen.getByRole('heading', { name: /^Du bist in Group/ })).toBeTruthy();
    expect(screen.getByText('In deiner Gruppe')).toBeTruthy();
  });

  it('has no accessibility violations a DOM check can find', async () => {
    const { room, state } = opened(6, 2);
    const { container } = render(<BreakoutCard room={withState(room, broadcast(state, 'Hello', NOW))} selfId="p0" />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
