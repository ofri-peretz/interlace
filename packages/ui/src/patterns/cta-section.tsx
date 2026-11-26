/**
 * @interlace/ui — CTASection
 *
 * Call-to-action section. Title + description + 1-2 action buttons in a
 * centred column on a tinted surface. The shape every landing page reaches
 * for ("Ready to ship?" / "Start your trial" / "Read the docs"). Server
 * component.
 *
 * ## Variants
 *
 * | `variant` | Shape                                                      |
 * | --------- | ---------------------------------------------------------- |
 * | `band`    | Full-width tinted band (default)                           |
 * | `card`    | A contained rounded card inside the content width          |
 *
 * `align` places the copy at the `center` (default) or the `start` edge.
 * `background` is a decorative layer behind the copy (a GridField, a
 * gradient), clipped to the band or the card and hidden from assistive tech.
 * `children` render under the actions, so the CTA can hold a search box or a
 * sign-up form, not only buttons.
 *
 * ## Anatomy
 *
 *   <section data-slot="cta-section" data-variant data-tone data-align>
 *     <Container>
 *       <div data-slot="cta-section-surface">   (the card; for band it carries no surface)
 *         <div data-slot="cta-section-background" aria-hidden>{background}</div>
 *         <Stack>
 *           <Typography variant="h2">{title}</Typography>
 *           <Typography variant="long">{description}</Typography>
 *           <div>{actions}</div>
 *           {children}
 *         </Stack>
 *       </div>
 *     </Container>
 *   </section>
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>` + CTASection props        |
 * | R6   | data-slot on root                | `data-slot="cta-section"`                                   |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | Enums, not booleans              | `tone`, `variant`, `align`                                  |
 * | R10  | Composition seam (slots)         | `title` / `description` / `actions` / `background` / children |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `bg-primary-subtle` / `text-foreground` / spacing scale     |
 * | R20  | AA contrast                      | accent foreground on tinted surface                         |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y                             | `<section aria-labelledby>` the title when there is one     |
 */

import * as React from "react";

import { cn } from "../lib/cn.js";
import { Container } from "../primitives/container.js";
import { Skeleton } from "../primitives/skeleton.js";
import { Stack } from "../primitives/stack.js";
import { Typography } from "../primitives/typography.js";

export const MIN_VIEWPORT = 320 as const;

type CTATone = "subtle" | "primary" | "neutral";
type CTAVariant = "band" | "card";
type CTAAlign = "center" | "start";

interface CTASectionProps extends Omit<
  React.ComponentProps<"section">,
  "title"
> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Actions row — typically 1-2 Buttons. */
  actions?: React.ReactNode;
  /**
   * Surface tone. `subtle` (default) uses brand-tinted neutral;
   * `primary` is fully branded; `neutral` is plain card. Stick to one
   * `primary` CTA per page.
   */
  tone?: CTATone;
  /** `band` fills the width; `card` is a rounded card inside the content width. @default 'band' */
  variant?: CTAVariant;
  /** Where the copy sits. @default 'center' */
  align?: CTAAlign;
  /** A decorative layer behind the copy, clipped to the surface and hidden from assistive tech. */
  background?: React.ReactNode;
  /** Anything under the actions: a search box, a sign-up form. */
  children?: React.ReactNode;
  /** When true, render a skeleton card placeholder. */
  loading?: boolean;
}

const TONE_CLASSES: Record<CTATone, string> = {
  subtle: "bg-muted text-foreground",
  primary: "bg-primary text-primary-foreground",
  neutral: "bg-card text-card-foreground border-border",
};

function CTASection({
  title,
  description,
  actions,
  tone = "subtle",
  variant = "band",
  align = "center",
  background,
  children,
  loading,
  className,
  ...props
}: CTASectionProps) {
  // useId holds no state, so this stays a server component.
  const titleId = React.useId();
  if (loading) {
    return (
      <Skeleton
        variant="card"
        data-slot="cta-section"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn("h-40 w-full", className)}
      />
    );
  }
  const card = variant === "card";
  const center = align === "center";
  return (
    <section
      data-slot="cta-section"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-tone={tone}
      data-variant={variant}
      data-align={align}
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        "py-section-comfortable",
        // A band paints the whole width; a card leaves the page behind it.
        !card && [
          "relative isolate overflow-hidden",
          TONE_CLASSES[tone],
          tone === "neutral" && "border-y",
        ],
        className,
      )}
      {...props}
    >
      <Container size="content" className={cn(card && "relative")}>
        <div
          data-slot="cta-section-surface"
          className={cn(
            card && [
              "relative isolate overflow-hidden rounded-2xl px-6 py-12 xs:px-10 sm:px-16 sm:py-16",
              TONE_CLASSES[tone],
              tone === "neutral" && "border",
            ],
          )}
        >
          {background ? (
            <div
              data-slot="cta-section-background"
              aria-hidden
              className="pointer-events-none absolute inset-0 z-backdrop"
            >
              {background}
            </div>
          ) : null}
          <Stack
            gap="md"
            align={center ? "center" : "start"}
            className={center ? "text-center" : "text-start"}
          >
            {title ? (
              <Typography
                id={titleId}
                variant="h2"
                as="h2"
                className="text-section text-balance"
              >
                {title}
              </Typography>
            ) : null}
            {description ? (
              <Typography
                variant="long"
                tone={tone === "primary" ? "default" : "muted"}
                className={cn(
                  "max-w-prose text-pretty",
                  // On `primary` tone the background is the brand colour. Use
                  // the full primary-foreground (no opacity) so contrast clears
                  // AAA — `/90` would knock it to ~6:1, sub-AAA.
                  tone === "primary" && "text-primary-foreground",
                )}
              >
                {description}
              </Typography>
            ) : null}
            {actions ? (
              <div
                data-slot="cta-section-actions"
                className={cn(
                  "mt-6 flex flex-col gap-4 xs:flex-row",
                  center ? "items-center xs:justify-center" : "items-start",
                )}
              >
                {actions}
              </div>
            ) : null}
            {children ? (
              <div
                data-slot="cta-section-content"
                className={cn("mt-2 w-full max-w-112", center && "mx-auto")}
              >
                {children}
              </div>
            ) : null}
          </Stack>
        </div>
      </Container>
    </section>
  );
}
CTASection.displayName = "CTASection";

export { CTASection };
export type { CTASectionProps };
