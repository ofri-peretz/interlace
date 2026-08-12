/**
 * @interlace/ui — Stack + Cluster
 *
 * Flex layout whose gap comes from the DS six-step spacing scale, not from a
 * number at the call site (LAYOUT_PHILOSOPHY.md §3). `Stack` stacks children
 * vertically; `Cluster` is the horizontal, wrapping form for chip, tag and
 * button rows.
 *
 * `gap`, `align` and `justify` are closed enums — there is no arbitrary-value
 * escape hatch short of `className`.
 *
 * ## Anatomy
 *
 *   Stack                            (div by default, or the `render` element)
 *     └─ children                    (data-direction / -gap / -align / -justify)
 *
 *   Cluster                          (a Stack with direction=horizontal — data-slot="cluster")
 *
 * `Cluster` is `Stack` with `direction="horizontal"` and different defaults
 * (`gap="sm"`, `align="center"`); it overrides `data-slot` to `cluster` by
 * spreading after Stack's own attribute, so the two are distinguishable in the
 * DOM and in tests.
 *
 * ## Two things worth knowing
 *
 *   - `direction="horizontal"` is `flex-row flex-wrap`. There is no non-wrap
 *     horizontal stack; a row that must not wrap needs its own `flex-nowrap`.
 *   - No `'use client'`, and that is the point rather than an oversight. A
 *     doc pass flagged it against `badge.tsx`, which calls the same
 *     `useRender` and does declare the directive — but `useRender` is
 *     server-safe: `@base-ui/react/use-render` ships no `'use client'` of its
 *     own, and `useRenderElement` guards its single hook behind
 *     `typeof document !== 'undefined'` ("skips the `useMergedRefs` call on
 *     the server"). DESIGN_PRINCIPLES #11 names the layout primitives as
 *     zero-hook and RSC-safe on purpose, the registry publishes this item with
 *     `client: false`, and `primitive-api-contract-lock` fails if the
 *     directive ever appears here. Same shape in `container.tsx`.
 *
 * ## The gap scale
 *
 * Gap maps to the foundation `--spacing-*` tokens (DS-owned, not Tailwind's
 * default scale — R19), shared with `<Grid>` so the two stay rhythm-consistent:
 *
 *   | token  | px  | class      | use                          |
 *   | ------ | --- | ---------- | ---------------------------- |
 *   | `xs`   |  8  | `gap-xs`   | Inline chips                 |
 *   | `sm`   | 16  | `gap-sm`   | Cards, mobile padding        |
 *   | `md`   | 24  | `gap-md`   | Card-grid gaps, header→grid  |
 *   | `lg`   | 40  | `gap-lg`   | Mobile section gaps          |
 *   | `xl`   | 64  | `gap-xl`   | Desktop section gaps         |
 *   | `2xl`  | 96  | `gap-2xl`  | Hero / CTA breathing room    |
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'div'> & VariantProps<…>`             |
 * | R6   | data-slot + data-* on root       | stack / cluster, plus direction / gap / align / justify      |
 * | R7   | cva + cn + ...rest               | `cn(stackVariants({…}), className)` + `...props`            |
 * | R8   | Enums, no booleans               | gap / align / justify / direction are closed enums          |
 * | R10  | Composition seam                 | `render` — Base UI's `useRender`, not an `as` prop          |
 * | R18  | Tailwind only                    | gap is a utility, never an inline `style`                   |
 * | R19  | Tokens only                      | `gap-xs…gap-2xl` resolve to the DS `--spacing-*` tokens     |
 */

import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

const stackVariants = cva('flex', {
  variants: {
    direction: {
      vertical: 'flex-col',
      horizontal: 'flex-row flex-wrap',
    },
    gap: {
      xs: 'gap-xs',
      sm: 'gap-sm',
      md: 'gap-md',
      lg: 'gap-lg',
      xl: 'gap-xl',
      '2xl': 'gap-2xl',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
    },
  },
  defaultVariants: {
    direction: 'vertical',
    gap: 'md',
  },
});

type StackProps = React.ComponentProps<'div'> &
  Omit<VariantProps<typeof stackVariants>, 'direction'> & {
    direction?: 'vertical' | 'horizontal';
    render?: useRender.RenderProp;
  };

function Stack({
  className,
  direction = 'vertical',
  gap,
  align,
  justify,
  render,
  ...props
}: StackProps) {
  const element = useRender({
    render: render ?? <div />,
    props: {
      'data-slot': 'stack',
      'data-direction': direction,
      'data-gap': gap ?? undefined,
      'data-align': align ?? undefined,
      'data-justify': justify ?? undefined,
      className: cn(
        stackVariants({ direction, gap, align, justify }),
        className,
      ),
      ...props,
    },
  });

  return element;
}

/**
 * `<Cluster>` — horizontal Stack with wrap. Sugar for tag rows, chip rows,
 * button rows. Use Stack with `direction="horizontal"` if you need more
 * control.
 */
function Cluster({
  className,
  gap = 'sm',
  align = 'center',
  ...props
}: Omit<StackProps, 'direction'>) {
  return (
    <Stack
      direction="horizontal"
      gap={gap}
      align={align}
      className={className}
      data-slot="cluster"
      {...props}
    />
  );
}

export { Stack, Cluster, stackVariants };
export type { StackProps };
