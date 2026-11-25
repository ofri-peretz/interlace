'use client';

/**
 * @interlace/ui — Duel: DuelInvite, DuelCard, DuelCompare
 *
 * Two players, one game, by link. The first player finishes and sends a
 * challenge (`DuelInvite`); the second opens it and sees who they are up
 * against (`DuelCard`); after playing the same game, both see the rounds
 * side by side (`DuelCompare`). The challenge lives in the link
 * (`games/duel-model`: `encodeDuel`, `decodeDuel`, `duelHref`), and the
 * comparison is pure (`compareDuel`), so a server shows the same result.
 *
 * ## Anatomy
 *
 *   DuelInvite                     (div — data-slot="duel-invite")
 *     ├─ p                         (data-slot="duel-invite-title")
 *     ├─ div                       (data-slot="duel-invite-actions": Send (Web Share) and Copy link)
 *     └─ span aria-live            (data-slot="duel-invite-status")
 *
 *   DuelCard                       (section — data-slot="duel-card")
 *     ├─ h2                        (data-slot="duel-card-title": "Avery challenged you")
 *     ├─ p                         (data-slot="duel-card-score": "4,200 points to beat.")
 *     └─ Button                    (data-slot="duel-card-accept")
 *
 *   DuelCompare                    (section — data-slot="duel-compare", data-winner=a|b|tie)
 *     ├─ p                         (data-slot="duel-compare-verdict": "You won by 120 points.")
 *     ├─ div                       (data-slot="duel-compare-players": a | vs | b, totals, rounds won)
 *     └─ table                     (data-slot="duel-compare-rounds": a row per round,
 *                                   each side's points and a bar growing out from the middle)
 *
 * ## Words first
 *
 * Who won, by how much, and who took each round are words: the verdict, a
 * "Won" tag on the winner, and the winner's cell in each row says so for a
 * screen reader. Bars and weight repeat it for the eye.
 *
 * ## Motion
 *
 * The bars grow out from the middle, 40ms apart (transform only), and a
 * Celebrate burst marks the viewer's win. Under reduced motion they are
 * simply there.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                    |
 * | ---- | ------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el         | `div` / `section` props                               |
 * | R6   | data-slot per part        | duel-invite-*, duel-card-*, duel-compare-*            |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                     |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                  |
 * | R19  | Tokens only               | primary, muted, border                                |
 * | R26  | A11y                      | verdict in words; captioned table with row headers    |
 */

import * as React from 'react';
import { Copy, Share2, Swords } from 'lucide-react';

import { Celebrate } from '../effects/celebrate.js';
import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { Button } from '../primitives/button.js';
import { compareDuel, type DuelPlayer, type DuelSide } from './duel-model.js';

export const MIN_VIEWPORT = 320 as const;

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

// --- DuelInvite -------------------------------------------------------------------

interface DuelInviteLabels {
  /** @default 'Challenge a friend to the same game' */
  title?: string;
  /** @default 'Send a challenge' */
  share?: string;
  /** @default 'Copy link' */
  copy?: string;
  /** Name of the link field shown when copying fails. @default 'Challenge link' */
  field?: string;
  /** @default 'Link copied.' */
  copied?: string;
  /** @default 'Copy failed. Select the link and copy it.' */
  copyFailed?: string;
}

type DuelInviteProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /** The challenge link, e.g. `duelHref(location.href, encodeDuel(challenge))`. */
  href: string;
  /** The message that travels with the link. */
  message?: string;
  /** How it went out. */
  onShare?: (method: 'share' | 'copy') => void;
  labels?: DuelInviteLabels;
};

