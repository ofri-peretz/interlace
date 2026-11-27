/**
 * PairHost and PairCard: pairing, the card each pair gets, swapping partners, and what a phone
 * shows, says and does.
 */
import * as React from 'react';
import axe from 'axe-core';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyRoomEvent, createRoom, type RoomHostEvent, type RoomState } from '../src/games/room-model.js';
import { seededRandom } from '../src/games/group-model.js';
import { PairCard, PairHost } from '../src/games/pair-talk.js';
import { newCard, pairsEvent, partnerOf, readPairs, startPairs, swapPartners, type PairsState } from '../src/games/pair-model.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

const HOST = 'host';
const NOW = 3_000_000;
const DECK = ['Best trip?', 'A tool you love?', 'Hardest bug?', 'Favourite meeting?'];

function roomOf(n: number): RoomState {
  let r = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  for (let i = 0; i < n; i++) r = applyRoomEvent(r, { type: 'join', playerId: `p${i}`, name: `Player ${i}` }, `p${i}`);
  return r;
}
const withPairs = (room: RoomState, state: PairsState | null) => applyRoomEvent(room, pairsEvent(state), HOST);

function paired(n = 6, seconds: number | null = 300) {
  const room = roomOf(n);
  const state = startPairs(room.players, DECK, { now: NOW, seconds, random: seededRandom(3) })!;
  return { room: withPairs(room, state), state };
}

function Wired({ start, extra }: { start: RoomState; extra?: Partial<React.ComponentProps<typeof PairHost>> }) {
  const [room, setRoom] = React.useState(start);
  const sends = React.useRef(0);
  const send = React.useCallback((e: RoomHostEvent) => {
    sends.current++;
    setRoom((r) => applyRoomEvent(r, e, HOST));
  }, []);
  return (
    <>
      <PairHost room={room} send={send} prompts={DECK} now={() => NOW} random={seededRandom(2)} {...extra} />
      <output data-testid="sends">{sends.current}</output>
      <output data-testid="state">{JSON.stringify(readPairs(room))}</output>
      <button type="button" onClick={() => setRoom((r) => applyRoomEvent(r, { type: 'join', playerId: 'late', name: 'Late Larry' }, 'late'))}>
        late join
      </button>
    </>
  );
}
const stateOut = () => JSON.parse(screen.getByTestId('state').textContent!) as PairsState | null;

