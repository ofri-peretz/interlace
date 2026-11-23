/**
 * @interlace/ui — ThreadMark
 *
 * Interlace's thread, drawn as a state. Where a generic kit reaches for a
 * spinner, an empty-box icon and a red warning triangle, Interlace says the
 * same things with its one motif:
 *
 * | `state`   | What the thread does                            | Use it for                   |
 * | --------- | ----------------------------------------------- | ---------------------------- |
 * | `woven`   | Two strands cross twice, knotted at each end    | Done, connected, verified    |
 * | `drawing` | The woven pair draws in, over and over          | Loading, working             |
 * | `loose`   | One strand leaves a knot and trails off, untied | Empty: nothing woven yet     |
 * | `cut`     | One strand, snapped: two halves that never meet | Error: the thread was broken |
 *
 * `--strand-b` appears only in the woven gestures (`woven`, `drawing`), as the
 * brand rule asks: a single strand is never two-coloured.
 *
 * ## The meaning is in the words, not the mark
 *
 * The mark is always `aria-hidden`. It sits beside a title ("No sources
 * yet", "Could not load the sources"), inside an `EmptyState`'s `icon` slot,
 * or inside a `DataState` that already says `aria-busy` and announces the
 * state. Colour and shape only repeat what the text says, so the mark never
 * needs a label of its own.
 *
 * ## Motion
 *
 * `drawing` loops the draw verb's dash (pathLength 100, one keyframe for
 * every geometry). Under `prefers-reduced-motion: reduce` the loop is
 * removed outright and the pair rests fully woven, so a reduced-motion
 * reader sees a still thread and reads "Loading" from the text beside it.
 * Every other state is still.
 *
 * ## Sizes
 *
 * `sm` sits inline with body text, `md` beside a heading or in a button, and
 * `lg` is the illustration in an empty or error panel. The stroke scales with
 * the mark, so it reads at every size without a separate drawing.
 *
 * | Rule | Concept                 | Where in this file                                 |
 * | ---- | ----------------------- | -------------------------------------------------- |
 * | R4   | Extends native el       | `svg` props, minus children and aria-hidden        |
 * | R6   | data-slot + data-state  | `thread-mark`, `data-state={state}`                |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                  |
 * | R8   | Enums, not booleans     | `state`, `size`                                    |
 * | R19  | Tokens only             | `stroke-strand-a/-b`, `fill-foreground`            |
 * | R25  | Server component        | Pure render; the loop is CSS                       |
 * | R26  | A11y                    | Always hidden; the words beside it carry meaning   |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export type ThreadMarkState = 'woven' | 'drawing' | 'loose' | 'cut';

const SIZE = {
  sm: 'h-3 w-6',
  md: 'h-5 w-10',
  lg: 'h-12 w-24',
} as const;

/** Two strands that leave the left knot together, cross twice, and meet at the right. */
const WOVEN = [
  'M4 12 C12 2, 18 2, 24 12 S36 22, 44 12',
  'M4 12 C12 22, 18 22, 24 12 S36 2, 44 12',
] as const;

/** One strand from the knot, trailing off with nothing to tie to. */
const LOOSE = 'M4 12 C12 2, 20 2, 26 12 S38 21, 45 18';

/** One strand, snapped: two halves that no longer meet. */
const CUT = ['M4 12 C10 4, 15 4, 19 9', 'M29 15 C33 20, 38 20, 44 12'] as const;

const STROKE = {
  fill: 'none',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export interface ThreadMarkProps extends Omit<
  React.ComponentPropsWithoutRef<'svg'>,
  'children' | 'aria-hidden'
> {
  /** What the thread says. @default 'woven' */
  state?: ThreadMarkState;
  /** `sm` inline, `md` beside a heading, `lg` in an empty or error panel. @default 'md' */
  size?: keyof typeof SIZE;
}

function Knot({ x }: { x: number }) {
  return <circle cx={x} cy={12} r={2.5} className="fill-foreground" />;
}

export function ThreadMark({ state = 'woven', size = 'md', className, ...props }: ThreadMarkProps) {
  return (
    <svg
      data-slot="thread-mark"
      data-state={state}
      viewBox="0 0 48 24"
      className={cn('inline-block shrink-0 overflow-visible', SIZE[size], className)}
      {...props}
      aria-hidden
      focusable="false"
    >
      {state === 'woven' || state === 'drawing' ? (
        <>
          {WOVEN.map((d, i) => (
            <path
              key={d}
              d={d}
              pathLength={100}
              {...STROKE}
              className={cn(
                i === 0 ? 'stroke-strand-a' : 'stroke-strand-b',
                state === 'drawing' && 'animate-strand-loop [stroke-dasharray:100]',
              )}
            />
          ))}
          <Knot x={4} />
          <Knot x={44} />
        </>
      ) : state === 'loose' ? (
        <>
          <path d={LOOSE} {...STROKE} className="stroke-strand-a" />
          <Knot x={4} />
        </>
      ) : (
        <>
          {CUT.map((d) => (
            <path key={d} d={d} {...STROKE} className="stroke-strand-a" />
          ))}
          <Knot x={4} />
          <Knot x={44} />
        </>
      )}
    </svg>
  );
}
