/**
 * @interlace/ui — Pagination
 *
 * The page-navigation bar: a `<nav aria-label="pagination">` of anchor links
 * with previous / next / ellipsis parts. It is presentation only — it computes
 * no page numbers and knows no total.
 *
 * The caller renders the items and marks one with `active`, which emits
 * `aria-current="page"` and the outline face.
 *
 * ## Anatomy
 *
 *   Pagination                       (nav — aria-label=pagination, data-min-viewport=320)
 *     └─ PaginationContent           (ul — flex-wrap)
 *          └─ PaginationItem         (li)
 *               ├─ PaginationLink        (a — buttonVariants, active ⇒ outline + aria-current)
 *               ├─ PaginationPrevious    (a — chevron + label, label hidden below sm)
 *               ├─ PaginationNext        (a — label + chevron, label hidden below sm)
 *               └─ PaginationEllipsis    (span — aria-hidden icon + sr-only "More pages")
 *
 * Links, not buttons: every part renders an `<a>`, so there is no disabled
 * state. A "previous" on page one has to be omitted by the caller rather than
 * disabled, and an anchor with no `href` is not keyboard-focusable.
 *
 * `PaginationLink` also accepts a deprecated `isActive` alias for `active`,
 * kept only so shadcn-shaped call sites keep working; `active` wins when both
 * are passed.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Prev/Next collapse to icon-only below `sm` (`hidden sm:block` on the
 * labels), and the list is `flex-wrap` — without the wrap a nine-page bar
 * measured 444px inside a 375px viewport and pushed the page sideways.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'nav' | 'ul' | 'li' | 'a' | 'span'>`  |
 * | R6   | data-slot per part               | pagination / -content / -item / -link / -ellipsis           |
 * | R7   | cn + ...rest                     | `cn(buttonVariants({…}), className)` + `{...props}`         |
 * | R8   | No `isXxx`                       | `active`; `isActive` survives only as a deprecated alias    |
 * | R12  | Reuse over wrap                  | the link face is `buttonVariants`, not a second class list  |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R19  | Tokens only                      | all colour arrives via `buttonVariants`                     |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y                             | `aria-current="page"`; the ellipsis hides its ICON, not its wrapper, so the sr-only text survives |
 */

import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from 'lucide-react';

import { cn } from '../lib/cn.js';
import { buttonVariants } from './button.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. Prev/Next collapse
 * to icon-only below `sm` (`hidden sm:block` on the labels), so a 5-item bar
 * fits 320px without wrapping.
 */
export const MIN_VIEWPORT = 320 as const;

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      // flex-wrap: without it an N-page bar is one unbreakable row that
      // overflows any container narrower than its content (a 9-page bar
      // measured 444px inside a 375px viewport and pushed the page sideways).
      className={cn(
        'flex flex-row flex-wrap items-center justify-center gap-1',
        className,
      )}
      {...props}
    />
  );
}

function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  /**
   * Marks the link as the page the reader is on — renders `aria-current="page"`
   * and the outline treatment.
   *
   * @default false
   */
  active?: boolean;
  /**
   * @deprecated Use `active`. The `is`-prefixed name violates the boolean
   * naming contract (CONVENTIONS.md → Naming) and is kept only so existing
   * shadcn-shaped call sites keep working. Removed in the next major.
   */
  isActive?: boolean;
  size?: VariantProps<typeof buttonVariants>['size'];
} & React.ComponentProps<'a'>;

function PaginationLink({
  className,
  active,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) {
  const current = active ?? isActive ?? false;
  return (
    <a
      aria-current={current ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={current}
      className={cn(
        buttonVariants({
          variant: current ? 'outline' : 'ghost',
          size,
        }),
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn('gap-1 px-2.5 sm:pl-2.5', className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn('gap-1 px-2.5 sm:pr-2.5', className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    // `aria-hidden` sits on the ICON, not the wrapper: hiding the wrapper
    // would also hide the sr-only text inside it, leaving the gap in the page
    // sequence silent for screen-reader users.
    <span
      data-slot="pagination-ellipsis"
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontalIcon aria-hidden className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
export type { PaginationLinkProps };
