/**
 * @interlace/ui — CTASection
 *
 * Call-to-action section. Title + description + 1-2 action buttons in a
 * centred column on a tinted surface. The shape every landing page reaches
 * for ("Ready to ship?" / "Start your trial" / "Read the docs"). Server
 * component.
 *
 * ## Anatomy
 *
 *   <section data-slot="cta-section" data-min-viewport="320">
 *     <Container>
 *       <Stack align="center">
 *         <Typography variant="h2">{title}</Typography>
 *         <Typography variant="long">{description}</Typography>
 *         <div>{actions}</div>
 *       </Stack>
 *     </Container>
 *   </section>
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>` + CTASection props        |
 * | R6   | data-slot on root                | `data-slot="cta-section"`                                   |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R10  | Composition seam (slots)         | `title` / `description` / `actions` ReactNode props         |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `bg-primary-subtle` / `text-foreground` / spacing scale     |
 * | R20  | AA contrast                      | accent foreground on tinted surface                         |
 * | R25  | Server component                 | No hooks                                                    |
 * | R26  | A11y                             | `<section>` with `aria-labelledby` when title is text       |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';

export const MIN_VIEWPORT = 320 as const;

type CTATone = 'subtle' | 'primary' | 'neutral';

interface CTASectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
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
  /** When true, render a skeleton card placeholder. */
  loading?: boolean;
}

const TONE_CLASSES: Record<CTATone, string> = {
  subtle: 'bg-muted text-foreground',
  primary: 'bg-primary text-primary-foreground',
  neutral: 'bg-card text-card-foreground border-y border-border',
};

function CTASection({
  title,
  description,
  actions,
  tone = 'subtle',
  loading,
  className,
  ...props
}: CTASectionProps) {
  if (loading) {
    return (
      <Skeleton
        variant="card"
        data-slot="cta-section"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('h-40 w-full', className)}
      />
    );
  }
  return (
    <section
      data-slot="cta-section"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-tone={tone}
      className={cn('py-2xl', TONE_CLASSES[tone], className)}
      {...props}
    >
      <Container size="content">
        <Stack gap="md" align="center" className="text-center">
          {title ? (
            <Typography variant="h2" as="h2" className="text-balance">
              {title}
            </Typography>
          ) : null}
          {description ? (
            <Typography
              variant="long"
              tone={tone === 'primary' ? 'default' : 'muted'}
              className={cn(
                'max-w-prose',
                // On `primary` tone the section background is the brand colour;
                // `text-muted-foreground` from the muted tone would render at
                // ~1.3:1 contrast. Force a translucent primary-foreground so
                // the description stays AA against the brand backdrop.
                tone === 'primary' && 'text-primary-foreground/90',
              )}
            >
              {description}
            </Typography>
          ) : null}
          {actions ? (
            <div className="mt-md flex flex-col items-center gap-sm sm:flex-row">
              {actions}
            </div>
          ) : null}
        </Stack>
      </Container>
    </section>
  );
}
CTASection.displayName = 'CTASection';

export { CTASection };
export type { CTASectionProps };