describe('PairHost', () => {
  it('starts pairing for the players who are here, with the time chosen', async () => {
    const send = vi.fn();
    render(<PairHost room={roomOf(7)} send={send} prompts={DECK} now={() => NOW} random={seededRandom(1)} />);
    expect(screen.getByRole('region', { name: 'Pair talk' }).getAttribute('data-state')).toBe('none');
    await userEvent.selectOptions(screen.getByLabelText('Time for each round'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Start pairing' }));
    const state = (send.mock.calls[0]![0] as { value: PairsState }).value;
    expect(state).toMatchObject({ round: 1, startedAt: NOW, endsAt: NOW + 180_000 });
    expect(state.pairs.map((p) => p.members.length).sort()).toEqual([2, 2, 3]);
    expect(state.deck).toEqual(DECK);
  });

  it('needs two players, and can run without a timer', async () => {
    const send = vi.fn();
    const { rerender } = render(<PairHost room={roomOf(1)} send={send} prompts={DECK} />);
    expect((screen.getByRole('button', { name: 'Start pairing' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Needs at least 2 players.')).toBeTruthy();
    const away = applyRoomEvent(roomOf(3), { type: 'leave', playerId: 'p0' }, 'p0');
    rerender(<PairHost room={applyRoomEvent(away, { type: 'leave', playerId: 'p1' }, 'p1')} send={send} prompts={DECK} />);
    expect((screen.getByRole('button', { name: 'Start pairing' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    render(<PairHost room={roomOf(4)} send={send} prompts={DECK} defaultMinutes={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start pairing' }));
    expect((send.mock.calls[0]![0] as { value: PairsState }).value.endsAt).toBeNull();
  });

  it('shows the round, the time and every pair with its card', () => {
    const { room, state } = paired(6, 300);
    render(<PairHost room={room} send={() => {}} prompts={DECK} now={() => NOW + 60_000} />);
    expect(screen.getByText('Round 1')).toBeTruthy();
    expect(screen.getByRole('timer', { name: 'Time left' }).textContent).toContain('4:00');
    const pairs = document.querySelectorAll('[data-slot="pair-host-pair"]');
    expect(pairs).toHaveLength(3);
    expect(pairs[0]!.textContent).toContain(state.pairs[0]!.prompt);
    expect(screen.getAllByRole('button', { name: /^New card for / })).toHaveLength(3);
  });

  it('swaps partners: a new round, new pairs, and says so', async () => {
    const { room } = paired(8);
    render(<Wired start={room} />);
    const before = stateOut()!;
    await userEvent.click(screen.getByRole('button', { name: 'Swap partners' }));
    const after = stateOut()!;
    expect(after.round).toBe(2);
    expect(after.startedAt).toBe(NOW);
    expect(screen.getByText('Round 2')).toBeTruthy();
    const key = (s: PairsState) => s.pairs.map((p) => [...p.members].sort().join('|')).sort();
    expect(key(after).filter((k) => key(before).includes(k))).toEqual([]);
    expect(document.querySelector('[data-slot="pair-host-announce"]')!.textContent).toBe('Partners swapped. Round 2, 4 pairs.');
  });

  it('swaps only among the players who are here', async () => {
    const away = applyRoomEvent(paired(6).room, { type: 'leave', playerId: 'p5' }, 'p5');
    render(<Wired start={away} />);
    await userEvent.click(screen.getByRole('button', { name: 'Swap partners' }));
    expect(stateOut()!.pairs.flatMap((p) => p.members)).not.toContain('p5');
    expect(stateOut()!.pairs.flatMap((p) => p.members).sort()).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
  });

  it('pairs a player who comes back after the swap', async () => {
    const away = applyRoomEvent(paired(6).room, { type: 'leave', playerId: 'p5' }, 'p5');
    function Back() {
      const [room, setRoom] = React.useState(away);
      const send = (e: RoomHostEvent) => setRoom((r) => applyRoomEvent(r, e, HOST));
      return (
        <>
          <PairHost room={room} send={send} prompts={DECK} random={seededRandom(1)} />
          <output data-testid="state">{JSON.stringify(readPairs(room))}</output>
          <button type="button" onClick={() => setRoom((r) => applyRoomEvent(r, { type: 'join', playerId: 'p5', name: 'Player 5' }, 'p5'))}>
            back
          </button>
        </>
      );
    }
    render(<Back />);
    await userEvent.click(screen.getByRole('button', { name: 'Swap partners' }));
    expect(partnerOf(stateOut()!, 'p5')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(partnerOf(stateOut()!, 'p5')).not.toBeNull();
  });

  it('gives a pair a new card, a minute more, and stops', async () => {
    const { room } = paired(6, 60);
    render(<Wired start={room} />);
    const before = stateOut()!;
    await userEvent.click(screen.getAllByRole('button', { name: /^New card for / })[0]!);
    expect(stateOut()!.pairs[0]!.prompt).not.toBe(before.pairs[0]!.prompt);
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 minute' }));
    expect(stateOut()!.endsAt).toBe(before.endsAt! + 60_000);
    await userEvent.click(screen.getByRole('button', { name: 'Stop pair talk' }));
    expect(stateOut()).toBeNull();
    expect(screen.getByRole('region', { name: 'Pair talk' }).getAttribute('data-state')).toBe('none');
  });

  it('has no new-card button when there is no deck, and shows a lone player waiting', () => {
    const room = roomOf(1);
    const state = startPairs(room.players, [], { now: NOW })!;
    render(<PairHost room={withPairs(room, state)} send={() => {}} prompts={[]} />);
    expect(screen.queryByRole('button', { name: /New card/ })).toBeNull();
    expect(document.querySelector('[data-slot="pair-host-pair"]')!.textContent).toContain('Waiting for a partner');
  });

  it('pairs someone who joins late, once, and not when told not to', async () => {
    const { room } = paired(6);
    render(<Wired start={room} />);
    const before = Number(screen.getByTestId('sends').textContent);
    await userEvent.click(screen.getByRole('button', { name: 'late join' }));
    expect(partnerOf(stateOut()!, 'late')).not.toBeNull();
    expect(Number(screen.getByTestId('sends').textContent)).toBe(before + 1);
    cleanup();
    render(<Wired start={room} extra={{ autoPlace: false }} />);
    await userEvent.click(screen.getByRole('button', { name: 'late join' }));
    expect(partnerOf(stateOut()!, 'late')).toBeNull();
  });

  it('lists 40 players as 20 pairs, a group of three for an odd room, and marks anyone away', () => {
    const { room } = paired(41);
    const away = applyRoomEvent(room, { type: 'leave', playerId: 'p0' }, 'p0');
    render(<PairHost room={away} send={() => {}} prompts={DECK} />);
    const pairs = document.querySelectorAll('[data-slot="pair-host-pair"]');
    expect(pairs).toHaveLength(20);
    expect([...pairs].filter((p) => p.getAttribute('data-size') === '3')).toHaveLength(1);
    expect(document.body.textContent).toContain('away');
  });

  it('uses the app\'s words', () => {
    const { room } = paired(4);
    render(<PairHost room={room} send={() => {}} prompts={DECK} labels={{ name: 'Paare', swap: 'Tauschen', round: (r) => `Runde ${r}`, newCardText: 'Neue Karte' }} />);
    expect(screen.getByRole('region', { name: 'Paare' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tauschen' })).toBeTruthy();
    expect(screen.getByText('Runde 1')).toBeTruthy();
    expect(screen.getAllByText('Neue Karte').length).toBe(2);
  });

  it('has no accessibility violations a DOM check can find', async () => {
    const { container } = render(<PairHost room={paired(8).room} send={() => {}} prompts={DECK} />);
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations.map((v) => v.id)).toEqual([]);
    cleanup();
    const setup = render(<PairHost room={roomOf(4)} send={() => {}} prompts={DECK} />);
    expect((await axe.run(setup.container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});

describe('PairCard', () => {
  it('shows nothing before there are pairs', () => {
    expect(render(<PairCard room={roomOf(3)} selfId="p0" />).container.innerHTML).toBe('');
    cleanup();
    expect(render(<PairCard room={null} selfId="p0" />).container.innerHTML).toBe('');
  });

  it('shows the round, the partner, the card and the time left', () => {
    const { room, state } = paired(6, 300);
    render(<PairCard room={room} selfId="p0" now={() => NOW + 30_000} />);
    const mine = partnerOf(state, 'p0')!;
    const partner = room.players.find((p) => p.id === mine.partners[0])!.name;
    expect(screen.getByRole('heading', { name: `Your partner is ${partner}` })).toBeTruthy();
    expect(screen.getByText('Round 1')).toBeTruthy();
    expect(document.querySelector('[data-slot="pair-card-prompt"]')!.textContent).toContain(mine.pair.prompt);
    expect(screen.getByRole('timer', { name: 'Time left' }).textContent).toContain('4:30');
    expect(screen.getByRole('region').getAttribute('data-state')).toBe('paired');
  });

  it('names both others in a group of three, and says when one is away', () => {
    const { room, state } = paired(5);
    const trio = state.pairs.find((p) => p.members.length === 3)!;
    const me = trio.members[0]!;
    const away = applyRoomEvent(room, { type: 'leave', playerId: trio.members[1]! }, trio.members[1]!);
    render(<PairCard room={away} selfId={me} />);
    expect(screen.getByRole('heading').textContent).toMatch(/^Your group is .+ and .+/);
    expect(screen.getByRole('heading').textContent).toContain('away');
  });

  it('keeps a lone player waiting, with the card, and has no card without a deck', () => {
    const room = roomOf(1);
    const state = startPairs(room.players, [], { now: NOW })!;
    render(<PairCard room={withPairs(room, state)} selfId="p0" />);
    expect(screen.getByRole('heading').textContent).toBe('Waiting for a partner');
    expect(document.querySelector('[data-slot="pair-card-prompt"]')).toBeNull();
    expect(screen.getByRole('region').getAttribute('data-state')).toBe('waiting');
  });

  it('says it is waiting for someone who has no pair yet', () => {
    const { room } = paired(4);
    render(<PairCard room={applyRoomEvent(room, { type: 'join', playerId: 'late', name: 'Late' }, 'late')} selfId="late" />);
    expect(screen.getByRole('heading').textContent).toBe('Waiting for a partner');
  });

  it('says time is up in words', () => {
    const { room } = paired(4, 60);
    render(<PairCard room={room} selfId="p0" now={() => NOW + 61_000} />);
    expect(screen.getByRole('timer').textContent).toContain('Time is up. Wait for the host.');
  });

  it('puts the round, partner and card in one status region, so a swap is read once', () => {
    const { room, state } = paired(6);
    const swapped = swapPartners(state, room.players, { now: NOW + 1000, random: seededRandom(8) })!;
    const { rerender } = render(<PairCard room={room} selfId="p0" />);
    const live = document.querySelector('[data-slot="pair-card-live"]')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.textContent).toContain('Round 1');
    expect(within(live as HTMLElement).queryByRole('timer')).toBeNull(); // the clock is outside it
    rerender(<PairCard room={withPairs(room, swapped)} selfId="p0" />);
    expect(live.textContent).toContain('Round 2');
  });

  describe('prefers-reduced-motion', () => {
    const swap = () => {
      const animate = vi.fn();
      HTMLElement.prototype.animate = animate as never;
      const { room, state } = paired(6);
      const { rerender } = render(<PairCard room={room} selfId="p0" />);
      rerender(<PairCard room={withPairs(room, swapPartners(state, room.players, { now: NOW, random: seededRandom(8) }))} selfId="p0" />);
      rerender(<PairCard room={withPairs(room, newCard(readPairs(withPairs(room, swapPartners(state, room.players, { now: NOW, random: seededRandom(8) })))!, 'a1', seededRandom(1)))} selfId="p0" />);
      return animate;
    };

    it('pulses the box when the partner or card changes, never on the first look', () => {
      const animate = swap();
      expect(animate).toHaveBeenCalled();
      expect(animate.mock.calls[0]![0]).toEqual([{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }]);
    });

    it('does not move under reduced motion', () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }));
      expect(swap()).not.toHaveBeenCalled();
    });

    it('does not pulse for a phone that opens on a card already there', () => {
      const animate = vi.fn();
      HTMLElement.prototype.animate = animate as never;
      render(<PairCard room={paired(6).room} selfId="p0" />);
      expect(animate).not.toHaveBeenCalled();
    });
  });

  it('uses the app\'s words', () => {
    const { room } = paired(4);
    render(<PairCard room={room} selfId="p0" labels={{ partner: (n) => `Dein Partner: ${n}`, round: (r) => `Runde ${r}`, card: 'Karte' }} />);
    expect(screen.getByRole('heading').textContent).toMatch(/^Dein Partner: /);
    expect(screen.getByText('Karte')).toBeTruthy();
  });

  it('has no accessibility violations a DOM check can find', async () => {
    const { container } = render(<PairCard room={paired(6).room} selfId="p0" />);
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations.map((v) => v.id)).toEqual([]);
  });
});
