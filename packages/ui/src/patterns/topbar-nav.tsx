"use client";

/**
 * @interlace/ui — TopbarNav
 *
 * The wide-screen half of `Topbar` when its links hold groups: a row of plain
 * links and group triggers, where a group opens a panel of its items, each
 * with an optional icon and a one-line description. It is how a site that is
 * a family of products lists them without a second bar. Topbar renders it for
 * you from `collapseBelow` up; below that, groups become labelled sections of
 * the `TopbarMenu` drawer.
 *
 * ## Built on Base UI NavigationMenu
 *
 * A site's navigation is links, not an application menu, so this is the
 * navigation-menu pattern, not `role="menu"`: each trigger is a `<button>`
 * with `aria-expanded`, its panel holds ordinary links in reading order, Tab
 * walks into the open panel and on past it, Escape closes it and returns
 * focus to its trigger, and arrow keys move between triggers. Hovering a
 * trigger opens it after a short delay, and the panel slides between groups
 * instead of closing and reopening.
 *
 * ## Links are rendered by the server
 *
 * Topbar stays a server component, so `renderLink` (a function) never crosses
 * into this file: Topbar renders every link, and passes the finished elements
 * here as `entries`. This file holds only which panel is open. Following a
 * link inside a panel closes it, so a client-side route change never leaves
 * it open over the next page.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R6   | data-slot per part      | topbar-nav / -trigger / -panel / -popup               |
 * | R12  | Reuse over wrap         | keyboard, hover intent and dismissal from Base UI     |
 * | R19  | Tokens only             | `bg-popover` / `border-border` / `text-muted-foreground` |
 * | R25  | Client component        | which panel is open                                   |
 * | R26  | A11y                    | `<nav>` landmark, `<button aria-expanded>` triggers   |
 *
 * ## Motion
 *
 * A pill slides under whichever item the pointer is over and rests under an
 * open trigger. Between groups the panel resizes and its content slides in
 * the direction of travel. Under reduced motion the pill and panel still
 * appear, without moving.
 */

import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn.js";

/** One entry of the row, already rendered by Topbar. */
export type TopbarNavEntry =
  | { kind: "link"; key: string; node: React.ReactNode }
  | {
      kind: "group";
      key: string;
      label: React.ReactNode;
      /** True when one of the group's items is the current page. */
      current?: boolean;
      /** Two columns of items (more than three), so a wider panel. */
      wide?: boolean;
      /** The group's items, already rendered (a list). */
      node: React.ReactNode;
    };

export interface TopbarNavProps {
  entries: TopbarNavEntry[];
  /** Accessible name of the navigation landmark. @default 'Primary' */
  label?: string;
  className?: string;
}

/**
 * Every row item, link or trigger, is the same padded box, so the hover pill
 * and the focus ring both frame the words with room to spare and never touch
 * them. The ring sits 2px outside the box on the page colour.
 */
export const TOPBAR_ROW_ITEM =
  "relative inline-flex min-h-control items-center gap-1 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const TRIGGER = cn(
  TOPBAR_ROW_ITEM,
  "data-popup-open:text-foreground data-current:text-foreground",
);

/** Moves the hover pill under `target`, or hides it. */
function placePill(
  pill: HTMLElement | null,
  list: HTMLElement | null,
  target: HTMLElement | null,
) {
  if (!pill || !list) return;
  if (!target) {
    pill.removeAttribute("data-visible");
    return;
  }
  const from = list.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  // The first placement after hiding jumps without sliding in from the last spot.
  if (!pill.hasAttribute("data-visible")) pill.setAttribute("data-instant", "");
  else pill.removeAttribute("data-instant");
  pill.style.setProperty("--pill-x", `${box.left - from.left}px`);
  pill.style.setProperty("--pill-w", `${box.width}px`);
  pill.setAttribute("data-visible", "");
}

