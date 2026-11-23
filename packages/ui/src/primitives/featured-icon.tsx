/**
 * @interlace/ui — FeaturedIcon
 *
 * An icon set in a tinted rounded square or circle, with a soft outer ring:
 * the mark at the head of a feature card, a step, or a section. It gives a
 * row of features one shared shape, so the icons read as a set rather than
 * as loose glyphs of different weights.
 *
 * ## Anatomy
 *
 *   FeaturedIcon                     (span — data-slot="featured-icon", data-size / -tone / -shape)
 *     └─ children                    (the icon; any svg inside is sized for you)
 *
 * ## Tones
 *
 * | `tone`      | Surface                          | Icon                    |
 * | ----------- | -------------------------------- | ----------------------- |
 * | `primary`   | 12% primary mixed into background | `text-primary`          |
 * | `highlight` | `bg-highlight`                   | `text-highlight-foreground` |
 * | `neutral`   | `bg-muted` with a border         | `text-foreground`       |
 * | `inverse`   | `bg-foreground`                  | `text-background`       |
 *
 * Every surface is opaque (the tint is a `color-mix` into `--background`, not
 * an alpha), so the icon keeps its contrast on whatever the card sits on. The
 * ring is the same mix at half the strength, drawn with `ring-*`, so it takes
 * no layout space and a grid of them stays aligned.
 *
 * ## Decorative by default
 *
 * The icon repeats what the heading beside it says, so the whole mark is
 * `aria-hidden`. Pass `label` when the icon stands alone and carries meaning:
 * it becomes `role="img"` with that name.
 *
 * ## MIN_VIEWPORT — 320
 *
 * A fixed square from 2rem to 3.5rem; it fits any column.
 *
 * | Rule | Concept                 | Where in this file                                     |
 * | ---- | ----------------------- | ------------------------------------------------------ |
 * | R4   | Extends native el       | `React.ComponentProps<'span'>`                         |
 * | R6   | data-slot + data-*      | `data-slot="featured-icon"` + size / tone / shape      |
 * | R7   | cva + cn + ...rest      | `cn(featuredIconVariants(…), className)` + `{...props}` |
 * | R8   | Enums, not booleans     | `size`, `tone`, `shape`                                |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const                   |
 * | R18  | Tailwind only           | zero inline `style`                                    |
 * | R19  | Tokens only             | `--primary`, `--highlight`, `--muted`, `--foreground`  |
 * | R25  | Server component        | no hooks, no `'use client'`                            |
 * | R26  | A11y                    | `aria-hidden` unless `label` makes it `role="img"`      |
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn.js";

export const MIN_VIEWPORT = 320 as const;

const featuredIconVariants = cva(
  "inline-flex shrink-0 items-center justify-center [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "size-8 ring-4 [&_svg]:size-4",
        md: "size-10 ring-[6px] [&_svg]:size-5",
        lg: "size-12 ring-8 [&_svg]:size-6",
        xl: "size-14 ring-[10px] [&_svg]:size-7",
      },
      tone: {
        primary:
          "text-primary bg-[color-mix(in_oklab,var(--primary)_12%,var(--background))] ring-[color-mix(in_oklab,var(--primary)_6%,var(--background))]",
        highlight:
          "bg-highlight text-highlight-foreground ring-[color-mix(in_oklab,var(--highlight)_25%,var(--background))]",
        neutral:
          "bg-muted text-foreground border-border ring-[color-mix(in_oklab,var(--muted)_60%,var(--background))] border",
        inverse:
          "bg-foreground text-background ring-[color-mix(in_oklab,var(--foreground)_10%,var(--background))]",
      },
      shape: {
        square: "rounded-lg",
        circle: "rounded-full",
      },
    },
    compoundVariants: [
      { shape: "square", size: "lg", className: "rounded-xl" },
      { shape: "square", size: "xl", className: "rounded-xl" },
    ],
    defaultVariants: {
      size: "md",
      tone: "primary",
      shape: "square",
    },
  },
);

type FeaturedIconProps = React.ComponentProps<"span"> &
  VariantProps<typeof featuredIconVariants> & {
    /** A name for an icon that stands alone and means something. Without it the icon is decorative. */
    label?: string;
  };

function FeaturedIcon({
  size,
  tone,
  shape,
  label,
  className,
  children,
  ...props
}: FeaturedIconProps) {
  return (
    <span
      data-slot="featured-icon"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-size={size ?? "md"}
      data-tone={tone ?? "primary"}
      data-shape={shape ?? "square"}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
      className={cn(featuredIconVariants({ size, tone, shape }), className)}
      {...props}
    >
      {children}
    </span>
  );
}

export { FeaturedIcon, featuredIconVariants };
export type { FeaturedIconProps };