function DuelInvite({ href, message, onShare, labels, className, ...props }: DuelInviteProps) {
  const [canShare, setCanShare] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [failed, setFailed] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    return () => clearTimeout(timer.current);
  }, []);

  // Clear, then set a moment later, so a second copy is announced again.
  const announce = (text: string) => {
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(text), 50);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message ? `${message} ${href}` : href);
      setFailed(false);
      announce(labels?.copied ?? 'Link copied.');
      onShare?.('copy');
    } catch {
      setFailed(true);
      announce(labels?.copyFailed ?? 'Copy failed. Select the link and copy it.');
    }
  };

  const share = async () => {
    try {
      await navigator.share(message ? { text: message, url: href } : { url: href });
      onShare?.('share');
    } catch (error) {
      // Closed the sheet: nothing to say. Anything else: copy instead.
      if ((error as Error)?.name !== 'AbortError') await copy();
    }
  };

  return (
    <div
      data-slot="duel-invite"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('border-border bg-card text-card-foreground grid gap-3 rounded-xl border p-5', className)}
      {...props}
    >
      <p data-slot="duel-invite-title" className="font-heading flex items-center gap-2 font-semibold">
        <Swords aria-hidden className="text-primary size-5 shrink-0" />
        {labels?.title ?? 'Challenge a friend to the same game'}
      </p>
      <div data-slot="duel-invite-actions" className="flex flex-wrap gap-2">
        {canShare ? (
          <Button type="button" onClick={share}>
            <Share2 aria-hidden />
            {labels?.share ?? 'Send a challenge'}
          </Button>
        ) : null}
        <Button type="button" variant={canShare ? 'outline' : 'default'} onClick={copy}>
          <Copy aria-hidden />
          {labels?.copy ?? 'Copy link'}
        </Button>
      </div>
      {failed ? (
        <input
          readOnly
          value={href}
          aria-label={labels?.field ?? 'Challenge link'}
          onFocus={(e) => e.currentTarget.select()}
          className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
        />
      ) : null}
      <span data-slot="duel-invite-status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  );
}
DuelInvite.displayName = 'DuelInvite';

// --- DuelCard -------------------------------------------------------------------

interface DuelCardLabels {
  /** @default (name) => `${name} challenged you` */
  title?: (name: string) => string;
  /** @default (score) => `${score} points to beat.` */
  score?: (score: string) => string;
  /** @default 'Play the same game' */
  accept?: string;
}

type DuelCardProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  /** Who sent it. */
  name: string;
  /** Their score. */
  score: number;
  /** Starts the game. Leave out to show no button. */
  onAccept?: () => void;
  /** Under the score: what the game is, how long it takes. */
  description?: React.ReactNode;
  format?: Intl.NumberFormatOptions;
  locale?: string;
  labels?: DuelCardLabels;
};

function DuelCard({ name, score, onAccept, description, format, locale, labels, className, ...props }: DuelCardProps) {
  const headingId = React.useId();
  const nf = new Intl.NumberFormat(locale, format);
  return (
    <section
      data-slot="duel-card"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-labelledby={headingId}
      className={cn(
        'border-border bg-card text-card-foreground grid justify-items-start gap-3 rounded-xl border p-5',
        className,
      )}
      {...props}
    >
      <Swords aria-hidden className="text-primary size-6" />
      <h2 id={headingId} data-slot="duel-card-title" className="font-heading text-xl font-semibold">
        {(labels?.title ?? ((n: string) => `${n} challenged you`))(name)}
      </h2>
      <p data-slot="duel-card-score" className="text-lg tabular-nums">
        {(labels?.score ?? ((s: string) => `${s} points to beat.`))(nf.format(score))}
      </p>
      {description ? <div className="text-muted-foreground text-sm">{description}</div> : null}
      {onAccept ? (
        <Button data-slot="duel-card-accept" type="button" size="lg" className="mt-1" onClick={onAccept}>
          {labels?.accept ?? 'Play the same game'}
        </Button>
      ) : null}
    </section>
  );
}
DuelCard.displayName = 'DuelCard';

// --- DuelCompare ----------------------------------------------------------------

