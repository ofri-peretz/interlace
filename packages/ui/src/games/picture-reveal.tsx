'use client';

/**
 * @interlace/ui — PictureReveal
 *
 * A picture under tiles that come away a few at a time while the room
 * guesses. The presenter moves `step`; every screen uncovers the same tiles
 * in the same seeded order, spread across the picture. Phones guess with
 * `TypeAnswer` (or `QuizQuestion`), and `guessPoints` pays an early right
 * guess more.
 *
 * A picture cannot be guessed by someone who cannot see it, so the round
 * carries `clues`: one line of text per step, shown and announced as the
 * tiles come off, so a screen reader user plays the same round. The image
 * has no text alternative until the reveal, when it gets `alt` and the
 * answer is said.
 *
 * ## Anatomy
 *
 *   PictureReveal                  (figure — data-slot="picture-reveal", data-state=hidden|revealing|revealed)
 *     ├─ div                       (data-slot="picture-reveal-frame": the picture and its tiles)
 *     │   ├─ img                   (alt only once revealed)
 *     │   └─ div aria-hidden       (data-slot="picture-reveal-tiles": span × cols·rows, data-off)
 *     ├─ ol                        (data-slot="picture-reveal-clues": the clues so far)
 *     ├─ span sr-only aria-live    (data-slot="picture-reveal-status": "6 of 16 tiles off. Clue: …")
 *     └─ figcaption                (data-slot="picture-reveal-answer": on the reveal)
 *
 * ## Motion
 *
 * Tiles that come off together fade and shrink away (`--duration-base`), staggered over
 * 150ms in all, so the eye sees where the picture opened. On the reveal the
 * rest go at once. Under reduced motion they are simply gone.
 *
 * ## MIN_VIEWPORT — 320
 *
 * | Rule | Concept                   | Where in this file                                  |
 * | ---- | ------------------------- | --------------------------------------------------- |
 * | R4   | Extends native el         | `figure` props                                      |
 * | R6   | data-slot per part        | picture-reveal / -frame / -tiles / -clues / -status / -answer |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}`                   |
 * | R8   | Enums, not booleans       | `size`                                              |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                |
 * | R26  | A11y                      | clues in step with the tiles; no alt until the reveal; status announced |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { revealOrder, tilesAt } from './picture-reveal-model.js';

export const MIN_VIEWPORT = 320 as const;

interface PictureRevealLabels {
  /** Announced as tiles come off. @default (off, total) => `${off} of ${total} tiles off.` */
  status?: (off: number, total: number) => string;
  /** Before a clue in the announcement. @default 'Clue:' */
  clue?: string;
  /** Names the clue list. @default 'Clues' */
  clues?: string;
  /** Announced on the reveal, before the answer. @default 'The answer:' */
  answer?: string;
}

type PictureRevealProps = Omit<React.ComponentProps<'figure'>, 'children'> & {
  src: string;
  /** The picture in words, given to the image only on the reveal. */
  alt: string;
  /** The answer, shown under the picture on the reveal. @default alt */
  answer?: React.ReactNode;
  /** How far along the round is, 0 to `steps`. */
  step: number;
  /** @default 8 */
  steps?: number;
  /** Show everything: the picture, its alt, the answer. */
  revealed?: boolean;
  /** @default 4 */
  cols?: number;
  /** @default 3 */
  rows?: number;
  /** Seeds the order the tiles come off. Use the round's id. */
  seed: number | string;
  /** One line of text per step, for everyone, and the only way to play without sight. */
  clues?: readonly string[];
  /** `stage` for a shared screen. @default 'default' */
  size?: 'default' | 'stage';
  labels?: PictureRevealLabels;
};

