/**
 * @interlace/ui — Figure + FigureCaption
 *
 * Semantic media block. `<figure>` is the right element for *self-contained*
 * media (image, diagram, code screenshot, chart) with an optional caption
 * that scrolls with it. Composes `AspectRatio` so the layout reserves space
 * before the asset loads — preventing the cumulative-layout-shift class of
 * bugs that the LOADING_PHILOSOPHY explicitly forbids.
 *
 * `alt` is **required** at the type level. There is no opt-out: a media block
 * without alt text is an a11y bug per WCAG 1.1.1, and the type system makes
 * it a compile error instead of a lint warning.
 *
 * ## Anatomy
 *
 *   Figure                              (figure — data-min-viewport=320)
 *     ├─ AspectRatio ratio=16/9         (frame, prevents CLS)
 *     │   └─ {children ?? <img src alt>}
 *     └─ FigureCaption                  (figcaption — auto when `caption` set)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Inline media must remain legible on the smallest supported viewport;
 * AspectRatio scales to whatever width the parent offers, and the caption
 * is a plain text node that flows naturally.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'figure'>` / `'figcaption'`           |
 * | R6   | data-slot on root                | `data-slot="figure"` / `data-slot="figure-caption"`         |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | No isXxx; enums only             | n/a — no boolean variants                                   |
 * | R10  | Composition seam                 | `children` overrides default `<img>` for diagrams / embeds  |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline style                                           |
 * | R19  | Tokens only                      | `my-lg` / `space-y-sm` / `text-muted-foreground`            |
 * | R20  | AA contrast                      | Caption uses `--muted-foreground` (clears AA on background) |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<figure>` + `<figcaption>` + required `alt`                |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { AspectRatio } from '../primitives/aspect-ratio.js';

export const MIN_VIEWPORT = 320 as const;

type FigureProps = Omit<React.ComponentProps<'figure'>, 'children'> & {
  /** Image source URL. Ignored when `children` is provided. */
  src?: string;
  /**
   * Alt text — **required**. WCAG 1.1.1 Non-text Content. For purely
   * decorative figures pass an empty string explicitly; the type system
   * makes the choice explicit at the call site.
   */
  alt: string;
  /** Width / height ratio passed to AspectRatio. @default 16 / 9 */
  ratio?: number;
  /** Caption text — rendered inside a `<figcaption>` after the media. */
  caption?: React.ReactNode;
  /**
   * Override the default `<img>` with a custom node (next/image, video,
   * SVG diagram, embed). When set, `src` is ignored.
   */
  children?: React.ReactNode;
};

const Figure = React.forwardRef<HTMLElement, FigureProps>(function Figure(
  { className, src, alt, ratio = 16 / 9, caption, children, ...props },
  ref,
) {
  return (
    <figure
      ref={ref}
      data-slot="figure"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('my-lg space-y-sm', className)}
      {...props}
    >
      <AspectRatio ratio={ratio}>
        {children ?? (
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 size-full rounded-md object-cover"
          />
        )}
      </AspectRatio>
      {caption ? <FigureCaption>{caption}</FigureCaption> : null}
    </figure>
  );
});
Figure.displayName = 'Figure';

type FigureCaptionProps = React.ComponentProps<'figcaption'>;

const FigureCaption = React.forwardRef<HTMLElement, FigureCaptionProps>(
  function FigureCaption({ className, ...props }, ref) {
    return (
      <figcaption
        ref={ref}
        data-slot="figure-caption"
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    );
  },
);
FigureCaption.displayName = 'FigureCaption';

export { Figure, FigureCaption };
export type { FigureProps, FigureCaptionProps };
