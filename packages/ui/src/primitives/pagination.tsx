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