interface DuelCompareLabels {
  /** The verdict. Gets the winner's name (or null on a tie), the margin and the totals, formatted. */
  verdict?: (r: { winner: string | null; you: boolean; margin: string; total: string }) => string;
  /** @default 'vs' */
  versus?: string;
  /** On the winner. @default 'Won' */
  won?: string;
  /** @default (n) => n === 1 ? '1 round won' : `${n} rounds won` */
  roundsWon?: (n: number) => string;
  /** @default (n) => `Round ${n}` */
  round?: (n: number) => string;
  /** The rounds column, for assistive tech. @default 'Round' */
  roundColumn?: string;
  /** Spoken in the winner's cell. @default 'won the round' */
  roundWinner?: string;
  /** For a round a player did not play. @default 'not played' */
  missing?: string;
  /** Names the table. @default 'Round by round' */
  caption?: string;
}

const VERDICT: NonNullable<DuelCompareLabels['verdict']> = ({ winner, you, margin, total }) =>
  winner === null
    ? `A tie, at ${total} points each.`
    : you
      ? `You won by ${margin} points.`
      : `${winner} won by ${margin} points.`;

type DuelCompareProps = Omit<React.ComponentProps<'section'>, 'children'> & {
  /** Usually the challenger. */
  a: DuelPlayer;
  /** Usually the viewer. */
  b: DuelPlayer;
  /** Which side is the viewer, so the verdict says "You". */
  you?: 'a' | 'b';
  /** 'asc' when fewer points is better (time, guesses). @default 'desc' */
  order?: 'desc' | 'asc';
  /** Grow the bars on mount. @default true */
  animate?: boolean;
  format?: Intl.NumberFormatOptions;
  locale?: string;
  labels?: DuelCompareLabels;
};

