'use client';

import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';
import { Skeleton } from './skeleton.js';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        // No `dark:bg-destructive/60` here, unlike stock shadcn. That tint
        // assumes a saturated mid-red token it can safely mute; ours is a
        // light red (#fca5a5) chosen to clear AAA against near-black, so
        // knocking it to 60% pulls it TOWARD the page and drops the label
        // to 4.27:1 — under AA. Caught by composite-contrast-lock.
        destructive:
          'bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        // `bg-background` is NOT decoration — it is what makes `text-foreground`
        // mean anything. Transparent, this variant declared a foreground over
        // a surface it did not paint, so a badge in a `bg-primary` section
        // rendered `#0d0b09` on `#7d350c`: 2.23:1 light, 1.44:1 dark. Same
        // defect the button `outline` shipped, same fix, and the two `outline`s
        // now agree on what the word means: an opaque face plus its own text.
        outline:
          'border-border bg-background text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        // Declares neither colour at rest — inherits both, which is safe on
        // any surface — and its hover paints an opaque `bg-accent` with the
        // matching foreground. The correct shape, kept as the reference.
        ghost: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        // No `text-primary` — see the long note on `buttonVariants.link`.
        // Same 1.00:1-on-`bg-primary` defect, same fix: inherit the colour,
        // underline at rest so the affordance is not the hue.
        link: 'underline underline-offset-4 decoration-from-font [a&]:hover:decoration-2',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    render?: useRender.RenderProp;
    /**
     * When true, render a `<Skeleton variant="badge" />` in place of the
     * normal Badge surface. Shape-matched placeholder (h-5 w-16
     * rounded-full) so the row layout doesn't shift on data arrival.
     */
    loading?: boolean;
  };

function Badge({
  className,
  variant = 'default',
  render,
  loading,
  ...props
}: BadgeProps) {
  if (loading) {
    return (
      <Skeleton
        variant="badge"
        data-slot="badge"
        className={className}
      />
    );
  }

  const element = useRender({
    render: render ?? <span />,
    props: {
      'data-slot': 'badge',
      'data-variant': variant ?? undefined,
      className: cn(badgeVariants({ variant }), className),
      ...props,
    },
  });

  return element;
}

export { Badge, badgeVariants };
export type { BadgeProps };
