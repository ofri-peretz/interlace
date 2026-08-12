/**
 * @interlace/ui — Section
 *
 * The page's rhythm unit, from LAYOUT_PHILOSOPHY.md §7-8: one band that owns
 * its vertical padding, its background tone, its transition dividers and the
 * `<Container>` that measures its children.
 *
 * A page is N of these, so the page file says what is IN each band and never
 * what the band looks like.
 *
 * ## The four axes
 *
 *   - `spacing`  → vertical padding, responsive at each step
 *                  (tight / comfortable / spacious / none; default comfortable)
 *   - `tone`     → background (default / muted / inset — `inset` also blurs)
 *   - `divider`  → border at the transition (none / top / bottom / both)
 *   - `container`→ which `<Container>` size wraps the children (default `content`)
 *
 * Every `spacing` step clears the philosophy's floors — `py-10` mobile,
 * `py-16` desktop — at the matching breakpoint; `none` is the deliberate
 * escape hatch for a band that abuts another.
 *
 * ## Anatomy
 *
 *   Section                          (section by default — data-spacing / -tone / -divider)
 *     └─ Container                   (always present, size from `container`)
 *          └─ children
 *
 * The wrapper element is chosen by `as` (`section | header | footer | aside |
 * div`), a plain string swap rather than Base UI's `render` prop. `children`
 * always go through a Container: there is no full-bleed escape except
 * `container="full"`.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `Omit<React.ComponentProps<'section'>, 'children'>`         |
 * | R6   | data-slot + data-* on root       | `data-slot="section"` + spacing / tone / divider            |
 * | R7   | cva + cn + ...rest               | `cn(sectionVariants({…}), className)` + `{...props}`        |
 * | R8   | Enums, no booleans               | four closed enums; no `isMuted`, no `hasDivider`            |
 * | R12  | Reuse over wrap                  | width and gutters come from `Container`, not from here      |
 * | R19  | Tokens only                      | `bg-card/30`, `bg-card/50`, `border-border`                 |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';
import { Container, type ContainerProps } from './container.js';

const sectionVariants = cva('relative', {
  variants: {
    spacing: {
      // LAYOUT_PHILOSOPHY §3/§5: mobile section vertical floor = `py-10`
      // (lg token); desktop section vertical floor = `py-16` (xl token).
      // Every spacing variant must clear those floors at the matching
      // breakpoint, or it ships a section that visually looks "padless".
      tight: 'py-12 md:py-16 lg:py-20',
      comfortable: 'py-16 md:py-20 lg:py-24',
      spacious: 'py-20 md:py-24 lg:py-32',
      none: '',
    },
    tone: {
      default: '',
      muted: 'bg-card/30',
      inset: 'bg-card/50 backdrop-blur-sm',
    },
    divider: {
      none: '',
      top: 'border-t border-border',
      bottom: 'border-b border-border',
      both: 'border-y border-border',
    },
  },
  defaultVariants: {
    spacing: 'comfortable',
    tone: 'default',
    divider: 'none',
  },
});

interface SectionProps
  extends Omit<React.ComponentProps<'section'>, 'children'>,
    VariantProps<typeof sectionVariants> {
  /** Container size that wraps the section's children. Defaults to `content`. */
  container?: ContainerProps['size'];
  /** Render as a different element (e.g. `header`, `footer`). Default `section`. */
  as?: 'section' | 'header' | 'footer' | 'aside' | 'div';
  children?: React.ReactNode;
}

function Section({
  className,
  spacing,
  tone,
  divider,
  container = 'content',
  as = 'section',
  children,
  ...props
}: SectionProps) {
  const Tag = as as React.ElementType;
  return (
    <Tag
      data-slot="section"
      data-spacing={spacing ?? undefined}
      data-tone={tone ?? undefined}
      data-divider={divider ?? undefined}
      className={cn(sectionVariants({ spacing, tone, divider }), className)}
      {...props}
    >
      <Container size={container}>{children}</Container>
    </Tag>
  );
}

export { Section, sectionVariants };
export type { SectionProps };
