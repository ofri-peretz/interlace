/**
 * @interlace/ui — Badge
 *
 * A small pill for a status, a count, a label or a tag. Renders a `<span>` by
 * default, or whatever Base UI's `render` prop is given, so the same badge can
 * be an anchor without losing its shape.
 *
 * Six variants, and every one that names a text colour also paints an opaque
 * surface under it — see the rule below.
 *
 * ## Anatomy
 *
 *   Badge                            (span by default, or the `render` element)
 *     └─ children                    (text and/or an svg, sized to size-3 here)
 *
 * ## The variant rule this file exists to hold
 *
 * A badge is dropped onto surfaces the design system does not control. So a
 * variant that declares a foreground must paint an opaque background in the
 * same state, and a variant with no surface of its own (`ghost`, `link`) must
 * inherit its colour rather than name one. The per-variant comments below
 * record the measured failures that produced that rule — `link` with
 * `text-primary` measured 1.00:1 inside a `bg-primary` section — and
 * `composite-contrast-lock` is what keeps it true.
 *
 * ## `loading` and the hook order
 *
 * Until 2026-08-11 `useRender` sat AFTER the `loading` early return, so the
 * hook was behind a conditional. Toggling `loading` on a mounted Badge did not
 * actually throw — Base UI's `useRenderElement` occupies one hook slot on every
 * path — but the ordering was invalid regardless of whether this version of
 * that dependency happened to tolerate it. `useRender` is now unconditional and
 * its result discarded on a loading render.
 *
 * ## Why there is no `'use client'` here
 *
 * There used to be one, and the R25 row below used to read "Required —
 * `useRender` is a hook". That reasoning was wrong: `useRender` is a hook, but
 * a hook is only a client boundary if it needs client state, and this one does
 * not. `@base-ui/react/use-render` ships no `'use client'` of its own, and
 * `useRenderElement` guards its single hook (`useMergedRefs`) behind
 * `typeof document !== 'undefined'` — on the server it takes the no-hook path
 * and just builds an element. Which is exactly why `Stack`, `Container`,
 * `Box` and `Typography` call the same thing with no directive
 * (DESIGN_PRINCIPLES §11: layout primitives are zero-hook and RSC-safe).
 *
 * Measured, not reasoned. A server component in a Next 16 App Router tree
 * rendering `<Badge>`, `<Badge render={<a/>}>` and `<Badge loading />` was
 * statically prerendered by `next build`, exit 0, all three appearing as
 * `data-slot="badge"` in the emitted HTML. With the directive, the same page's
 * flight payload carried `I[…,"Badge"]` — a client module reference plus two
 * route chunks — and no badge markup was server-rendered at all. The harness
 * was proved able to fail first: the same page with a real `React.useState`
 * in a server component died with `useState is not a function`.
 *
 * `Skeleton` (the `loading` branch) is likewise not a client component, but
 * that was never the deciding factor — a server component may render a client
 * one, so a client Skeleton would not have forced a boundary here either.
 *
 * The consequence, and the reason this matters more for Badge than for most:
 * Badge is one of the most-rendered primitives in the catalogue, so every
 * server tree containing one was paying a boundary plus badge + cva + clsx +
 * tailwind-merge + Skeleton to render a `<span>`. `use-client-scan.test.ts`
 * pins this file to the server side so the directive cannot come back
 * unnoticed.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'span'>`                              |
 * | R6   | data-slot + data-variant on root | `'data-slot': 'badge'`, `'data-variant': variant`           |
 * | R7   | cva + cn + ...rest               | `cn(badgeVariants({ variant }), className)` + `...props`    |
 * | R8   | Enum for variant                 | default / secondary / destructive / outline / ghost / link  |
 * | R10  | Composition seam                 | `render` — Base UI's `useRender`, not an `as` prop          |
 * | R19  | Tokens only                      | `bg-primary`, `bg-secondary`, `bg-destructive`, `bg-accent` |
 * | R20  | AA contrast                      | every variant composited by `composite-contrast-lock`       |
 * | R25  | Client component                 | Not required — server component, see the note above         |
 */

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
  // `useRender` runs BEFORE the `loading` branch, not after it — a hook may not
  // sit behind a conditional return.
  //
  // Measured, because the honest version of this comment matters: with the old
  // ordering, mounting loading and then toggling to loaded does NOT throw on
  // React 19 + Base UI 1.4. `useRenderElement`'s only hook is `useMergedRefs`,
  // which is written to occupy one slot on every path. So this was a latent
  // violation, not an observable crash — and the fix is worth making anyway,
  // because "it happens not to throw with this version of that dependency" is
  // not a property this file controls. The cost is one element built and
  // discarded on a loading render.
  const element = useRender({
    render: render ?? <span />,
    props: {
      'data-slot': 'badge',
      'data-variant': variant ?? undefined,
      className: cn(badgeVariants({ variant }), className),
      ...props,
    },
  });

  if (loading) {
    return (
      <Skeleton
        variant="badge"
        data-slot="badge"
        className={className}
      />
    );
  }

  return element;
}

export { Badge, badgeVariants };
export type { BadgeProps };
