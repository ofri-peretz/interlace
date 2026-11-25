/**
 * Who gets into a live room: a code that expires, a cap on guessing, and the
 * host's clock deciding when a join arrived.
 */
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyRoomEvent,
  checkJoinAttempt,
  codeExpired,
  createJoinGuard,
  createMemoryRoomHub,
  createRoom,
  pruneJoinGuard,
  recordJoinAttempt,
  rejectRoomEvent,
} from '../src/games/room-model.js';
import { JoinCode } from '../src/games/join-code.js';
import { useRoom } from '../src/games/live-room.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const T = 1_800_000_000_000;

describe('code expiry', () => {
  const room = createRoom({ code: 'K7Q4MZ', hostId: 'h', codeExpiresAt: T });

  it('admits new players until the code expires, and returning ones after', () => {
    expect(createRoom({ code: 'A', hostId: 'h' }).codeExpiresAt).toBeNull();
    const join = (id: string, at?: number) => ({ type: 'join' as const, playerId: id, name: id, at });
    const inRoom = applyRoomEvent(room, join('ava', T - 1), 'ava');
    expect(inRoom.players).toHaveLength(1);
    expect(rejectRoomEvent(inRoom, join('ben', T), 'ben')).toBe('expired');
    expect(rejectRoomEvent(inRoom, join('ava', T + 60_000), 'ava')).toBeNull();
    // An unstamped join fails closed while the room has an expiry; a reconnect still gets in.
    expect(rejectRoomEvent(inRoom, join('ben'), 'ben')).toBe('expired');
    expect(rejectRoomEvent(inRoom, join('ava'), 'ava')).toBeNull();
    expect(codeExpired({ codeExpiresAt: T }, undefined)).toBe(true);
    expect(codeExpired({ codeExpiresAt: null }, T)).toBe(false);
  });

  it('lets only the host move the expiry', () => {
    expect(rejectRoomEvent(room, { type: 'extend-code', expiresAt: T + 1 }, 'ava')).toBe('not-host');
    const later = applyRoomEvent(room, { type: 'extend-code', expiresAt: T + 15 * 60_000 }, 'h');
    expect(later.codeExpiresAt).toBe(T + 15 * 60_000);
    expect(rejectRoomEvent(later, { type: 'join', playerId: 'ben', name: 'Ben', at: T + 1 }, 'ben')).toBeNull();
    expect(applyRoomEvent(later, { type: 'extend-code', expiresAt: null }, 'h').codeExpiresAt).toBeNull();
  });

  it('stamps a join with the host clock in useRoom', async () => {
    const hub = createMemoryRoomHub();
    const rejected = vi.fn();
    let clock = T - 10;
    function Host() {
      const { room: r } = useRoom({ transport: hub.connect(), selfId: 'h', host: room, now: () => clock });
      return <p data-testid="count">{r?.players.length}</p>;
    }
    function Player({ id }: { id: string }) {
      const transport = React.useMemo(() => hub.connect(), []);
      const { send } = useRoom({ transport, selfId: id, onRejected: rejected });
      React.useEffect(() => {
        // A phone claiming a time before expiry does not matter: the host stamps its own.
        send({ type: 'join', playerId: id, name: id, at: 0 });
      }, [send, id]);
      return null;
    }
    render(<Host />);
    render(<Player id="ava" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    clock = T + 1;
    render(<Player id="ben" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(rejected).toHaveBeenCalledWith('expired', 'join');
  });
});

describe('join guard', () => {
  const opts = { perSource: 3, total: 5, windowMs: 1000 };

  it('stops one source after its wrong tries, until the window moves on', () => {
    let g = createJoinGuard();
    expect(checkJoinAttempt(g, 'net-a', 0, opts)).toEqual({ allowed: true, left: 3 });
    for (const at of [0, 100, 200]) g = recordJoinAttempt(g, 'net-a', false, at, opts);
    expect(checkJoinAttempt(g, 'net-a', 300, opts)).toEqual({ allowed: false, reason: 'source', retryAt: 1000 });
    expect(checkJoinAttempt(g, 'net-b', 300, opts)).toEqual({ allowed: true, left: 2 });
    expect(checkJoinAttempt(g, 'net-a', 1000, opts)).toEqual({ allowed: true, left: 1 });
    // A right code changes nothing but the pruning.
    expect(recordJoinAttempt(g, 'net-a', true, 300, opts)).toBe(g);
    expect(recordJoinAttempt(g, 'net-a', true, 1150, opts).failures).toHaveLength(1);
  });

  it('stops the whole room after enough wrong tries from anywhere', () => {
    let g = createJoinGuard();
    ['a', 'b', 'c', 'd', 'e'].forEach((s, i) => {
      g = recordJoinAttempt(g, s, false, i * 10, opts);
    });
    expect(checkJoinAttempt(g, 'f', 50, opts)).toEqual({ allowed: false, reason: 'room', retryAt: 1000 });
    expect(checkJoinAttempt(g, 'f', 1000, opts)).toEqual({ allowed: true, left: 1 });
  });

  it('uses sane defaults and floors bad options', () => {
    let g = createJoinGuard();
    for (let i = 0; i < 5; i++) g = recordJoinAttempt(g, 'x', false, i);
    expect(checkJoinAttempt(g, 'x', 10)).toMatchObject({ allowed: false, reason: 'source', retryAt: 600_000 });
    expect(checkJoinAttempt(g, 'y', 10)).toEqual({ allowed: true, left: 5 });
    expect(checkJoinAttempt(createJoinGuard(), 'x', 0, { perSource: 0, total: -1, windowMs: 0 })).toEqual({
      allowed: true,
      left: 1,
    });
    expect(pruneJoinGuard(g, 10)).toBe(g);
  });
});

describe('JoinCode expiry', () => {
  it('counts down in minutes, then strikes the code and drops the QR', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T - 2 * 60_000 - 1);
    render(<JoinCode code="K7Q4MZ" href="https://example.com/play?c=K7Q4MZ" expiresAt={T} />);
    const root = document.querySelector('[data-slot="join-code"]')!;
    expect(root.getAttribute('data-state')).toBe('live');
    expect(screen.getByText('Works for 3 more minutes')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Works for 2 more minutes')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Works for 1 more minute')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(root.getAttribute('data-state')).toBe('expired');
    expect(document.querySelector('[data-slot="join-code-qr"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    expect(document.querySelector('[data-slot="join-code-status"]')!.textContent).toBe('This code has expired.');
  });

  it('takes a clock and words, and shows nothing without an expiry', () => {
    render(
      <JoinCode
        code="K7Q4MZ"
        href="https://example.com/play"
        expiresAt={T}
        now={() => T + 1}
        labels={{ expired: 'Gone', expiresIn: (m) => `${m}m` }}
      />,
    );
    expect(screen.getAllByText('Gone')).toHaveLength(2);
    cleanup();
    render(<JoinCode code="K7Q4MZ" href="https://example.com/play" />);
    expect(document.querySelector('[data-slot="join-code-expiry"]')).toBeNull();
  });
});