function PictureReveal({
  src,
  alt,
  answer,
  step,
  steps = 8,
  revealed = false,
  cols = 4,
  rows = 3,
  seed,
  clues = [],
  size = 'default',
  labels,
  className,
  ...props
}: PictureRevealProps) {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const total = c * r;
  const order = React.useMemo(() => revealOrder(total, seed), [total, seed]);
  const off = revealed ? total : tilesAt(step, steps, total);
  const rank = React.useMemo(() => {
    const m: number[] = Array.from({ length: total }, () => 0);
    order.forEach((tile, i) => {
      m[tile] = i;
    });
    return m;
  }, [order, total]);
  const shownClues = revealed ? clues : clues.slice(0, Math.min(clues.length, Math.max(0, Math.floor(step))));
  const prevOff = React.useRef(off);
  const before = prevOff.current;
  React.useEffect(() => {
    prevOff.current = off;
  }, [off]);
  const stage = size === 'stage';
  const lastClue = shownClues.at(-1);
  const status = revealed
    ? `${labels?.answer ?? 'The answer:'} ${alt}`
    : off === 0 && shownClues.length === 0
      ? ''
      : `${(labels?.status ?? ((o: number, t: number) => `${o} of ${t} tiles off.`))(off, total)}${lastClue ? ` ${labels?.clue ?? 'Clue:'} ${lastClue}` : ''}`;

  return (
    <figure
      data-slot="picture-reveal"
      data-state={revealed ? 'revealed' : off === 0 ? 'hidden' : 'revealing'}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-3', className)}
      {...props}
    >
      <div
        data-slot="picture-reveal-frame"
        className="bg-muted relative w-full overflow-hidden rounded-xl border"
        style={{ aspectRatio: `${c} / ${r}` }}
      >
        <img
          src={src}
          alt={revealed ? alt : ''}
          aria-hidden={revealed ? undefined : true}
          draggable={false}
          className="absolute inset-0 size-full object-cover select-none"
        />
        <div
          aria-hidden
          data-slot="picture-reveal-tiles"
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${c}, 1fr)`, gridTemplateRows: `repeat(${r}, 1fr)` }}
        >
          {Array.from({ length: total }, (_, tile) => {
            const k = rank[tile] as number;
            const gone = k < off;
            // Tiles leaving in this step share a 150ms stagger, in their reveal order.
            const leaving = gone && k >= before ? k - before : 0;
            const batch = Math.max(1, off - before);
            return (
              <span
                // Tiles are fixed places on the picture: the index is their identity.
                key={`tile-${tile}`}
                data-off={gone ? '' : undefined}
                className={cn(
                  'bg-card text-muted-foreground border-background grid place-items-center border-2 font-semibold',
                  stage ? 'text-3xl' : 'text-xl',
                  'motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-base) motion-safe:ease-exit',
                  gone && 'scale-90 opacity-0',
                )}
                style={
                  gone && !revealed && batch > 1
                    ? { transitionDelay: `${Math.round((leaving / batch) * 150)}ms` }
                    : undefined
                }
              >
                ?
              </span>
            );
          })}
        </div>
      </div>
      {clues.length > 0 ? (
        <ol
          data-slot="picture-reveal-clues"
          aria-label={labels?.clues ?? 'Clues'}
          className={cn('grid gap-1 empty:hidden', stage ? 'text-lg' : 'text-sm')}
        >
          {shownClues.map((clue, i) => (
            <li
              // Clues come in a fixed order; the position is their identity.
              key={`clue-${i}`}
              className="text-muted-foreground flex gap-2"
            >
              <span aria-hidden className="text-foreground font-semibold tabular-nums">
                {i + 1}.
              </span>
              <span>{clue}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <span data-slot="picture-reveal-status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {revealed ? (
        <figcaption
          data-slot="picture-reveal-answer"
          className={cn('font-heading font-semibold text-balance', stage ? 'text-section' : 'text-xl')}
        >
          {answer ?? alt}
        </figcaption>
      ) : null}
    </figure>
  );
}
PictureReveal.displayName = 'PictureReveal';

export { PictureReveal };
export type { PictureRevealProps, PictureRevealLabels };
