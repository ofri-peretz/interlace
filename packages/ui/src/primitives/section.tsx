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
 * ## The five axes
 *
 *   - `spacing`  → vertical padding, responsive at each step
 *                  (tight / comfortable / spacious / none; default comfortable)
 *   - `tone`     → background (default / muted / inset — `inset` also blurs —
 *                  / brand, the full-bleed brand band with its foreground)
 *   - `divider`  → border at the transition (none / top / bottom / both)
 *   - `overlap`  → ride up over the band above (none / sm / md / lg)
 *   - `container`→ which `<Container>` size wraps the children (default `content`)
 *
 * ## Overlap
 *
 * A card that straddles the edge of a brand band is two Sections: the band,
 * then a Section with `overlap`. The overlapping one drops its own top
 * padding, pulls up by the depth, and stacks above the band, so its first
 * child sits across the band's bottom padding. Keep the depth below that
 * padding (every `spacing` step but `none` clears `lg`), or the card covers
 * the band's last line.
 *
 * Every `spacing` step clears the philosophy's floors — `py-10` mobile,
 * `py-16` desktop — at the matching breakpoint; `none` is the deliberate
 * escape hatch for a band that abuts another.
 *
 * ## Anatomy
 *
 *   Section                          (section by default — data-spacing / -tone / -divider / -overlap)
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
 * | R8   | Enums, no booleans               | five closed enums; no `isMuted`, no `hasDivider`            |
 * | R12  | Reuse over wrap                  | width and gutters come from `Container`, not from here      |
 * | R19  | Tokens only                      | `bg-card/30`, `bg-card/50`, `bg-primary`, `border-border`   |
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
      brand: 'bg-primary text-primary-foreground',
    },
    divider: {
      none: '',
      top: 'border-t border-border',
      bottom: 'border-b border-border',
      both: 'border-y border-border',
    },
    // pt-0 at every step beats the matching `spacing` py-*, so the pull is
    // exactly the depth and not the depth minus this band's own padding.
    overlap: {
      none: '',
      sm: 'z-10 -mt-6 pt-0 md:pt-0 lg:pt-0',
      md: 'z-10 -mt-8 pt-0 md:-mt-10 md:pt-0 lg:pt-0',
      lg: 'z-10 -mt-12 pt-0 md:-mt-16 md:pt-0 lg:pt-0',
    },
  },
  defaultVariants: {
    spacing: 'comfortable',
    tone: 'default',
    divider: 'none',
    overlap: 'none',
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
  overlap,
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
      data-overlap={overlap ?? undefined}
      className={cn(sectionVariants({ spacing, tone, divider, overlap }), className)}
      {...props}
    >
      <Container size={container}>{children}</Container>
    </Tag>
  );
}

export { Section, sectionVariants };
export type { SectionProps };
