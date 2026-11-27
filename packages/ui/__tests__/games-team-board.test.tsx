/**
 * TeamBoard, TeamScoreboard and TeamBadge: setup, balancing, moving by hand, the scores, and
 * what a keyboard and a screen reader get.
 */
import * as React from 'react';
import axe from 'axe-core';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyRoomEvent, createRoom, type RoomHostEvent, type RoomState } from '../src/games/room-model.js';
import { seededRandom } from '../src/games/group-model.js';
import { TeamBadge, TeamBoard, TeamScoreboard } from '../src/games/team-board.js';
import {
  autoBalance,
  createTeams,
  moveToTeam,
  readTeams,
  teamOf,
  teamsEvent,
  type TeamsState,
} from '../src/games/team-model.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const HOST = 'host';

function roomOf(n: number, teams?: TeamsState): RoomState {
  let r = createRoom({ code: 'K7Q4MZ', hostId: HOST });
  for (let i = 0; i < n; i++) r = applyRoomEvent(r, { type: 'join', playerId: `p${i}`, name: `Player ${i}` }, `p${i}`);
  return teams ? applyRoomEvent(r, teamsEvent(teams), HOST) : r;
}

/** The board wired to a real room: host events are applied to it, as `useRoom` would. */
function Wired({ start, extra }: { start: RoomState; extra?: Partial<React.ComponentProps<typeof TeamBoard>> }) {
  const [room, setRoom] = React.useState(start);
  const sends = React.useRef(0);
  const send = React.useCallback((e: RoomHostEvent) => {
    sends.current++;
    setRoom((r) => applyRoomEvent(r, e, HOST));
  }, []);
  return (
    <>
      <TeamBoard room={room} send={send} random={seededRandom(3)} {...extra} />
      <output data-testid="sends">{sends.current}</output>
      <output data-testid="teams">{JSON.stringify(readTeams(room))}</output>
      <button type="button" onClick={() => setRoom((r) => applyRoomEvent(r, { type: 'join', playerId: 'late', name: 'Late Larry' }, 'late'))}>
        late join
      </button>
    </>
  );
}

const teamsOut = () => JSON.parse(screen.getByTestId('teams').textContent!) as TeamsState | null;

