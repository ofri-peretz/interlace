/**
 * @interlace/ui — Leaderboard
 *
 * A group's board for a game: rank, name and score, ties sharing a rank,
 * the viewing player's row marked (and kept even when it falls below the
 * top rows), and the whole board held back until enough people have played
 * that no one's score stands alone. Ranking lives in `leaderboard-model.ts`
 * and is exported, so the server that stores scores ranks them the same way.
 *
 * ## Anatomy
 *
 *   Leaderboard                    (div — data-slot="leaderboard", data-state=visible|hidden)
 *     ├─ table                     (data-slot="leaderboard-table", captioned)
 *     │   └─ tr × n                (data-slot="leaderboard-row", data-current, data-rank)
 *     │       ├─ td                (rank: "2" or "=2" when tied)
 *     │       ├─ th scope="row"    (name, with a "You" tag on the viewer's row)
 *     │       └─ td                (score, formatted)
 *     └─ p                         (data-slot="leaderboard-hidden": "Shows once 5 people have played. 3 so far.")
 *
 * A real table, so a screen reader moves by row and column. Rank, name and
 * score are text; the viewer's row is marked by a word and weight, not only
 * a tint.
 *
 * ## Server first
 *
 * No hooks: it renders on the server.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Names truncate before the score column moves.
 *
 * | Rule | Concept                   | Where in this file                         |
 * | ---- | ------------------------- | ------------------------------------------ |
 * | R4   | Extends native el         | `React.ComponentProps<'div'>`              |
 * | R6   | data-slot per part        | leaderboard / -table / -row / -hidden       |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`          |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const       |
 * | R19  | Tokens only               | muted, primary, border                     |
 * | R26  | A11y                      | captioned table; row headers; "You" in words |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { buildBoard, type LeaderboardEntry, type RankOptions, type RankedEntry } from './leaderboard-model.js';

export const MIN_VIEWPORT = 320 as const;

interface LeaderboardLabels {
  rank?: string;
  name?: string;
  score?: string;
  /** @default 'You' */
  you?: string;
  /** @default (min, players) => `The board shows once ${min} people have played. ${players} so far.` */
  hidden?: (min: number, players: number) => string;
}

type LeaderboardProps = Omit<React.ComponentProps<'div'>, 'children'> &
  RankOptions & {
    entries: readonly LeaderboardEntry[];
    /** Names the table. */
    caption: React.ReactNode;
    /** Show the caption, or keep it for assistive tech only. @default false */
    showCaption?: boolean;
    /** `Intl.NumberFormat` options for scores. */
    format?: Intl.NumberFormatOptions;
    locale?: string;
    labels?: LeaderboardLabels;
  };

function Row({
  entry,
  current,
  score,
  you,
}: {
  entry: RankedEntry;
  current: boolean;
  score: string;
  you: string;
}) {
  return (
    <tr
      data-slot="leaderboard-row"
      data-rank={entry.rank}
      data-current={current ? '' : undefined}
      className={cn('border-border border-t first:border-t-0', current && 'bg-primary/8')}
    >
      <td className={cn('py-2.5 ps-3 pe-2 tabular-nums', entry.rank <= 3 ? 'font-semibold' : 'text-muted-foreground')}>
        {entry.tied ? `=${entry.rank}` : entry.rank}
      </td>
      <th scope="row" className="max-w-0 py-2.5 pe-2 text-start font-normal">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('truncate', current && 'font-semibold')}>{entry.name}</span>
          {current ? (
            <span className="border-primary text-primary shrink-0 rounded-full border px-2 text-xs leading-5 font-semibold">
              {you}
            </span>
          ) : null}
        </span>
      </th>
      <td className={cn('py-2.5 ps-2 pe-3 text-end tabular-nums', current && 'font-semibold')}>{score}</td>
    </tr>
  );
}

function Leaderboard({
  entries,
  caption,
  showCaption = false,
  order,
  minPlayers,
  limit,
  currentId,
  format,
  locale,
  labels,
  className,
  ...props
}: LeaderboardProps) {
  const board = buildBoard(entries, { order, minPlayers, limit, currentId });
  const nf = new Intl.NumberFormat(locale, format);
  const you = labels?.you ?? 'You';

  if (!board.visible) {
    const min = Math.max(1, minPlayers ?? 1);
    return (
      <div
        data-slot="leaderboard"
        data-state="hidden"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('border-border text-muted-foreground rounded-xl border border-dashed p-5 text-sm', className)}
        {...props}
      >
        {showCaption ? <p className="text-foreground mb-1 font-semibold">{caption}</p> : null}
        <p data-slot="leaderboard-hidden">
          {(labels?.hidden ?? ((m: number, p: number) => `The board shows once ${m} people have played. ${p} so far.`))(
            min,
            board.players,
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      data-slot="leaderboard"
      data-state="visible"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('border-border bg-card text-card-foreground overflow-hidden rounded-xl border', className)}
      {...props}
    >
      <table data-slot="leaderboard-table" className="w-full table-fixed border-collapse text-sm">
        <caption
          className={cn(showCaption ? 'border-border border-b px-3 py-2.5 text-start font-semibold' : 'sr-only')}
        >
          {caption}
        </caption>
        <colgroup>
          <col className="w-14" />
          <col />
          <col className="w-24" />
        </colgroup>
        <thead className="sr-only">
          <tr>
            <th scope="col">{labels?.rank ?? 'Rank'}</th>
            <th scope="col">{labels?.name ?? 'Name'}</th>
            <th scope="col">{labels?.score ?? 'Score'}</th>
          </tr>
        </thead>
        <tbody>
          {board.top.map((e) => (
            <Row key={e.id} entry={e} current={e.id === currentId} score={nf.format(e.score)} you={you} />
          ))}
        </tbody>
        {board.current ? (
          <tbody className="border-border border-t border-dashed">
            <Row entry={board.current} current score={nf.format(board.current.score)} you={you} />
          </tbody>
        ) : null}
      </table>
    </div>
  );
}
Leaderboard.displayName = 'Leaderboard';

export { Leaderboard };
export type { LeaderboardProps, LeaderboardLabels };