export function TopbarNav({
  entries,
  label = "Primary",
  className,
}: TopbarNavProps) {
  const [value, setValue] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const pillRef = React.useRef<HTMLSpanElement>(null);
  const rowItem = (event: React.SyntheticEvent) =>
    (event.target as HTMLElement).closest<HTMLElement>(
      "[data-slot=topbar-nav-trigger], [data-slot=topbar-nav-link] > a",
    );
  // With a panel open, the pill rests under its trigger; otherwise it leaves.
  const restPill = () =>
    placePill(
      pillRef.current,
      listRef.current,
      listRef.current?.querySelector<HTMLElement>(
        "[data-slot=topbar-nav-trigger][data-popup-open]",
      ) ?? null,
    );
  React.useEffect(restPill, [value]);
  return (
    <NavigationMenu.Root
      data-slot="topbar-nav"
      aria-label={label}
      value={value}
      onValueChange={(next) => setValue(typeof next === "string" ? next : null)}
      className={className}
    >
      {/* The pill is a sibling of the list, not inside it: a list holds only items. */}
      <div
        ref={listRef}
        className="relative isolate"
        onPointerOver={(event) => {
          const item = rowItem(event);
          if (item) placePill(pillRef.current, listRef.current, item);
        }}
        onPointerLeave={restPill}
      >
        <span
          ref={pillRef}
          aria-hidden
          data-slot="topbar-nav-pill"
          className="bg-foreground/6 pointer-events-none absolute inset-y-0 left-0 -z-10 w-(--pill-w) translate-x-(--pill-x) rounded-md opacity-0 data-visible:opacity-100 motion-safe:transition-[translate,width,opacity] motion-safe:duration-(--duration-medium) motion-safe:ease-move motion-safe:data-instant:transition-opacity"
        />
        <NavigationMenu.List className="flex items-center gap-1">
          {entries.map((entry) =>
            entry.kind === "link" ? (
              <NavigationMenu.Item
                key={entry.key}
                data-slot="topbar-nav-link"
                className="flex"
              >
                {entry.node}
              </NavigationMenu.Item>
            ) : (
              <NavigationMenu.Item key={entry.key} value={entry.key}>
                <NavigationMenu.Trigger
                  data-slot="topbar-nav-trigger"
                  data-current={entry.current ? "" : undefined}
                  className={TRIGGER}
                >
                  {entry.label}
                  <NavigationMenu.Icon className="motion-safe:transition-transform motion-safe:duration-(--duration-fast) data-popup-open:rotate-180">
                    <ChevronDownIcon aria-hidden className="size-4" />
                  </NavigationMenu.Icon>
                </NavigationMenu.Trigger>
                <NavigationMenu.Content
                  data-slot="topbar-nav-panel"
                  className={cn(
                    "p-2",
                    // Moving between groups, the old panel slides out the way the
                    // pointer went and the new one slides in after it.
                    "motion-safe:transition-[opacity,translate] motion-safe:duration-(--duration-medium) motion-safe:ease-enter",
                    "data-starting-style:opacity-0 data-ending-style:opacity-0",
                    "motion-safe:data-starting-style:data-[activation-direction=left]:-translate-x-1/4 motion-safe:data-starting-style:data-[activation-direction=right]:translate-x-1/4",
                    "motion-safe:data-ending-style:data-[activation-direction=left]:translate-x-1/4 motion-safe:data-ending-style:data-[activation-direction=right]:-translate-x-1/4",
                    entry.wide
                      ? "w-[min(36rem,calc(100vw-2rem))]"
                      : "w-[min(22rem,calc(100vw-2rem))]",
                  )}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a"))
                      setValue(null);
                  }}
                >
                  {entry.node}
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            ),
          )}
        </NavigationMenu.List>
      </div>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner
          sideOffset={12}
          align="start"
          collisionPadding={16}
          className="z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) motion-safe:transition-[top,left,right,bottom] motion-safe:duration-(--duration-base) motion-safe:ease-enter data-instant:transition-none"
        >
          <NavigationMenu.Popup
            data-slot="topbar-nav-popup"
            className={cn(
              "bg-popover text-popover-foreground border-border relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) overflow-hidden rounded-xl border shadow-lg",
              "motion-safe:transition-[opacity,scale,width,height] motion-safe:duration-(--duration-base) motion-safe:ease-enter",
              "data-starting-style:opacity-0 data-ending-style:opacity-0 motion-safe:data-starting-style:scale-95 motion-safe:data-ending-style:scale-95",
            )}
          >
            <NavigationMenu.Viewport className="relative h-full w-full overflow-hidden" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}
