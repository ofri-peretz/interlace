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
 *     ├─ div                         (data-slot="section-header-eyebrow"; a pill span inside when eyebrowStyle="pill")
 *     ├─ h1 | h2 | h3                (data-slot="section-header-title" — `text-section` or `text-display`)
 *     └─ p                           (data-slot="section-header-tagline" — muted, `max-w-prose`)
 *
 * ## Variants
 *
 * `align` — `center` (default, adds `[&_p]:mx-auto`) or `start`.
 * `size` — `default` sets the title at `text-section` (28 → 40px), `display`
 * at `text-display` (44 → 64px) for the one loudest line on a page. Both are
 * fluid tokens in `structure/type.css`, so the title glides with the viewport
 * instead of jumping at md and lg.
 * `spacing` — the bottom margin, a fraction of the section rhythm tokens:
 * `md` = 0.8 × `--spacing-section-tight` (38 → 64px), `lg` (default) =
 * 0.75 × `--spacing-section-comfortable` (48 → 72px). A brand that retunes
 * the rhythm retunes this gap with it.
 * `eyebrowStyle` — `plain` (default) sets the eyebrow as small primary text;
 * `pill` wraps it in an outlined, rounded chip.
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
 * | R8   | Enums, not booleans         | `align`, `spacing`, `size`, `eyebrowStyle`            |
 * | R10  | Composition seams           | `eyebrow` / `title` / `tagline` are `ReactNode`       |
 * | R18  | Tailwind only               | zero inline `style`                                   |
 * | R19  | Tokens only                 | `text-muted-foreground`; no palette escapes           |
 * | R25  | Server component            | no hooks → no `'use client'`                          |
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn.js";

/**
 * The eyebrow row's own alignment, keyed by the same `align` variant as the
 * root. It is a separate cva because the eyebrow is a flex row inside a
 * text-aligned block: `text-center` on the root does not reach a flex child's
 * main-axis placement, so the row needs `justify-*` stated for it.
 */
const sectionHeaderEyebrowVariants = cva(
  "text-caption text-primary font-semibold mb-4 flex items-center",
  {
    variants: {
      align: {
        center: "justify-center",
        start: "justify-start",
      },
    },
    defaultVariants: {
      align: "center",
    },
  },
);

/** The pill: a quiet outlined chip around the eyebrow, Untitled-style section label. */
const EYEBROW_PILL =
  "border-border bg-muted/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium";

const sectionHeaderVariants = cva("", {
  variants: {
    align: {
      center: "text-center [&_p]:mx-auto",
      start: "text-start",
    },
    spacing: {
      // Fractions of the section rhythm, so the gap under the header grows
      // with the band's own padding: 38 → 64px and 48 → 72px.
      md: "mb-[calc(var(--spacing-section-tight)*0.8)]",
      lg: "mb-[calc(var(--spacing-section-comfortable)*0.75)]",
    },
  },
  defaultVariants: {
    align: "center",
    spacing: "lg",
  },
});

const sectionHeaderTitleVariants = cva(
  "font-heading tracking-display font-bold text-balance",
  {
    variants: {
      size: {
        default: "text-section mb-4",
        display: "text-display mb-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const TAGLINE = {
  default: "text-base md:text-lg",
  display: "text-lg md:text-xl",
} as const;

interface SectionHeaderProps
  extends
    Omit<React.ComponentProps<"div">, "title">,
    VariantProps<typeof sectionHeaderVariants>,
    VariantProps<typeof sectionHeaderTitleVariants> {
  /** Small label above the title: a section number, a word, a chip. */
  eyebrow?: React.ReactNode;
  /** `plain` sets the eyebrow as small primary-coloured text; `pill` puts it in an outlined chip. @default 'plain' */
  eyebrowStyle?: "plain" | "pill";
  /** The heading. */
  title: React.ReactNode;
  /** Optional subhead paragraph. */
  tagline?: React.ReactNode;
  /** Heading level. Defaults to h2 (page-level h1 lives in the hero). */
  as?: "h1" | "h2" | "h3";
}

function SectionHeader({
  className,
  eyebrow,
  eyebrowStyle = "plain",
  title,
  tagline,
  align,
  spacing,
  size,
  as: Heading = "h2",
  ...props
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      data-align={align ?? undefined}
      data-size={size ?? undefined}
      className={cn(sectionHeaderVariants({ align, spacing }), className)}
      {...props}
    >
      {eyebrow ? (
        <div
          data-slot="section-header-eyebrow"
          className={sectionHeaderEyebrowVariants({ align })}
        >
          {eyebrowStyle === "pill" ? (
            <span className={EYEBROW_PILL}>{eyebrow}</span>
          ) : (
            eyebrow
          )}
        </div>
      ) : null}
      <Heading
        data-slot="section-header-title"
        className={sectionHeaderTitleVariants({ size })}
      >
        {title}
      </Heading>
      {tagline ? (
        <p
          data-slot="section-header-tagline"
          className={cn(
            "text-muted-foreground max-w-prose text-pretty",
            TAGLINE[size ?? "default"],
          )}
        >
          {tagline}
        </p>
      ) : null}
    </div>
  );
}

export {
  SectionHeader,
  sectionHeaderVariants,
  sectionHeaderEyebrowVariants,
  sectionHeaderTitleVariants,
};
export type { SectionHeaderProps };
