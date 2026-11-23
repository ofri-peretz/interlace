/**
 * @interlace/ui — ClaimCard
 *
 * One claim, examined. The card quotes a claim as a reader heard it, gives a
 * short answer, and keeps the evidence one click away in collapsible
 * sections: the facts and their sources, who makes the claim, where the
 * record is contested, what the answer does not say, what could not be
 * verified. A status row on top carries review badges; a footer carries
 * whatever the page needs (an id, a date, a share link).
 *
 * Built for fact checks, explainers and FAQs that have to show their work.
 * The parts are slots, so a page decides which sections exist and in what
 * order; nothing here knows what a "fact" is.
 *
 * ## Anatomy
 *
 *   ClaimCard                         (article — data-min-viewport=320)
 *     ├─ ClaimCardStatus              (div — a row of Badges)
 *     ├─ ClaimCardClaim               (h3 by default > q — heading face, quoted)
 *     ├─ ClaimCardAnswer              (p — may hold Citation markers)
 *     ├─ ClaimCardSection × n         (details > summary + body)
 *     └─ ClaimCardFooter              (footer — muted, small)
 *
 * ## Server rendering
 *
 * No hooks and no `'use client'`: the sections are native `<details>`, so
 * they open and close with no JavaScript, are keyboard-operable by default,
 * and are found by the browser's find-in-page even while closed.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Text and a single column of sections; the card is as wide as its parent.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `article` / `div` / `h3` / `p` / `details` / `footer` props |
 * | R6   | data-slot per part               | claim-card / -status / -claim / -answer / -section / -footer |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}` on every part             |
 * | R10  | Composition seam                 | Every part is a slot; sections take any children            |
 * | R14  | Declares min viewport            | `data-min-viewport` on the root + exported const            |
 * | R19  | Tokens only                      | `bg-card`, `border-border`, `text-muted-foreground`         |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<details>`/`<summary>`, `<q>`, heading level via `as`      |
 */

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

function ClaimCard({ className, ...props }: React.ComponentProps<'article'>) {
  return (
    <article
      data-slot="claim-card"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'bg-card text-card-foreground border-border flex flex-col gap-4 rounded-xl border p-6 shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

function ClaimCardStatus({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="claim-card-status"
      className={cn('flex flex-wrap items-center gap-2', className)}
      {...props}
    />
  );
}

type ClaimCardClaimProps = React.ComponentProps<'h3'> & {
  /** Heading level, to fit the page outline. @default 'h3' */
  as?: 'h2' | 'h3' | 'h4';
};

/** The claim, in quotation marks (`<q>`), set in the heading face (`--font-heading`). */
function ClaimCardClaim({ as: Tag = 'h3', className, children, ...props }: ClaimCardClaimProps) {
  return (
    <Tag
      data-slot="claim-card-claim"
      className={cn('font-heading text-2xl leading-snug font-semibold text-balance', className)}
      {...props}
    >
      <q>{children}</q>
    </Tag>
  );
}

function ClaimCardAnswer({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="claim-card-answer"
      className={cn('text-base leading-relaxed text-pretty', className)}
      {...props}
    />
  );
}

type ClaimCardSectionProps = Omit<React.ComponentProps<'details'>, 'title'> & {
  /** The summary line: "Facts and sources", "Who says this". */
  title: React.ReactNode;
  /** Shown after the title in muted text, e.g. a count or "3 of 4 sourced". */
  meta?: React.ReactNode;
};

/**
 * A collapsible section, as native `<details>`. Pass `open` to start it
 * expanded.
 */
function ClaimCardSection({ title, meta, className, children, ...props }: ClaimCardSectionProps) {
  return (
    <details
      data-slot="claim-card-section"
      className={cn('group border-border border-t pt-3', className)}
      {...props}
    >
      <summary className="hover:text-primary flex cursor-pointer list-none items-center gap-2 rounded-sm py-1 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0 -rotate-90 transition-transform group-open:rotate-0 motion-reduce:transition-none"
        />
        <span>{title}</span>
        {meta != null ? <span className="text-muted-foreground font-normal">({meta})</span> : null}
      </summary>
      <div data-slot="claim-card-section-body" className="space-y-3 pt-3 pb-1 ps-6 text-sm">
        {children}
      </div>
    </details>
  );
}

function ClaimCardFooter({ className, ...props }: React.ComponentProps<'footer'>) {
  return (
    <footer
      data-slot="claim-card-footer"
      className={cn('text-muted-foreground border-border border-t pt-3 text-sm', className)}
      {...props}
    />
  );
}

const ClaimCardWithDot = Object.assign(ClaimCard, {
  Status: ClaimCardStatus,
  Claim: ClaimCardClaim,
  Answer: ClaimCardAnswer,
  Section: ClaimCardSection,
  Footer: ClaimCardFooter,
});

export {
  ClaimCardWithDot as ClaimCard,
  ClaimCardStatus,
  ClaimCardClaim,
  ClaimCardAnswer,
  ClaimCardSection,
  ClaimCardFooter,
};
export type { ClaimCardClaimProps, ClaimCardSectionProps };
