/**
 * ORPHANED COPY — hand-maintained here, and nothing syncs it.
 *
 * The old banner said "DO NOT EDIT — source: apps/interlace-docs-baseline/ in
 * the agents repo, run `npm run sync`". The generator is real and still runs,
 * but it does NOT write here: `agents/interlace/docs-baseline/
 * interlace.targets.json` lists four targets — `eslint/apps/docs`,
 * `serverless/apps/docs`, and the agents repo's own `apps/interlace-landing`
 * and `apps/blog`. This app is not among them. It was seeded from that
 * baseline once and has been on its own since (last touched 2026-05-29).
 *
 * So editing here is correct and durable — no sync will overwrite it — and
 * the "edit the source instead" instruction would have sent the fix to a repo
 * that never delivers it to this file.
 *
 * Two things follow. This file is also a SNAPSHOT of
 * `packages/ui/src/primitives/button-variants.ts` and has drifted from it;
 * diff before trusting it, since the contrast contract below is enforced
 * there by `composite-contrast-lock` and by nothing here. And the upstream
 * baseline still carries the defects fixed below, so its four real consumers
 * still have them.
 */
/**
 * Adapted from shadcn/ui: https://ui.shadcn.com/docs/components/button-variants
 * License: MIT — https://github.com/shadcn-ui/ui
 */
// Server-safe button variants. The full `<Button>` component lives in
// `./button.tsx` and is `'use client'` (Base UI useRender). Variants are a
// pure CVA function — no React, no client APIs — so they can be called
// from server components when composing className strings (e.g. on a
// `<Link className={buttonVariants(...)}>` in a server-rendered page).
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        // The three fixes below are ported from
        // `packages/ui/src/primitives/button-variants.ts`, where each carries
        // its full derivation and a lock. The rule they share: a variant either
        // declares an opaque surface AND the foreground on it, or declares
        // neither and inherits both. Declaring only a foreground — or painting
        // a translucent surface under one — measures the text against whatever
        // section it was dropped into.
        //
        // `text-foreground` added, `dark:bg-input/30` and
        // `dark:hover:bg-input/50` removed. This snapshot was two fixes behind:
        // it never got the original `text-foreground` (1.05:1 on a branded
        // section) nor the opacity fix (2.00:1 in dark).
        outline:
          'border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        // `dark:hover:bg-accent/50` removed — 3.07:1 on a branded surface.
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        // `text-primary` removed — it was 1.00:1 on `bg-primary`, the exact
        // colour of its own background. Inherits now, underlined at rest so
        // the affordance is not the hue.
        link: 'underline underline-offset-4 decoration-from-font hover:decoration-2',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export { buttonVariants };
export type { VariantProps };