describe('TeamBoard setup', () => {
  it('asks how many teams, and makes balanced teams with one event', async () => {
    const send = vi.fn();
    render(<TeamBoard room={roomOf(9)} send={send} random={seededRandom(1)} />);
    expect(screen.getByRole('region', { name: 'Teams' }).getAttribute('data-state')).toBe('empty');
    expect(screen.getByText('No teams yet. Choose how many and make them.')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('Number of teams'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Make teams' }));
    expect(send).toHaveBeenCalledTimes(1);
    const event = send.mock.calls[0]![0] as RoomHostEvent & { value: TeamsState };
    expect(event).toMatchObject({ type: 'share', key: 'teams' });
    expect(event.value.teams).toHaveLength(3);
    const sizes = event.value.teams.map((t) => Object.values(event.value.members).filter((m) => m === t.id).length);
    expect(sizes).toEqual([3, 3, 3]);
    expect(screen.getByText('9 players placed on teams').closest('[aria-live]')).toBeTruthy();
  });

  it('offers the count it is given, within bounds', () => {
    render(<TeamBoard room={roomOf(2)} send={() => {}} defaultTeams={5} />);
    expect((screen.getByLabelText('Number of teams') as HTMLSelectElement).value).toBe('5');
    cleanup();
    render(<TeamBoard room={roomOf(2)} send={() => {}} defaultTeams={99} />);
    expect((screen.getByLabelText('Number of teams') as HTMLSelectElement).value).toBe('12');
    cleanup();
    render(<TeamBoard room={roomOf(2)} send={() => {}} defaultTeams={0} />);
    expect((screen.getByLabelText('Number of teams') as HTMLSelectElement).value).toBe('2');
  });
});

describe('TeamBoard with teams', () => {
  const ready = (n = 6) => {
    const base = roomOf(n);
    return roomOf(n, autoBalance(createTeams(3, ['Owls', 'Foxes']), base.players, { random: seededRandom(2) }));
  };

  it('lists each team with its members and size, and a letter for each', () => {
    render(<TeamBoard room={ready()} send={() => {}} />);
    const teams = document.querySelectorAll('[data-slot="team-board-team"]');
    expect([...teams].map((t) => t.getAttribute('data-mark'))).toEqual(['A', 'B', 'C']);
    expect(within(teams[0] as HTMLElement).getByLabelText('Name for Owls')).toBeTruthy();
    expect(within(teams[0] as HTMLElement).getByText('2 players')).toBeTruthy();
    expect(document.querySelectorAll('[data-slot="team-board-member"]')).toHaveLength(6);
    expect((teams[2] as HTMLElement).style.getPropertyValue('--team')).toBe('var(--team-3)');
  });

  it('moves a player by a select, which a keyboard and a screen reader can use', async () => {
    const send = vi.fn();
    render(<TeamBoard room={ready()} send={send} autoPlace={false} />);
    const select = screen.getByLabelText('Move Player 0 to') as HTMLSelectElement;
    const from = select.value;
    const to = from === 't1' ? 't2' : 't1';
    await userEvent.selectOptions(select, to);
    const value = (send.mock.calls[0]![0] as { value: TeamsState }).value;
    expect(value.members.p0).toBe(to);
    await userEvent.selectOptions(select, '');
    expect((send.mock.calls[1]![0] as { value: TeamsState }).value.members.p0).toBeUndefined();
    expect(within(select).getByRole('option', { name: 'A · Owls' })).toBeTruthy();
  });

  it('renames a team on blur or Enter, and puts the name back on Escape', async () => {
    const send = vi.fn();
    render(<TeamBoard room={ready()} send={send} autoPlace={false} />);
    const field = screen.getByLabelText('Name for Owls') as HTMLInputElement;
    await userEvent.clear(field);
    await userEvent.type(field, 'Hawks');
    await userEvent.tab();
    expect((send.mock.calls[0]![0] as { value: TeamsState }).value.teams[0]!.name).toBe('Hawks');
    const second = screen.getByLabelText('Name for Foxes') as HTMLInputElement;
    await userEvent.clear(second);
    await userEvent.type(second, 'Wolves{Enter}');
    expect((send.mock.calls[1]![0] as { value: TeamsState }).value.teams[1]!.name).toBe('Wolves');
    const third = screen.getByLabelText('Name for Team 3') as HTMLInputElement;
    await userEvent.type(third, 'zzz{Escape}');
    expect(third.value).toBe('Team 3');
    await userEvent.tab();
    expect(send).toHaveBeenCalledTimes(2); // nothing changed, nothing sent
  });

  it('shuffles, evens out by score, and removes the teams', async () => {
    const send = vi.fn();
    const room = { ...ready(8), scores: { p0: 900, p1: 800, p2: 700, p3: 600, p4: 100, p5: 90, p6: 80, p7: 70 } };
    render(<TeamBoard room={room} send={send} random={seededRandom(4)} autoPlace={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Shuffle teams' }));
    await userEvent.click(screen.getByRole('button', { name: 'Even out by score' }));
    const strong = (send.mock.calls[1]![0] as { value: TeamsState }).value;
    const top3 = ['p0', 'p1', 'p2'].map((id) => strong.members[id]);
    expect(new Set(top3).size).toBe(3);
    await userEvent.click(screen.getByRole('button', { name: 'Remove teams' }));
    expect(send.mock.calls[2]![0]).toEqual({ type: 'share', key: 'teams', value: null });
  });

  it('puts someone who joins late on the smallest team, once', async () => {
    render(<Wired start={ready(6)} />);
    const before = Number(screen.getByTestId('sends').textContent);
    await userEvent.click(screen.getByRole('button', { name: 'late join' }));
    const t = teamsOut()!;
    expect(t.members.late).toBeTruthy();
    expect(Number(screen.getByTestId('sends').textContent)).toBe(before + 1); // one placement, no loop
    // 7 players over 3 teams: the new one made it 3, 2, 2 into 3, 2, 2
    const sizes = t.teams.map((x) => Object.values(t.members).filter((m) => m === x.id).length).sort();
    expect(sizes).toEqual([2, 2, 3]);
  });

  it('leaves a latecomer in "No team yet" when it is told not to place, and lets the host place them', async () => {
    render(<Wired start={ready(6)} extra={{ autoPlace: false }} />);
    await userEvent.click(screen.getByRole('button', { name: 'late join' }));
    const loose = document.querySelector('[data-slot="team-board-unassigned"]')!;
    expect(within(loose as HTMLElement).getByText('Late Larry')).toBeTruthy();
    await userEvent.selectOptions(within(loose as HTMLElement).getByLabelText('Move Late Larry to'), 't2');
    expect(teamOf(teamsOut()!, 'late')?.id).toBe('t2');
    expect(document.querySelector('[data-slot="team-board-unassigned"]')).toBeNull();
  });

  it('marks players who are away', () => {
    const room = applyRoomEvent(ready(4), { type: 'leave', playerId: 'p1' }, 'p1');
    render(<TeamBoard room={room} send={() => {}} />);
    const row = document.querySelector('[data-player-id="p1"]')!;
    expect(row.getAttribute('data-away')).toBe('');
    expect(row.textContent).toContain('away');
  });

  it('shows 40 players, each with a labelled select, and every control is reachable by Tab', async () => {
    render(<Wired start={roomOf(40, autoBalance(createTeams(5), roomOf(40).players, { random: seededRandom(1) }))} />);
    expect(screen.getAllByRole('combobox')).toHaveLength(40);
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
    const reached = new Set<Element>();
    for (let i = 0; i < 40 + 5 + 3 + 1; i++) {
      await userEvent.tab();
      reached.add(document.activeElement!);
    }
    expect([...reached].filter((el) => el.tagName === 'SELECT')).toHaveLength(40);
  });

  it('uses the app\'s words', () => {
    render(
      <TeamBoard
        room={ready()}
        send={() => {}}
        labels={{ name: 'Gruppen', shuffle: 'Mischen', move: (n) => `${n} verschieben`, size: (n) => `${n} Leute`, unassigned: 'Ohne Gruppe' }}
      />,
    );
    expect(screen.getByRole('region', { name: 'Gruppen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mischen' })).toBeTruthy();
    expect(screen.getByLabelText('Player 0 verschieben')).toBeTruthy();
    expect(screen.getAllByText('2 Leute').length).toBeGreaterThan(0);
  });

  it('has no accessibility violations that a DOM check can find', async () => {
    const { container } = render(<TeamBoard room={ready(10)} send={() => {}} />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('TeamScoreboard', () => {
  function scored(): RoomState {
    const base = roomOf(6);
    let teams = createTeams(3, ['Owls', 'Foxes', 'Wolves']);
    base.players.forEach((p, i) => (teams = moveToTeam(teams, p.id, `t${(i % 3) + 1}`)));
    return {
      ...applyRoomEvent(base, teamsEvent(teams), HOST),
      scores: { p0: 100, p3: 100, p1: 400, p4: 300, p2: 50, p5: 50 },
      lastPoints: { p1: 40, p4: 30 },
    };
  }

  it('lists teams best first, with rank, mark, size, points and what the last round added', () => {
    render(<TeamScoreboard room={scored()} locale="en-US" />);
    const rows = document.querySelectorAll('[data-slot="team-scoreboard-row"]');
    expect([...rows].map((r) => r.getAttribute('data-team-id'))).toEqual(['t2', 't1', 't3']);
    expect([...rows].map((r) => r.getAttribute('data-rank'))).toEqual(['1', '2', '3']);
    expect(rows[0]!.textContent).toContain('Foxes');
    expect(rows[0]!.textContent).toContain('350');
    expect(rows[0]!.textContent).toContain('+70');
    expect(rows[0]!.textContent).toContain('2 players');
    expect(within(rows[0] as HTMLElement).getByText('350 per player')).toBeTruthy();
    const bars = [...document.querySelectorAll<HTMLElement>('[data-slot="team-scoreboard-bar"]')].map((b) => b.style.width);
    expect(bars).toEqual(['100%', '29%', '14%']);
  });

  it('ranks by total when asked, and says tied teams are tied', () => {
    const room = { ...scored(), scores: { p0: 100, p3: 100, p1: 100, p4: 100, p2: 0, p5: 0 }, lastPoints: {} };
    render(<TeamScoreboard room={room} by="total" />);
    const rows = document.querySelectorAll('[data-slot="team-scoreboard-row"]');
    expect(rows[0]!.textContent).toContain('(tied)');
    expect(rows[0]!.textContent).toContain('200 points');
  });

  it('marks the viewer\'s own team', () => {
    render(<TeamScoreboard room={scored()} selfId="p4" />);
    expect(document.querySelector('[data-mine]')!.getAttribute('data-team-id')).toBe('t2');
  });

  it('says there are no teams yet', () => {
    render(<TeamScoreboard room={roomOf(3)} />);
    expect(screen.getByText('No teams yet.')).toBeTruthy();
    expect(document.querySelector('[data-slot="team-scoreboard-bar"]')).toBeNull();
  });

  it('draws empty bars while no one has scored', () => {
    const room = { ...scored(), scores: {}, lastPoints: {} };
    render(<TeamScoreboard room={room} />);
    expect([...document.querySelectorAll<HTMLElement>('[data-slot="team-scoreboard-bar"]')].map((b) => b.style.width)).toEqual(['0%', '0%', '0%']);
  });

  describe('spoken signals', () => {
    const said = () => document.querySelector('[data-slot="team-scoreboard-announce"]')!.textContent;

    it('says who leads only when that changes, and nothing on the first look', () => {
      const first = scored();
      const { rerender } = render(<TeamScoreboard room={first} />);
      expect(said()).toBe('');
      rerender(<TeamScoreboard room={{ ...first, lastPoints: { p1: 1 } }} />); // points moved, same leader
      expect(said()).toBe('');
      rerender(<TeamScoreboard room={{ ...first, scores: { ...first.scores, p0: 900 } }} />);
      expect(said()).toBe('Owls leads');
    });

    it('says when teams are level at the top, and never before anyone has scored', () => {
      const first = scored();
      const { rerender } = render(<TeamScoreboard room={{ ...first, scores: {} }} />);
      rerender(<TeamScoreboard room={{ ...first, scores: { p0: 10 } }} />);
      expect(said()).toBe('Owls leads');
      rerender(<TeamScoreboard room={{ ...first, scores: { p0: 10, p1: 10 }, lastPoints: {} }} by="total" />);
      expect(said()).toBe('Foxes and Owls are level');
      rerender(<TeamScoreboard room={{ ...first, scores: {} }} />);
      expect(said()).toBe('Foxes and Owls are level'); // zero is nobody leading: nothing new is said
    });
  });

  describe('prefers-reduced-motion', () => {
    it('grows the bars with a transition by default, and not under reduced motion', () => {
      render(<TeamScoreboard room={scored()} />);
      expect(document.querySelector('[data-slot="team-scoreboard-bar"]')!.className).toContain('transition-[width]');
      cleanup();
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }));
      render(<TeamScoreboard room={scored()} />);
      expect(document.querySelector('[data-slot="team-scoreboard-bar"]')!.className).not.toContain('transition');
    });
  });

  it('has no accessibility violations a DOM check can find', async () => {
    const { container } = render(<TeamScoreboard room={scored()} selfId="p0" />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('TeamBadge', () => {
  it('says which team the player is on, with its letter and colour', () => {
    const room = roomOf(4, moveToTeam(createTeams(3, ['Owls']), 'p1', 't2'));
    render(<TeamBadge room={room} selfId="p1" />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toBe('BYou are on Team 2');
    expect(badge.getAttribute('data-state')).toBe('team');
    expect((badge as HTMLElement).style.getPropertyValue('--team')).toBe('var(--team-2)');
  });

  it('says it is waiting when there is no team yet, and when there are no teams at all', () => {
    const room = roomOf(4, createTeams(2));
    render(<TeamBadge room={room} selfId="p1" />);
    expect(screen.getByRole('status').textContent).toBe('Waiting for a team');
    cleanup();
    render(<TeamBadge room={null} selfId="p1" />);
    expect(screen.getByRole('status').getAttribute('data-state')).toBe('none');
  });

  it('is a live region whose words change when the player is moved, and not before', () => {
    const start = roomOf(4, moveToTeam(createTeams(2, ['Owls', 'Foxes']), 'p0', 't1'));
    const { rerender } = render(<TeamBadge room={start} selfId="p0" />);
    expect(screen.getByRole('status').textContent).toContain('You are on Owls');
    rerender(<TeamBadge room={roomOf(4, moveToTeam(readTeams(start)!, 'p0', 't2'))} selfId="p0" />);
    expect(screen.getByRole('status').textContent).toContain('You are on Foxes');
  });

  it('uses the app\'s words', () => {
    const room = roomOf(2, moveToTeam(createTeams(2, ['Owls']), 'p0', 't1'));
    render(<TeamBadge room={room} selfId="p0" labels={{ on: (n) => `Du bist bei ${n}` }} />);
    expect(screen.getByRole('status').textContent).toContain('Du bist bei Owls');
  });

  it('has no accessibility violations a DOM check can find', async () => {
    const room = roomOf(2, moveToTeam(createTeams(2), 'p0', 't1'));
    const { container } = render(<TeamBadge room={room} selfId="p0" />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

// A last check that the board does not choke on teams that carry junk from an older version.
describe('TeamBoard reading untrusted teams', () => {
  it('shows the setup when the shared value is not teams', () => {
    const room = applyRoomEvent(roomOf(2), { type: 'share', key: 'teams', value: { teams: 'nope' } }, HOST);
    render(<TeamBoard room={room} send={() => {}} />);
    expect(screen.getByRole('region', { name: 'Teams' }).getAttribute('data-state')).toBe('empty');
  });
});
