/**
 * @interlace/ui — Dialogue
 *
 * A written conversation: a script of turns, each with a speaker. Use it for
 * a sample exchange ("what to say when your child asks…"), an interview
 * excerpt, or a worked example of a hard conversation. Turns from the two
 * sides sit on opposite edges so the back-and-forth reads at a glance, and
 * every turn names its speaker in text, so nothing depends on position or
 * colour.
 *
 * ## Anatomy
 *
 *   Dialogue                          (ol — data-min-viewport=320)
 *     └─ DialogueTurn × n             (li — data-side=start|end)
 *         ├─ speaker                  (p — small, muted, bold)
 *         └─ children                 (div — the bubble)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Bubbles cap at 85% of the column, so both sides still read at 320px.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `ol` / `li` props                                           |
 * | R6   | data-slot per part               | dialogue / dialogue-turn                                    |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enums, not booleans              | `side`                                                      |
 * | R14  | Declares min viewport            | `data-min-viewport` on the root + exported const            |
 * | R19  | Tokens only                      | `bg-muted`, `bg-accent`, `text-muted-foreground`            |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | An ordered list of turns; the speaker is text               |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

function Dialogue({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="dialogue"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-col gap-4', className)}
      {...props}
    />
  );
}

type DialogueTurnProps = React.ComponentProps<'li'> & {
  /** Who is speaking. Always shown. */
  speaker: React.ReactNode;
  /** Which edge the turn sits on. Keep one speaker per side. @default 'start' */
  side?: 'start' | 'end';
};

function DialogueTurn({ speaker, side = 'start', className, children, ...props }: DialogueTurnProps) {
  const end = side === 'end';
  return (
    <li
      data-slot="dialogue-turn"
      data-side={side}
      className={cn('flex max-w-[85%] flex-col gap-1', end ? 'items-end self-end' : 'items-start', className)}
      {...props}
    >
      <p className="text-muted-foreground text-xs font-semibold">{speaker}</p>
      <div
        className={cn(
          'rounded-2xl px-4 py-3 text-base leading-relaxed',
          end ? 'bg-accent text-accent-foreground rounded-se-sm' : 'bg-muted text-foreground rounded-ss-sm',
        )}
      >
        {children}
      </div>
    </li>
  );
}

const DialogueWithDot = Object.assign(Dialogue, { Turn: DialogueTurn });

export { DialogueWithDot as Dialogue, DialogueTurn };
export type { DialogueTurnProps };
