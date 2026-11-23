/**
 * @interlace/ui — StanceList
 *
 * Who holds which position on a question. Each row names a holder (a person,
 * a group, a school of thought), labels their position with a toned badge,
 * and says it in a sentence or two, optionally with a source.
 *
 * Built for writing that has to be fair to every side: a debate summary, a
 * "where people stand" box, the positions in a policy review. The tone of a
 * badge is the page's choice, so the list itself takes no side.
 *
 * ## Anatomy
 *
 *   StanceList                        (ul — data-min-viewport=320)
 *     └─ StanceItem × n               (li)
 *         ├─ holder                   (p — font-medium)
 *         ├─ Badge                    (position label, toned)
 *         └─ children                 (div — the position in words; may hold Citation)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Text rows; the holder and badge wrap onto two lines when space runs out.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `ul` / `li` props                                           |
 * | R6   | data-slot per part               | stance-list / stance-item                                   |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enums, not booleans              | `tone`                                                      |
 * | R14  | Declares min viewport            | `data-min-viewport` on the root + exported const            |
 * | R19  | Tokens only                      | Badge tones, `border-border`, `text-muted-foreground`       |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | A real list; the label is text, not colour alone            |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Badge } from '../primitives/badge.js';

export const MIN_VIEWPORT = 320 as const;

export type StanceTone = 'neutral' | 'success' | 'warning' | 'info' | 'destructive' | 'highlight';

const TONE_TO_VARIANT = {
  neutral: 'outline',
  success: 'success',
  warning: 'warning',
  info: 'info',
  destructive: 'destructive',
  highlight: 'highlight',
} as const satisfies Record<StanceTone, React.ComponentProps<typeof Badge>['variant']>;

function StanceList({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="stance-list"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('divide-border border-border divide-y rounded-xl border', className)}
      {...props}
    />
  );
}

type StanceItemProps = React.ComponentProps<'li'> & {
  /** Who holds the position. */
  holder: React.ReactNode;
  /** The position in a word or two: "Supports", "Opposes", "Mixed". The text carries the meaning; the tone only reinforces it. */
  stance: React.ReactNode;
  /** Badge colour for the position. @default 'neutral' */
  tone?: StanceTone;
};

function StanceItem({ holder, stance, tone = 'neutral', className, children, ...props }: StanceItemProps) {
  return (
    <li data-slot="stance-item" className={cn('space-y-2 p-4', className)} {...props}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-medium">{holder}</p>
        <Badge variant={TONE_TO_VARIANT[tone]}>{stance}</Badge>
      </div>
      {children ? <div className="text-muted-foreground text-sm leading-relaxed">{children}</div> : null}
    </li>
  );
}

const StanceListWithDot = Object.assign(StanceList, { Item: StanceItem });

export { StanceListWithDot as StanceList, StanceItem };
export type { StanceItemProps };
