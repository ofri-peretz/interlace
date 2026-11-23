/**
 * @interlace/ui — SideBySide
 *
 * Two (or three) accounts of the same thing, set next to each other so the
 * reader compares them line by line: what is said and what the record shows,
 * before and after, one source and another. Columns stack on narrow screens,
 * in source order, so the comparison still reads top to bottom.
 *
 * ## Anatomy
 *
 *   SideBySide                        (div — grid, data-min-viewport=320)
 *     └─ SideBySideColumn × 2–3       (section, labelled by its title)
 *         ├─ title                    (h3 by default — with an optional tone bar)
 *         └─ children
 *
 * ## MIN_VIEWPORT — 320
 *
 * One column below `md`; two or three from `md` up.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `div` / `section` props                                     |
 * | R6   | data-slot per part               | side-by-side / side-by-side-column                          |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enums, not booleans              | `tone`, `as`                                                |
 * | R14  | Declares min viewport            | `data-min-viewport` on the root + exported const            |
 * | R19  | Tokens only                      | `bg-card`, tone tokens on the top border                    |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | Each column is a `section` named by its heading (useId)     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

export type SideBySideTone = 'neutral' | 'success' | 'warning' | 'info' | 'destructive' | 'highlight';

const TONE_BORDER: Record<SideBySideTone, string> = {
  neutral: 'border-t-border',
  success: 'border-t-success',
  warning: 'border-t-warning',
  info: 'border-t-info',
  destructive: 'border-t-destructive',
  highlight: 'border-t-highlight',
};

function SideBySide({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="side-by-side"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-4 md:auto-cols-fr md:grid-flow-col', className)}
      {...props}
    />
  );
}

type SideBySideColumnProps = Omit<React.ComponentProps<'section'>, 'title'> & {
  /** The column heading: "What you hear", "What the record shows". */
  title: React.ReactNode;
  /** Colour of the bar above the column. Meaning lives in the title. @default 'neutral' */
  tone?: SideBySideTone;
  /** Heading level, to fit the page outline. @default 'h3' */
  as?: 'h2' | 'h3' | 'h4';
};

function SideBySideColumn({
  title,
  tone = 'neutral',
  as: Heading = 'h3',
  className,
  children,
  ...props
}: SideBySideColumnProps) {
  const id = React.useId();
  return (
    <section
      data-slot="side-by-side-column"
      aria-labelledby={id}
      className={cn(
        'bg-card text-card-foreground border-border space-y-3 rounded-xl border border-t-4 p-5',
        TONE_BORDER[tone],
        className,
      )}
      {...props}
    >
      <Heading id={id} className="text-lg font-semibold">
        {title}
      </Heading>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

const SideBySideWithDot = Object.assign(SideBySide, { Column: SideBySideColumn });

export { SideBySideWithDot as SideBySide, SideBySideColumn };
export type { SideBySideColumnProps };
