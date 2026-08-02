/**
 * @interlace/ui — ErrorTemplate
 *
 * Full-page error surface — 404 / 500 / 503 / generic. Centred column
 * with the status code + title + description + action buttons (back home,
 * contact support, retry).
 *
 * One template, four variants — pick via `variant`. Pass `actions` for
 * the CTA cluster.
 *
 * ## MIN_VIEWPORT — 320
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

type ErrorVariant = '404' | '500' | '503' | 'generic';

interface ErrorTemplateProps extends Omit<React.ComponentProps<'main'>, 'title'> {
  variant?: ErrorVariant;
  /** Override the default status code displayed. */
  statusCode?: React.ReactNode;
  /** Title. Defaults per `variant`. */
  title?: React.ReactNode;
  /** Description. Defaults per `variant`. */
  description?: React.ReactNode;
  /** Action button row (typically Back home + Contact). */
  actions?: React.ReactNode;
}

const DEFAULTS: Record<
  ErrorVariant,
  { code: string; title: string; description: string }
> = {
  '404': {
    code: '404',
    title: 'Page not found',
    description:
      "We couldn't find the page you were looking for. It may have moved, or never existed.",
  },
  '500': {
    code: '500',
    title: 'Something went wrong',
    description:
      'An unexpected error occurred on our end. Try again, and if it keeps happening, let us know.',
  },
  '503': {
    code: '503',
    title: 'We\'ll be right back',
    description:
      'The site is undergoing maintenance. Please check back in a few minutes.',
  },
  generic: {
    code: '!',
    title: 'Something went wrong',
    description: 'An unexpected error occurred.',
  },
};

function ErrorTemplate({
  variant = '404',
  statusCode,
  title,
  description,
  actions,
  className,
  ...props
}: ErrorTemplateProps) {
  const fallback = DEFAULTS[variant];
  return (
    <main
      data-slot="error-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-variant={variant}
      className={cn(
        'bg-background flex min-h-screen items-center justify-center py-xl',
        className,
      )}
      {...props}
    >
      <Container size="prose">
        <SectionBoundary name="error-body" skeletonVariant="card">
          <Stack gap="lg" align="center" className="text-center">
            <div
              aria-hidden
              className="text-primary font-body text-h1 font-bold tracking-display"
            >
              {statusCode ?? fallback.code}
            </div>
            <Typography variant="h2" as="h1" className="text-balance">
              {title ?? fallback.title}
            </Typography>
            <Typography
              variant="long"
              tone="muted"
              className="max-w-prose"
            >
              {description ?? fallback.description}
            </Typography>
            {actions ? (
              <div className="mt-md flex flex-col items-center gap-sm sm:flex-row">
                {actions}
              </div>
            ) : null}
          </Stack>
        </SectionBoundary>
      </Container>
    </main>
  );
}
ErrorTemplate.displayName = 'ErrorTemplate';

/**
 * Page-level loading state — the full-page silhouette of
 * `<ErrorTemplate>`, not a single rect. Rendered by the consumer while
 * the whole route's data is in flight (`loading.tsx` in Next.js), or as
 * a `<SectionBoundary skeleton={…}>` override.
 *
 * Shapes mirror the real layout so the swap is CLS-neutral (R23). One
 * `role="status"` region for the page; inner skeletons pass
 * `label={null}` so screen readers hear one announcement, not ten.
 */
function ErrorTemplateSkeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="error-template-skeleton"
      data-min-viewport={String(MIN_VIEWPORT)}
      role="status"
      aria-busy="true"
      aria-label="Loading…"
      className={cn(
        'bg-background flex min-h-screen items-center justify-center py-xl',
        className,
      )}
      {...props}
    >
      <Container size="prose">
        <Stack gap="lg" align="center">
          <Skeleton variant="page-header" label={null} />
          <Skeleton variant="button" label={null} />
        </Stack>
      </Container>
    </div>
  );
}
ErrorTemplateSkeleton.displayName = 'ErrorTemplateSkeleton';
ErrorTemplate.Skeleton = ErrorTemplateSkeleton;

export { ErrorTemplate };
export type { ErrorTemplateProps, ErrorVariant };
