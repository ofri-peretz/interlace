"use client";

/**
 * @interlace/ui — TopbarMenu
 *
 * The small-screen half of `Topbar`: a "Menu" button that opens the site's
 * links in a panel at the edge of the screen. Topbar renders it for you below
 * `md`; it is exported on its own for headers that compose their own row.
 *
 * The links are rendered by the caller (Topbar renders them on the server)
 * and passed in as `children`, so this file holds only the open state. The
 * panel is a `Drawer` (Base UI Drawer): on a phone a finger drags it back
 * toward its edge to close it, as native menus do, and the panel follows the
 * finger. Focus moves into it, the page behind is inert, and Escape or a
 * press outside closes it. Following an `<a>` inside also closes it, so a
 * client-side route change never leaves the menu open over the new page.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R6   | data-slot per part      | topbar-menu-trigger / topbar-menu-nav                 |
 * | R8   | Enum for edge           | `side = right | left | bottom | full` (default right) |
 * | R12  | Reuse over wrap         | gesture, focus trap and dismissal come from Drawer    |
 * | R25  | Client component        | open state                                           |
 * | R26  | A11y from native el     | `<button>` with a text label, `<nav>` landmark        |
 */

import { MenuIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn.js";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../primitives/drawer.js";

export interface TopbarMenuProps {
  /** The links, already rendered. Usually a list of anchors. */
  children: React.ReactNode;
  /** Visible label of the menu button, also the panel's title. @default 'Menu' */
  label?: string;
  /** Accessible name of the navigation inside the panel. @default 'Primary' */
  navLabel?: string;
  /** The edge the panel opens from; a drag back toward it closes it. @default 'right' */
  side?: "right" | "left" | "bottom" | "full";
  /** Extra classes for the trigger button. */
  className?: string;
}

export function TopbarMenu({
  children,
  label = "Menu",
  navLabel = "Primary",
  side = "right",
  className,
}: TopbarMenuProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      direction={side === "full" ? "top" : side}
    >
      <DrawerTrigger
        data-slot="topbar-menu-trigger"
        className={cn(
          "text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden",
          className,
        )}
      >
        <MenuIcon aria-hidden className="size-5" />
        {label}
      </DrawerTrigger>
      <DrawerContent
        data-full={side === "full" ? "" : undefined}
        className={
          side === "full"
            ? "h-dvh max-h-dvh rounded-none border-b-0"
            : undefined
        }
      >
        <DrawerHeader>
          <DrawerTitle>{label}</DrawerTitle>
        </DrawerHeader>
        <nav
          aria-label={navLabel}
          data-slot="topbar-menu-nav"
          className={cn(
            "flex flex-col px-2 pb-6 text-base",
            // The links arrive in a quick cascade, inside the 150ms stagger window.
            "motion-safe:[&>*]:animate-in motion-safe:[&>*]:fade-in-0 motion-safe:[&>*]:slide-in-from-top-1 motion-safe:[&>*]:fill-mode-both motion-safe:[&>*]:duration-(--duration-base) motion-safe:[&>*]:ease-enter",
            "[&>*:nth-child(2)]:delay-20 [&>*:nth-child(3)]:delay-40 [&>*:nth-child(4)]:delay-60 [&>*:nth-child(5)]:delay-80 [&>*:nth-child(6)]:delay-100 [&>*:nth-child(7)]:delay-120 [&>*:nth-child(n+8)]:delay-140",
            side === "full" && "px-4 text-lg",
          )}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
