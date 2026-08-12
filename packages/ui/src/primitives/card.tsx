/**
 * @interlace/ui — Card
 *
 * A bordered, rounded content surface with header / title / description /
 * action / content / footer parts. The surface, radius and border come from
 * `Box`; the card owns only its column layout, its padding and its shadow.
 *
 * A `loading` card renders the shape-matched `Skeleton variant="card"`
 * instead, so a card grid does not shift when the data lands.
 *
 * ## Anatomy
 *
 *   Card                             (Box — surface=card, radius=lg, border, flex-col gap-6 py-6)
 *     ├─ CardHeader                  (grid — @container/card-header, px-6)
 *     │    ├─ CardTitle
 *     │    ├─ CardDescription
 *     │    └─ CardAction             (col 2, spans both header rows)
 *     ├─ CardContent                 (px-6)
 *     └─ CardFooter                  (flex, px-6)
 *
 * The header is a one-column grid until a `CardAction` is present:
 * `has-data-[slot=card-action]` switches it to `[1fr_auto]`, so the action
 * column is created by the child that needs it rather than by a prop.
 *
 * ## What the card does not give you
 *
 * `CardTitle` is a `<div>`, not a heading. It carries the type treatment and
 * nothing else, so a card that participates in the document outline needs the
 * caller to put a real `<h2>`/`<h3>` inside it. Only `Card` takes `loading` —
 * the parts have no state contract of their own.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'div'>` on every part                 |
 * | R6   | data-slot per part               | card / -header / -title / -description / -action / -content / -footer |
 * | R7   | cn + ...rest                     | `cn('px-6', className)` + `{...props}` on each part         |
 * | R10  | Composition seam                 | header layout keys off the `card-action` slot, not a prop   |
 * | R12  | Reuse over wrap                  | `Box` owns surface + radius + border; `Skeleton` owns loading |
 * | R19  | Tokens only                      | `surface="card"`, `text-muted-foreground`                   |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 */

import * as React from 'react';

import { Box } from './box.js';
import { Skeleton } from './skeleton.js';
import { cn } from '../lib/cn.js';

type CardProps = React.ComponentProps<'div'> & {
  /**
   * When true, render a `<Skeleton variant="card" />` composite (title +
   * body lines silhouette) instead of the normal Card surface. The
   * skeleton shape-matches the card footprint so a card grid doesn't
   * shift when real data arrives.
   */
  loading?: boolean;
};

/** Card composes Box for the surface/border/radius floor; layout utilities (flex, gap, py, shadow) stay local because they're card-specific, not surface-level. */
function Card({ className, loading, ...props }: CardProps) {
  if (loading) {
    return (
      <Skeleton
        variant="card"
        data-slot="card"
        className={className}
      />
    );
  }
  return (
    <Box
      data-slot="card"
      surface="card"
      radius="lg"
      border
      className={cn('flex flex-col gap-6 py-6 shadow-sm', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-6', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
