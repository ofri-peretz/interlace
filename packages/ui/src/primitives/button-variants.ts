/**
 * @interlace/ui — buttonVariants
 *
 * The cva variant map that `button.tsx` imports — variant × size class strings
 * and nothing else. Pure CVA: no React, no client APIs, so a server component
 * can style a plain `<a>` with `buttonVariants({ variant, size })`.
 *
 * This is not a component. It exports a function and a type, renders nothing,
 * and has no props, no slots and no DOM — which is exactly why it is a
 * separate module from the `'use client'` Button that consumes it.
 *
 * ## Anatomy
 *
 *   buttonVariants({ variant, size })
 *     ├─ variant  default | destructive | outline | secondary | ghost | link
 *     └─ size     default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg
 *
 * Defaults are `variant: 'default'`, `size: 'default'`. `pagination.tsx` is
 * the in-repo example of styling an element rather than nesting a Button: its
 * `<a>` takes `buttonVariants({ variant, size })` directly. (It reaches the
 * function through `button.js`, which re-exports it — that path is
 * `'use client'`; import from this module to keep a server tree server-side.)
 *
 * ## Why half this file is comments
 *
 * Four of the six variants carry a long note recording a measured contrast
 * failure and the rule it produced: a variant that declares its own foreground
 * must paint an opaque surface in the same state, because a button is dropped
 * onto surfaces the design system does not control. `outline` inheriting the
 * page text into a `bg-primary` section measured 1.05:1; `link` with
 * `text-primary` on the same section measured 1.00:1. `composite-contrast-lock`
 * composites every variant over every brandable backdrop, so those notes are
 * checkable rather than folklore.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R8   | Enums, no booleans               | `variant` and `size` are closed string enums                |
 * | R19  | Tokens only                      | `bg-primary`, `bg-destructive`, `bg-accent`, `ring-ring/50` |
 * | R20  | AA contrast                      | every pair composited by `composite-contrast-lock`          |
 * | R25  | Server-safe                      | no React import, no hooks, no `'use client'`                |
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
        // No `dark:bg-destructive/60` here, unlike stock shadcn — see the
        // matching note in badge.tsx. Our dark destructive token is a light
        // red tuned for AAA on near-black; muting it to 60% drops the label
        // to 4.27:1, under AA. Caught by composite-contrast-lock.
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        // `text-foreground` is NOT redundant, and neither is the ABSENCE of
        // stock shadcn's `dark:bg-input/30` / `dark:hover:bg-input/50`. Both
        // halves of that come from the same shipped defect, found twice.
        //
        // First half: `outline` paints an opaque surface (`bg-background`)
        // but was the only such variant that did not also set a foreground,
        // so it INHERITED one. Dropped inside a section that flips the text
        // colour — `<CTASection tone="primary">` is `bg-primary
        // text-primary-foreground` — the button kept the page background and
        // took the section's white text: 1.05:1, invisible.
        //
        // Second half: declaring a foreground only means something if the
        // surface under it is actually opaque. `dark:bg-input/30` overrode
        // `bg-background` with a 30% tint, so in dark mode the same
        // `bg-primary` section bled through — `#6b635a` at 30% over `#fbb99a`
        // composites to `#d09f87`, and `text-foreground` `#f0ede9` lands on
        // that at 2.00:1. The hover state was worse-shaped and identical in
        // result (`dark:hover:bg-input/50` + `hover:text-accent-foreground`,
        // 2.00:1). Dropping both makes dark match what light already did:
        // no fill, the control identified by its border — `dark:border-input`
        // is 3.35:1 on the dark background, clearing SC 1.4.11.
        //
        // The rule, stated so it is checkable: a variant that declares its own
        // foreground must paint an opaque surface in the same state, because
        // a button is dropped onto surfaces the DS does not control. Locked by
        // composite-contrast-lock, which composites every variant over every
        // brandable backdrop rather than over the page background.
        outline:
          'border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        // No `dark:hover:bg-accent/50` here, for the reason spelled out on
        // `outline`: it declares `hover:text-accent-foreground`, so a 50% hover
        // surface let a `bg-primary` section through at 3.07:1. Opaque
        // `bg-accent` carries its own foreground at 10.46:1 in both schemes.
        // At rest `ghost` declares neither colour and inherits both, which is
        // the variant's whole point and is safe anywhere.
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        // Inherits its colour, and is underlined at rest rather than only on
        // hover. Stock shadcn is `text-primary … hover:underline`, which is
        // the same defect as the two above in its purest form: a declared
        // foreground over a surface the variant does not paint. `text-primary`
        // on a `<CTASection tone="primary">` is `#7d350c` on `#7d350c` —
        // 1.00:1, the button is literally the same colour as the section.
        //
        // A variant with no surface of its own cannot name a colour; the only
        // safe foreground is the inherited one, which is by construction the
        // pair its surface was measured with. That leaves the underline to
        // carry the affordance, so it has to be there at rest — which also
        // retires a colour-only link cue (WCAG 1.4.1) and matches how `Prose`
        // already renders links. `decoration-from-font` is Prose's too; hover
        // thickens the rule instead of shifting the hue, because any hue we
        // could shift to reintroduces the bug.
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
