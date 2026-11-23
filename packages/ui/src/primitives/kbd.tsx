/**
 * @interlace/ui — Kbd + KbdGroup
 *
 * A key the reader presses: `⌘`, `Esc`, `Ctrl` `K`. The shadcn core `kbd`
 * item, drawn in Interlace tokens. `KbdGroup` sets a chord (`⌘ + K`) or a
 * sequence (`G` then `I`) as one inline run, so the gap between keys is
 * owned by the container, not by a margin on each key.
 *
 * Server component — native `<kbd>`, nothing to hydrate.
 *
 * ## Anatomy
 *
 *   KbdGroup                         (kbd — data-min-viewport=320)
 *     ├─ Kbd                         (kbd — data-min-viewport=320)
 *     └─ Kbd
 *
 * A group is itself a `<kbd>`: HTML nests `<kbd>` inside `<kbd>` to mean
 * "this input is made of these keys", which is exactly a chord.
 *
 * ## MIN_VIEWPORT — 320
 *
 * A key is a few characters wide and never wraps (`whitespace-nowrap`), so
 * it holds at the narrowest viewport.
 *
 * | Rule | Concept                 | Where in this file                                |
 * | ---- | ----------------------- | ------------------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'kbd'> & VariantProps`      |
 * | R6   | data-slot per part      | `kbd` / `kbd-group`                               |
 * | R7   | cva + cn + ...rest      | `cn(kbdVariants({ size }), className)`            |
 * | R8   | Enums, not booleans     | `size` = sm | md                                  |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const              |
 * | R19  | Tokens only             | bg-muted, text-foreground, border-border          |
 * | R25  | Server component        | no hooks → no `'use client'`                      |
 * | R26  | A11y from native el     | `<kbd>` is read as its text; a symbol key should  |
 * |      |                         | carry `aria-label` (e.g. `⌘` → "Command")         |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

/** Minimum viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

const kbdVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-1 whitespace-nowrap select-none',
    // text-foreground, not muted-foreground: a key is read at text-xs, and
    // muted-on-muted would miss the AAA bar the storybook gate holds.
    // border-b-2 is the key's depth, so it reads as a key, not a tag.
    'rounded-sm border border-b-2 border-border bg-muted font-sans font-medium text-foreground',
    // An icon inside a key follows the key's size.
    "[&_svg:not([class*='size-'])]:size-3",
  ),
  {
    variants: {
      size: {
        sm: 'h-5 min-w-5 px-1 text-xs',
        md: 'h-6 min-w-6 px-1.5 text-sm',
      },
    },
    defaultVariants: { size: 'sm' },
  },
);

type KbdProps = React.ComponentProps<'kbd'> & VariantProps<typeof kbdVariants>;

function Kbd({ className, size, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(kbdVariants({ size }), className)}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd-group"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('inline-flex items-center gap-1 font-sans', className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup, kbdVariants };
export type { KbdProps };