function Bar({ value, max, side, win }: { value: number | null; max: number; side: 'a' | 'b'; win: boolean }) {
  const pct = value === null || max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span
      aria-hidden
      className={cn('flex h-2 w-full @sm:w-auto @sm:flex-1', side === 'a' ? 'justify-end' : 'justify-start')}
    >
      <span
        data-slot="duel-compare-bar"
        className={cn(
          'block h-full rounded-full',
          side === 'a' ? 'origin-right rtl:origin-left' : 'origin-left rtl:origin-right',
          win ? 'bg-primary' : 'bg-muted-foreground/40',
        )}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

function DuelCompare({
  a,
  b,
  you,
  order = 'desc',
  animate = true,
  format,
  locale,
  labels,
  className,
  ...props
}: DuelCompareProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const [cheer, setCheer] = React.useState(0);
  const result = compareDuel(a, b, { order });
  const nf = new Intl.NumberFormat(locale, format);
  const L = labels ?? {};
  const players = { a, b };
  const max = Math.max(0, ...result.rounds.flatMap((r) => [r.a ?? 0, r.b ?? 0]));
  const youWon = you !== undefined && result.winner === you;
  const fmt = (v: number | null) => (v === null ? (L.missing ?? 'not played') : nf.format(v));

  React.useEffect(() => {
    if (!animate || reduced) return;
    const bars = ref.current?.querySelectorAll<HTMLElement>('[data-slot="duel-compare-bar"]') ?? [];
    const running: Animation[] = [];
    bars.forEach((bar, i) => {
      if (typeof bar.animate !== 'function') return;
      running.push(
        bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
          duration: 400,
          delay: Math.floor(i / 2) * 40,
          easing: EASE,
          fill: 'backwards',
        }),
      );
    });
    // Cheer only when someone celebrates: a late state update with nothing to
    // show re-renders the result for no reason, mid-way through an a11y scan.
    const t = youWon
      ? setTimeout(() => setCheer((c) => c + 1), Math.floor(bars.length / 2) * 40 + 400)
      : undefined;
    return () => {
      clearTimeout(t);
      running.forEach((r) => r.cancel());
    };
    // Once on mount: new a/b values update the bars in place and don't re-animate.
    // eslint-disable-next-line react-features/hooks-exhaustive-deps -- youWon is read once, like a/b.
  }, [animate, reduced]);

  const verdict = (L.verdict ?? VERDICT)({
    winner: result.winner === 'tie' ? null : players[result.winner].name,
    you: youWon,
    margin: nf.format(result.margin),
    total: nf.format(result.totals.a),
  });

  const head = (side: 'a' | 'b') => {
    const p = players[side];
    const won = result.winner === side;
    const total = <span className="text-3xl font-semibold tabular-nums">{nf.format(result.totals[side])}</span>;
    return (
      <div
        data-slot="duel-compare-player"
        data-side={side}
        data-won={won ? '' : undefined}
        className={cn(
          'flex min-w-0 flex-col gap-1 rounded-xl border p-3',
          side === 'a' ? 'items-end text-end' : 'items-start text-start',
          won ? 'border-primary' : 'border-border',
        )}
      >
        <span
          className={cn(
            'flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1',
            side === 'a' ? 'justify-end' : 'justify-start',
          )}
        >
          <span className="min-w-0 font-semibold break-words">{p.name}</span>
          {won ? (
            <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 text-xs leading-5 font-semibold">
              {L.won ?? 'Won'}
            </span>
          ) : null}
        </span>
        {won && youWon ? (
          <Celebrate play={cheer || null} tone="highlight">
            {total}
          </Celebrate>
        ) : (
          total
        )}
        <span className="text-muted-foreground text-xs tabular-nums">
          {(L.roundsWon ?? ((n: number) => (n === 1 ? '1 round won' : `${n} rounds won`)))(result.won[side])}
        </span>
      </div>
    );
  };

  const cell = (side: 'a' | 'b', r: (typeof result.rounds)[number]) => {
    const value = r[side];
    const win = r.winner === side;
    return (
      <td className={cn('py-2 tabular-nums', side === 'a' ? 'pe-2 text-end' : 'ps-2 text-start')}>
        <span
          className={cn(
            'flex flex-col gap-1 @sm:items-center @sm:gap-2',
            side === 'a' ? 'items-end @sm:flex-row-reverse' : 'items-start @sm:flex-row',
            win ? 'font-semibold' : 'text-muted-foreground',
          )}
        >
          <span className="shrink-0 @sm:w-14">{fmt(value)}</span>
          <Bar value={value} max={max} side={side} win={win} />
          {win ? <span className="sr-only">{L.roundWinner ?? 'won the round'}</span> : null}
        </span>
      </td>
    );
  };

  return (
    <section
      ref={ref}
      data-slot="duel-compare"
      data-winner={result.winner}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('@container grid gap-4', className)}
      {...props}
    >
      <p data-slot="duel-compare-verdict" className="font-heading text-center text-xl font-semibold">
        {verdict}
      </p>
      <div data-slot="duel-compare-players" className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        {head('a')}
        <span className="text-muted-foreground self-center text-sm">{L.versus ?? 'vs'}</span>
        {head('b')}
      </div>
      {result.rounds.length ? (
        <table data-slot="duel-compare-rounds" className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">{L.caption ?? 'Round by round'}</caption>
          <colgroup>
            <col />
            <col className="w-20" />
            <col />
          </colgroup>
          <thead className="sr-only">
            <tr>
              <th scope="col">{a.name}</th>
              <th scope="col">{L.roundColumn ?? 'Round'}</th>
              <th scope="col">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {result.rounds.map((r) => (
              <tr key={r.round} data-winner={r.winner} className="border-border border-t first:border-t-0">
                {cell('a', r)}
                <th scope="row" className="text-muted-foreground py-2 text-center text-xs font-normal">
                  {(L.round ?? ((n: number) => `Round ${n}`))(r.round)}
                </th>
                {cell('b', r)}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
DuelCompare.displayName = 'DuelCompare';

export { DuelInvite, DuelCard, DuelCompare };
export type { DuelInviteProps, DuelInviteLabels, DuelCardProps, DuelCardLabels, DuelCompareProps, DuelCompareLabels };
export type { DuelSide };
