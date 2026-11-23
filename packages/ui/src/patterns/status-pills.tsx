/**
 * @interlace/ui — StatusPills
 *
 * A row of short facts about the page, set as pills: "Checked by a second
 * reader", "9 facts", "38 sources quoted", "About 1 minute out loud". Built
 * to sit on a brand band (`<Section tone="brand">`) under a title, and just
 * as readable on the page background.
 *
 * ## Tones
 *
 * | `tone`    | Pill                                                         |
 * | --------- | ------------------------------------------------------------ |
 * | `default` | A tint of the surrounding text colour, text inherited        |
 * | `ok`      | A solid page-background pill, bold, with a check in success  |
 *
 * `default` takes its colour from the band it sits on (`currentColor`), so
 * one component serves a dark band and a light page without a prop. `ok` is
 * the one that should be seen first: a passed check. Its check mark is
 * decoration; the words say what passed.
 *
 * ## Anatomy
 *
 *   StatusPills                (ul — data-slot="status-pills", a wrapping row)
 *     └─ StatusPill × n        (li — data-tone)
 *         ├─ check             (svg, aria-hidden — `ok` only)
 *         └─ children
 *
 * ## MIN_VIEWPORT — 320
 *
 * Pills wrap onto as many lines as they need.
 *
 * | Rule | Concept                 | Where in this file                                       |
 * | ---- | ----------------------- | -------------------------------------------------------- |
 * | R4   | Extends native el       | `ul` / `li` props                                        |
 * | R6   | data-slot per part      | status-pills / status-pill / status-pill-check          |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                        |
 * | R8   | Enums, not booleans     | `tone`                                                   |
 * | R14  | Declares min viewport   | `data-min-viewport` on the root + exported const         |
 * | R19  | Tokens only             | `bg-current/12`, `bg-background`, `text-success`         |
 * | R25  | Server component        | No hooks → no `'use client'`                             |
 * | R26  | A11y from native el     | A list; the check is hidden, the words carry the meaning |
 */

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

export type StatusPillTone = 'default' | 'ok';

type StatusPillsProps = React.ComponentProps<'ul'>;

function StatusPills({ className, ...props }: StatusPillsProps) {
  return (
    <ul
      data-slot="status-pills"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex list-none flex-wrap items-center gap-2.5 ps-0', className)}
      {...props}
    />
  );
}

const TONE: Record<StatusPillTone, string> = {
  default: 'bg-current/12 font-medium',
  ok: 'bg-background text-foreground font-bold',
};

type StatusPillProps = React.ComponentProps<'li'> & {
  /** `ok` marks a passed check. @default 'default' */
  tone?: StatusPillTone;
};

function StatusPill({ tone = 'default', className, children, ...props }: StatusPillProps) {
  return (
    <li
      data-slot="status-pill"
      data-tone={tone}
      className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm leading-none', TONE[tone], className)}
      {...props}
    >
      {tone === 'ok' ? (
        <Check aria-hidden data-slot="status-pill-check" className="text-success size-4 shrink-0" strokeWidth={3} />
      ) : null}
      {children}
    </li>
  );
}

const StatusPillsWithItem = Object.assign(StatusPills, { Item: StatusPill });

export { StatusPillsWithItem as StatusPills, StatusPill };
export type { StatusPillsProps, StatusPillProps };
