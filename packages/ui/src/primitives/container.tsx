/**
 * @interlace/ui — Container
 *
 * The width contract from LAYOUT_PHILOSOPHY.md §2: four sizes only, each
 * mapped to one fixed max-width, plus the responsive horizontal padding scale
 * `px-4 sm:px-6 lg:px-8` (§5).
 *
 * It is what every page section is measured by — the ad-hoc widths that would
 * otherwise accumulate in app code are the thing it exists to retire.
 *
 * ## The four sizes
 *
 *   | size      | max-width | Use                                  |
 *   | --------- | --------- | ------------------------------------ |
 *   | `prose`   | 65ch      | Long-form text (rule docs, articles) |
 *   | `content` | 1024px    | Default for landing sections         |
 *   | `wide`    | 1280px    | Card-grid heavy sections             |
 *   | `full`    | none      | Full-bleed hero, decorative bands    |
 *
 * `full` also zeroes the padding at every breakpoint, so a full-bleed band is
 * genuinely edge-to-edge rather than a wide box with gutters.
 *
 * ## Anatomy
 *
 *   Container                        (div by default, or the `render` element)
 *     └─ children                    (data-size carries the chosen size)
 *
 * ## Two things worth knowing
 *
 *   - Named Tailwind widths are BROKEN in this codebase: `foundation.css`
 *     defines `--spacing-xs…2xl`, and Tailwind v4 resolves a named max-width
 *     against the spacing namespace first — so the one that should be 42rem
 *     renders 96 pixels instead. That is why the sizes here are literal
 *     values, and why `spacing-token-shadowing-lock` fails any source line
 *     that names one (including this comment, which is why it does not).
 *   - No `'use client'`, and that is the point rather than an oversight. A
 *     doc pass flagged it against `badge.tsx`, which calls the same
 *     `useRender` and does declare the directive — but `useRender` is
 *     server-safe: `@base-ui/react/use-render` ships no `'use client'` of its
 *     own, and `useRenderElement` guards its single hook behind
 *     `typeof document !== 'undefined'` ("skips the `useMergedRefs` call on
 *     the server"). DESIGN_PRINCIPLES #11 names the layout primitives as
 *     zero-hook and RSC-safe on purpose, the registry publishes this item with
 *     `client: false`, and `primitive-api-contract-lock` fails if the
 *     directive ever appears here. Same shape in `stack.tsx`.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'div'> & VariantProps<…>`             |
 * | R6   | data-slot + data-size on root    | `'data-slot': 'container'`, `'data-size': size`             |
 * | R7   | cva + cn + ...rest               | `cn(containerVariants({ size }), className)` + `...props`   |
 * | R8   | Enum for size                    | prose / content / wide / full                               |
 * | R10  | Composition seam                 | `render` — Base UI's `useRender`, not an `as` prop          |
 * | R18  | Tailwind only                    | widths are utilities; zero inline `style`                   |
 */

import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

const containerVariants = cva('mx-auto w-full px-4 sm:px-6 lg:px-8', {
  variants: {
    size: {
      prose: 'max-w-[65ch]',
      content: 'max-w-[1024px]',
      wide: 'max-w-[1280px]',
      full: 'max-w-none px-0 sm:px-0 lg:px-0',
    },
  },
  defaultVariants: {
    size: 'content',
  },
});

type ContainerProps = React.ComponentProps<'div'> &
  VariantProps<typeof containerVariants> & {
    render?: useRender.RenderProp;
  };

function Container({ className, size, render, ...props }: ContainerProps) {
  const element = useRender({
    render: render ?? <div />,
    props: {
      'data-slot': 'container',
      'data-size': size ?? undefined,
      className: cn(containerVariants({ size }), className),
      ...props,
    },
  });

  return element;
}

export { Container, containerVariants };
export type { ContainerProps };
