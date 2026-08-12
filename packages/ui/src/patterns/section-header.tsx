/**
 * @interlace/ui — SectionHeader
 *
 * The "section intro" block — optional eyebrow, a heading, and a `max-w-prose`
 * tagline — with the bottom margin, the alignment and the type rhythm owned in
 * one place instead of being re-typed as `text-center mb-12` on every section.
 *
 * It is the LAYOUT_PHILOSOPHY §1 pattern lifted into a component.
 *
 * ## Anatomy
 *
 *   SectionHeader                    (div — data-slot="section-header", data-align)
 *     ├─ div                         (data-slot="section-header-eyebrow")
 *     ├─ h1 | h2 | h3                (title — `text-3xl md:text-4xl lg:text-5xl`)
 *     └─ p                           (tagline — `text-muted-foreground max-w-prose`)
 *
 * ## Variants
 *
 * `align` — `center` (default, adds `[&_p]:mx-auto`) or `start`.
 * `spacing` — the bottom margin: `md` = `mb-12`, `lg` (default) = `mb-16`.
 * `as` — the heading level, `h1` | `h2` | `h3`, defaulting to `h2` because the
 * page-level `h1` belongs to the hero. The visual size does not follow the
 * level; all three render at the same scale.
 *
 * ## `align` reaches the eyebrow too
 *
 * The eyebrow row is a flex container, and `text-center` / `text-left` on the
 * root does not place a flex child on its main axis — so the row carries its
 * own `justify-center` / `justify-start`, keyed off the same variant
 * (`sectionHeaderEyebrowVariants`). It used to be a hard-coded
 * `justify-center`, which left the eyebrow centred over a left-aligned
 * heading under `align="start"`.
 *
 * | Rule | Concept                     | Where in this file                                    |
 * | ---- | --------------------------- | ----------------------------------------------------- |
 * | R4   | Extends native el           | `Omit<React.ComponentProps<'div'>, 'title'>`          |
 * | R6   | data-slot on root           | `data-slot="section-header"` + `data-align`           |
 * | R7   | cva + cn + ...rest          | `cn(sectionHeaderVariants({align, spacing}), className)` |
 * | R8   | Enums, not booleans         | `align = center\|start`; `spacing = md\|lg`           |
 * | R10  | Composition seams           | `eyebrow` / `title` / `tagline` are `ReactNode`       |
 * | R18  | Tailwind only               | zero inline `style`                                   |
 * | R19  | Tokens only                 | `text-muted-foreground`; no palette escapes           |
 * | R25  | Server component            | no hooks → no `'use client'`                          |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

/**
 * The eyebrow row's own alignment, keyed by the same `align` variant as the
 * root. It is a separate cva because the eyebrow is a flex row inside a
 * text-aligned block: `text-center` on the root does not reach a flex child's
 * main-axis placement, so the row needs `justify-*` stated for it.
 */
const sectionHeaderEyebrowVariants = cva('mb-4 flex items-center', {
  variants: {
    align: {
      center: 'justify-center',
      start: 'justify-start',
    },
  },
  defaultVariants: {
    align: 'center',
  },
});

const sectionHeaderVariants = cva('', {
  variants: {
    align: {
      center: 'text-center [&_p]:mx-auto',
      start: 'text-left',
    },
    spacing: {
      md: 'mb-12',
      lg: 'mb-16',
    },
  },
  defaultVariants: {
    align: 'center',
    spacing: 'lg',
  },
});

interface SectionHeaderProps
  extends Omit<React.ComponentProps<'div'>, 'title'>,
    VariantProps<typeof sectionHeaderVariants> {
  /** Small label above the title (e.g. a section number, chip, or eyebrow tag). */
  eyebrow?: React.ReactNode;
  /** The h2 heading. */
  title: React.ReactNode;
  /** Optional subhead paragraph. */
  tagline?: React.ReactNode;
  /** Heading level. Defaults to h2 (page-level h1 lives in the hero). */
  as?: 'h1' | 'h2' | 'h3';
}

function SectionHeader({
  className,
  eyebrow,
  title,
  tagline,
  align,
  spacing,
  as: Heading = 'h2',
  ...props
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      data-align={align ?? undefined}
      className={cn(sectionHeaderVariants({ align, spacing }), className)}
      {...props}
    >
      {eyebrow ? (
        <div
          data-slot="section-header-eyebrow"
          className={sectionHeaderEyebrowVariants({ align })}
        >
          {eyebrow}
        </div>
      ) : null}
      <Heading className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
        {title}
      </Heading>
      {tagline ? (
        <p className="text-muted-foreground max-w-prose text-base md:text-lg">
          {tagline}
        </p>
      ) : null}
    </div>
  );
}

export { SectionHeader, sectionHeaderVariants, sectionHeaderEyebrowVariants };
export type { SectionHeaderProps };
