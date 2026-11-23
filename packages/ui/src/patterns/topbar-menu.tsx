'use client';

/**
 * @interlace/ui — TopbarMenu
 *
 * The small-screen half of `Topbar`: a "Menu" button that opens the site's
 * links in a side sheet. Topbar renders it for you below `md`; it is exported
 * on its own for headers that compose their own row.
 *
 * The links are rendered by the caller (Topbar renders them on the server)
 * and passed in as `children`, so this file holds only the open state. The
 * sheet comes from `Sheet` (Base UI Dialog): focus moves into it, the page
 * behind is inert, and Escape or a press outside closes it. Following a link
 * inside also closes it, so a client-side route change never leaves the menu
 * open over the new page.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R6   | data-slot per part      | topbar-menu-trigger / topbar-menu-nav                 |
 * | R12  | Reuse over wrap         | focus trap, inerting and dismissal come from Sheet    |
 * | R25  | Client component        | open state                                           |
 * | R26  | A11y from native el     | `<button>` with a text label, `<nav>` landmark        |
 */

import { MenuIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../primitives/sheet.js';

export interface TopbarMenuProps {
  /** The links, already rendered. Usually a list of anchors. */
  children: React.ReactNode;
  /** Visible label of the menu button, also the sheet's title. @default 'Menu' */
  label?: string;
  /** Accessible name of the navigation inside the sheet. @default 'Primary' */
  navLabel?: string;
  /** Extra classes for the trigger button. */
  className?: string;
}

export function TopbarMenu({ children, label = 'Menu', navLabel = 'Primary', className }: TopbarMenuProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        data-slot="topbar-menu-trigger"
        className={cn(
          'text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium focus-visible:ring-[3px] focus-visible:outline-hidden',
          className,
        )}
      >
        <MenuIcon aria-hidden className="size-5" />
        {label}
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>
        <nav
          aria-label={navLabel}
          data-slot="topbar-menu-nav"
          className="flex flex-col px-2 pb-6 text-base"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
        >
          {children}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
