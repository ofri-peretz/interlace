'use client';

/**
 * @interlace/ui — Tabs
 *
 * A tab bar and its panels. Wraps @base-ui/react/tabs: Base UI owns which tab
 * is selected, arrow-key roving focus and the tablist/tab/tabpanel ARIA; we
 * own the muted pill list and the raised face of the selected tab.
 *
 * ## Anatomy
 *
 *   Tabs                             (Tabs.Root — flex-col gap-2, data-min-viewport=320)
 *     ├─ TabsList                    (Tabs.List — bg-muted pill, h-9, w-fit)
 *     │    └─ TabsTrigger            (Tabs.Tab — flex-1, raised on data-[selected])
 *     └─ TabsContent                 (Tabs.Panel)
 *
 * The selected tab is drawn by `data-[selected]` state attributes rather than
 * by a prop, so selection stays entirely upstream's — nothing in this file
 * reads or stores it.
 *
 * ## No overflow strategy
 *
 * `TabsList` is `w-fit` and every trigger is `flex-1 whitespace-nowrap`. A bar
 * with many tabs or long labels does not scroll, wrap or truncate — it grows.
 * Wrap the list in a horizontally scrollable container at the call site.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Two or three short tabs fit 320px. The floor assumes that shape; long
 * labels are the caller's problem per the note above, not a reason to raise it.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseTabs.Root/List/Tab/Panel>` |
 * | R6   | data-slot per part               | tabs / tabs-list / tabs-trigger / tabs-content              |
 * | R7   | cn + ...rest                     | `cn('…', className)` + `{...props}` on every part           |
 * | R12  | Reuse over wrap                  | Base UI owns selection, roving focus and ARIA               |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R19  | Tokens only                      | `bg-muted`, `text-muted-foreground`, `ring-ring/50`         |
 * | R25  | Client component                 | Required — Base UI Tabs ships client hooks                  |
 * | R26  | Keyboard contract                | arrow-key flow asserted by `Tabs.stories.tsx`, locked by `overlay-nav-keyboard-lock` |
 */

import * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. The list is
 * `w-fit` with `flex-1` triggers, so a two- or three-tab bar fits 320px.
 * Consumers with long labels should wrap the list in a horizontally
 * scrollable container rather than raise this floor.
 */
export const MIN_VIEWPORT = 320 as const;

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof BaseTabs.Root>) {
  return (
    <BaseTabs.Root
      data-slot="tabs"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      data-slot="tabs-list"
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      data-slot="tabs-trigger"
      className={cn(
        "data-[selected]:bg-background dark:data-[selected]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[selected]:border-input dark:data-[selected]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[selected]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof BaseTabs.Panel>) {
  return (
    <BaseTabs.Panel
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
