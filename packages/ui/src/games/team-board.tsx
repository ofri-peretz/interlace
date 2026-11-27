'use client';

/**
 * @interlace/ui — TeamBoard, TeamScoreboard, TeamBadge
 *
 * Team mode for a live room. The host sets up teams, balances them (or moves a player by hand),
 * and everyone sees whose team they are on and how the teams score. The rules are
 * `games/team-model`; the teams ride in the room (`RoomState.shared`), so a phone that joins late
 * or reconnects shows its team at once and no message can put an old assignment back.
 *
 * ## Anatomy
 *
 *   TeamBoard                      (section — data-slot="team-board", data-state=empty|ready)
 *     ├─ div                       (data-slot="team-board-setup": team count + make teams, before any)
 *     ├─ div role="group"          (data-slot="team-board-actions": shuffle, even out by score)
 *     ├─ ul                        (data-slot="team-board-teams")
 *     │   └─ li × n                (data-slot="team-board-team", data-team-id, data-mark)
 *     │       ├─ h3 + Input        (data-slot="team-board-name": rename on blur or Enter)
 *     │       └─ ul > li × m       (data-slot="team-board-member": name, away, and a "move to" select)
 *     ├─ section                   (data-slot="team-board-unassigned": players with no team yet)
 *     └─ span aria-live            (data-slot="team-board-announce")
 *
 *   TeamScoreboard                 (section — data-slot="team-scoreboard")
 *     ├─ ol > li × n               (data-slot="team-scoreboard-row": rank, mark, name, points, bar)
 *     └─ span aria-live            (data-slot="team-scoreboard-announce": who leads, when it changes)
 *
 *   TeamBadge                      (div role="status" — data-slot="team-badge", data-state=none|team)
 *
 * ## Colour is never alone
 *
 * A team's colour is a `--team-N` token (retune them in your brand layer); each team also has a
 * letter (A, B, C…) and its name, so teams are told apart without seeing colour.
 *
 * ## Keyboard and screen readers
 *
 * Moving a player is a native `<select>` on each member, so there is no drag to do and it works
 * with a keyboard, a switch and a screen reader. The scoreboard is an ordered list and says in
 * words when the leader changes; a phone says when its player moves to another team.
 *
 * ## Motion
 *
 * The scoreboard bars grow with a transition (clamped to none under reduced motion by the page
 * preflight and by `useReducedMotion` here). Nothing else moves.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                   |
 * | ---- | ------------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el         | `section` / `div` props                              |
 * | R6   | data-slot per part        | team-board-*, team-scoreboard-*, team-badge         |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                    |
 * | R8   | Enums, not booleans       | `by`                                                 |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                 |
 * | R25  | Client component          | the board reacts to the room                         |
 * | R26  | A11y                      | lists, labelled selects, sparse live regions         |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';
import type { RoomHostEvent, RoomPlayer, RoomState } from './room-model.js';
import type { Random } from './group-model.js';
import {
  autoBalance,
  createTeams,
  MAX_TEAMS,
  membersOf,
  moveToTeam,
  placeNewcomers,
  readTeams,
  renameTeam,
  teamColor,
  teamMark,
  teamOf,
  teamsEvent,
  teamStandings,
  unassigned,
  type TeamStanding,
  type TeamsState,
} from './team-model.js';

export const MIN_VIEWPORT = 320 as const;

const SELECT =
  'border-input bg-background text-foreground h-control-sm max-w-full min-w-0 rounded-lg border ps-2 pe-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** A team's colour as a custom property, so a class can paint with it (`bg-(--team)`). */
const teamStyle = (index: number) => ({ '--team': teamColor(index) }) as React.CSSProperties;

// --- TeamBoard ------------------------------------------------------------------

export interface TeamBoardLabels {
  /** Names the board. @default 'Teams' */
  name?: string;
  /** @default 'Number of teams' */
  count?: string;
  /** @default 'Make teams' */
  make?: string;
  /** Shown before any teams are made. @default 'No teams yet. Choose how many and make them.' */
  empty?: string;
  /** Names the buttons that change the teams. @default 'Team actions' */
  actions?: string;
  /** @default 'Shuffle teams' */
  shuffle?: string;
  /** @default 'Even out by score' */
  evenOut?: string;
  /** @default 'Remove teams' */
  clear?: string;
  /** @default (mark) => `Team ${mark}` */
  team?: (mark: string) => string;
  /** @default (team) => `Name for ${team}` */
  rename?: (team: string) => string;
  /** @default (n) => n === 1 ? '1 player' : `${n} players` */
  size?: (n: number) => string;
  /** @default (player) => `Move ${player} to` */
  move?: (player: string) => string;
  /** The "no team" option. @default 'No team' */
  none?: string;
  /** @default 'away' */
  away?: string;
  /** @default 'No team yet' */
  unassigned?: string;
  /** Said when players are put on teams. @default (n) => `${n} players placed on teams` */
  placed?: (n: number) => string;
}

type TeamBoardProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  room: RoomState;
  /** `send` from the host's `useRoom`. */
  send: (event: RoomHostEvent) => void;
  /** Teams to offer first in the setup. @default 2 */
  defaultTeams?: number;
  /** Put players who join after the teams are made on the smallest team. @default true */
  autoPlace?: boolean;
  /** @default Math.random. Pass `seededRandom(n)` for a split you can repeat. */
  random?: Random;
  labels?: TeamBoardLabels;
};

const SIZE = (n: number) => (n === 1 ? '1 player' : `${n} players`);

function TeamBoard({
  room,
  send,
  defaultTeams = 2,
  autoPlace = true,
  random,
  labels,
  className,
  ...props
}: TeamBoardProps) {
  const L = labels ?? {};
  const teams = readTeams(room);
  const [count, setCount] = React.useState(() => Math.min(MAX_TEAMS, Math.max(2, defaultTeams)));
  const [announce, setAnnounce] = React.useState('');
  const countId = React.useId();
  const latest = React.useRef({ send, random });
  latest.current = { send, random };

  const write = React.useCallback((next: TeamsState | null) => latest.current.send(teamsEvent(next)), []);

  // Someone who joined after the teams were made goes to the smallest team.
  React.useEffect(() => {
    if (!autoPlace || !teams) return;
    const next = placeNewcomers(teams, room.players);
    if (next !== teams) write(next);
  }, [autoPlace, teams, room.players, write]);

  const balance = (scored: boolean) => {
    const base = teams ?? createTeams(count);
    const next = autoBalance(base, room.players, {
      scores: scored ? room.scores : undefined,
      random: latest.current.random,
    });
    write(next);
    setAnnounce((L.placed ?? ((n: number) => `${n} players placed on teams`))(room.players.length));
  };

  const loose = teams ? unassigned(teams, room.players) : [];

  return (
    <section
      aria-label={L.name ?? 'Teams'}
      data-slot="team-board"
      data-state={teams ? 'ready' : 'empty'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container flex flex-col gap-5', className)}
      {...props}
    >
      {teams ? null : (
        <div data-slot="team-board-setup" className="flex flex-wrap items-end gap-3">
          <p className="text-muted-foreground basis-full text-sm">
            {L.empty ?? 'No teams yet. Choose how many and make them.'}
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={countId} className="text-sm font-medium">
              {L.count ?? 'Number of teams'}
            </label>
            <select
              id={countId}
              data-slot="team-board-count"
              className={SELECT}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {Array.from({ length: MAX_TEAMS - 1 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <Button data-slot="team-board-make" type="button" onClick={() => balance(false)}>
            {L.make ?? 'Make teams'}
          </Button>
        </div>
      )}

      {teams ? (
        <div role="group" aria-label={L.actions ?? 'Team actions'} data-slot="team-board-actions" className="flex flex-wrap gap-2">
          <Button data-slot="team-board-shuffle" type="button" variant="outline" onClick={() => balance(false)}>
            {L.shuffle ?? 'Shuffle teams'}
          </Button>
          <Button data-slot="team-board-even" type="button" variant="outline" onClick={() => balance(true)}>
            {L.evenOut ?? 'Even out by score'}
          </Button>
          <Button data-slot="team-board-clear" type="button" variant="ghost" onClick={() => write(null)}>
            {L.clear ?? 'Remove teams'}
          </Button>
        </div>
      ) : null}

      {teams ? (
        <ul data-slot="team-board-teams" className="grid list-none gap-4 p-0 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {teams.teams.map((team, index) => {
            const people = membersOf(teams, team.id, room.players);
            const mark = teamMark(index);
            return (
              <li
                key={team.id}
                data-slot="team-board-team"
                data-team-id={team.id}
                data-mark={mark}
                style={teamStyle(index)}
                className="bg-card text-card-foreground border-border flex min-w-0 flex-col gap-3 rounded-xl border border-s-4 border-s-(--team) p-4"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="border-border bg-background grid size-7 shrink-0 place-items-center rounded-full border-2 border-(--team) text-sm font-semibold"
                  >
                    {mark}
                  </span>
                  <RenameField
                    key={team.name}
                    label={(L.rename ?? ((n: string) => `Name for ${n}`))(team.name)}
                    value={team.name}
                    onCommit={(name) => write(renameTeam(teams, team.id, name))}
                  />
                </div>
                <p className="text-muted-foreground text-xs tabular-nums">{(L.size ?? SIZE)(people.length)}</p>
                <ul className="flex list-none flex-col gap-1.5 p-0">
                  {people.map((p) => (
                    <MemberRow key={p.id} player={p} teams={teams} labels={L} onMove={(to) => write(moveToTeam(teams, p.id, to))} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}

      {teams && loose.length ? (
        <section data-slot="team-board-unassigned" aria-label={L.unassigned ?? 'No team yet'} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{L.unassigned ?? 'No team yet'}</h3>
          <ul className="flex list-none flex-col gap-1.5 p-0">
            {loose.map((p) => (
              <MemberRow key={p.id} player={p} teams={teams} labels={L} onMove={(to) => write(moveToTeam(teams, p.id, to))} />
            ))}
          </ul>
        </section>
      ) : null}

      <span data-slot="team-board-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </section>
  );
}
TeamBoard.displayName = 'TeamBoard';

/** A team's name as a field: the new name is kept on blur or Enter, and Escape puts the old one back. */
function RenameField({ label, value, onCommit }: { label: string; value: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  return (
    <Input
      data-slot="team-board-name"
      aria-label={label}
      value={draft}
      maxLength={24}
      className="min-w-0 font-semibold"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
}

function MemberRow({
  player,
  teams,
  labels,
  onMove,
}: {
  player: RoomPlayer;
  teams: TeamsState;
  labels: TeamBoardLabels;
  onMove: (teamId: string | null) => void;
}) {
  const current = teamOf(teams, player.id)?.id ?? '';
  return (
    <li
      data-slot="team-board-member"
      data-player-id={player.id}
      data-away={player.connected ? undefined : ''}
      className="flex min-w-0 items-center justify-between gap-2"
    >
      <span className={cn('min-w-0 truncate text-sm', !player.connected && 'text-muted-foreground')}>
        {player.name}
        {player.connected ? null : <span className="ms-1.5 text-xs">{labels.away ?? 'away'}</span>}
      </span>
      <select
        data-slot="team-board-move"
        aria-label={(labels.move ?? ((n: string) => `Move ${n} to`))(player.name)}
        className={SELECT}
        value={current}
        onChange={(e) => onMove(e.target.value || null)}
      >
        <option value="">{labels.none ?? 'No team'}</option>
        {teams.teams.map((t, i) => (
          <option key={t.id} value={t.id}>
            {teamMark(i)} · {t.name}
          </option>
        ))}
      </select>
    </li>
  );
}

// --- TeamScoreboard -------------------------------------------------------------

export interface TeamScoreboardLabels {
  /** Names the board. @default 'Team scores' */
  name?: string;
  /** @default (n) => n === 1 ? '1 player' : `${n} players` */
  size?: (n: number) => string;
  /** The points figure's unit, spoken. @default (n, by) => by === 'average' ? `${n} per player` : `${n} points` */
  points?: (n: number, by: 'average' | 'total') => string;
  /** What a round added. @default (n) => `+${n}` */
  gained?: (n: number) => string;
  /** @default (name) => `${name} leads` */
  leads?: (name: string) => string;
  /** Said when two or more share the lead. @default (names) => `${names.join(' and ')} are level` */
  level?: (names: string[]) => string;
  /** Shown before any teams. @default 'No teams yet.' */
  empty?: string;
}

type TeamScoreboardProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  room: Pick<RoomState, 'shared' | 'players' | 'scores' | 'lastPoints'>;
  /** What ranks: `average` is fair when teams differ in size by one. @default 'average' */
  by?: 'average' | 'total';
  /** The viewer's player id, to mark their team. */
  selfId?: string;
  /** For the numbers. @default the page's language */
  locale?: string;
  labels?: TeamScoreboardLabels;
};

function TeamScoreboard({ room, by = 'average', selfId, locale, labels, className, ...props }: TeamScoreboardProps) {
  const L = labels ?? {};
  const fmt = React.useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const reduced = useReducedMotion();
  const teams = readTeams(room);
  const rows: TeamStanding[] = teams ? teamStandings(teams, room, by) : [];
  const top = rows.length ? Math.max(...rows.map((r) => (by === 'total' ? r.total : r.average))) : 0;
  const mine = teams && selfId ? teamOf(teams, selfId)?.id : undefined;
  const leaders = rows.filter((r) => r.rank === 1);
  const said = React.useRef<string | null>(null);
  const [announce, setAnnounce] = React.useState('');

  // Say who leads, only when it changes (and never on the first look).
  const leadKey = leaders.map((r) => r.id).join(',');
  const leadWords = leaders.length > 1
    ? (L.level ?? ((names: string[]) => `${names.join(' and ')} are level`))(leaders.map((r) => r.name))
    : leaders[0]
      ? (L.leads ?? ((name: string) => `${name} leads`))(leaders[0].name)
      : '';
  React.useEffect(() => {
    const before = said.current;
    said.current = leadKey;
    if (before !== null && before !== leadKey && leadKey && top > 0) setAnnounce(leadWords);
  }, [leadKey, leadWords, top]);

  return (
    <section
      aria-label={L.name ?? 'Team scores'}
      data-slot="team-scoreboard"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-col gap-3', className)}
      {...props}
    >
      {rows.length ? (
        <ol data-slot="team-scoreboard-list" className="flex list-none flex-col gap-3 p-0">
          {rows.map((r) => {
            const value = by === 'total' ? r.total : r.average;
            return (
              <li
                key={r.id}
                data-slot="team-scoreboard-row"
                data-team-id={r.id}
                data-rank={r.rank}
                data-mine={r.id === mine ? '' : undefined}
                style={teamStyle(r.index)}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5"
              >
                <span className="text-muted-foreground w-6 text-sm font-semibold tabular-nums">
                  {r.rank}
                  <span className="sr-only">{r.tied ? ' (tied)' : ''}</span>
                </span>
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span aria-hidden className="border-border bg-background grid size-6 shrink-0 place-items-center rounded-full border-2 border-(--team) text-xs font-semibold">
                    {teamMark(r.index)}
                  </span>
                  <span className={cn('truncate', r.id === mine && 'font-semibold')}>{r.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{(L.size ?? SIZE)(r.size)}</span>
                </span>
                <span className="text-end text-sm font-semibold tabular-nums">
                  <span aria-hidden>{fmt.format(value)}</span>
                  <span className="sr-only">{(L.points ?? ((n: number, b) => (b === 'average' ? `${n} per player` : `${n} points`)))(value, by)}</span>
                  {r.gained > 0 ? (
                    <span className="text-muted-foreground ms-1.5 text-xs font-medium">{(L.gained ?? ((n: number) => `+${n}`))(r.gained)}</span>
                  ) : null}
                </span>
                <span aria-hidden className="bg-muted col-span-3 block h-2 overflow-hidden rounded-full">
                  <span
                    data-slot="team-scoreboard-bar"
                    className={cn(
                      'block h-full origin-left rounded-full bg-(--team) rtl:origin-right',
                      reduced ? '' : 'transition-[width] duration-(--duration-slow) ease-enter',
                    )}
                    style={{ width: `${top > 0 ? Math.max(2, Math.round((value / top) * 100)) : 0}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p data-slot="team-scoreboard-empty" className="text-muted-foreground">
          {L.empty ?? 'No teams yet.'}
        </p>
      )}
      <span data-slot="team-scoreboard-announce" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </section>
  );
}
TeamScoreboard.displayName = 'TeamScoreboard';

// --- TeamBadge ------------------------------------------------------------------

export interface TeamBadgeLabels {
  /** @default (team) => `You are on ${team}` */
  on?: (team: string) => string;
  /** @default 'Waiting for a team' */
  none?: string;
  /** @default (mark) => `Team ${mark}` */
  mark?: (mark: string) => string;
}

type TeamBadgeProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  room: Pick<RoomState, 'shared' | 'players'> | null;
  /** The viewer's player id. */
  selfId: string;
  labels?: TeamBadgeLabels;
};

function TeamBadge({ room, selfId, labels, className, ...props }: TeamBadgeProps) {
  const L = labels ?? {};
  const teams = readTeams(room);
  const team = teams ? teamOf(teams, selfId) : null;
  const index = teams && team ? teams.teams.findIndex((t) => t.id === team.id) : 0;
  return (
    <div
      role="status"
      data-slot="team-badge"
      data-state={team ? 'team' : 'none'}
      data-team-id={team?.id}
      data-min-viewport={String(MIN_VIEWPORT)}
      style={team ? teamStyle(index) : undefined}
      className={cn(
        'bg-card text-card-foreground border-border flex items-center gap-3 rounded-xl border border-s-4 p-4',
        team ? 'border-s-(--team)' : 'border-dashed',
        className,
      )}
      {...props}
    >
      {team ? (
        <>
          <span
            aria-hidden
            className="border-border bg-background grid size-9 shrink-0 place-items-center rounded-full border-2 border-(--team) text-base font-semibold"
          >
            {teamMark(index)}
          </span>
          <span className="min-w-0 text-lg font-semibold break-words">{(L.on ?? ((n: string) => `You are on ${n}`))(team.name)}</span>
        </>
      ) : (
        <span className="text-muted-foreground">{L.none ?? 'Waiting for a team'}</span>
      )}
    </div>
  );
}
TeamBadge.displayName = 'TeamBadge';

export { TeamBadge, TeamBoard, TeamScoreboard };
export type { TeamBadgeProps, TeamBoardProps, TeamScoreboardProps };
