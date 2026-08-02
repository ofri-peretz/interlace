/**
 * @interlace/ui — AuthTemplate
 *
 * Full-page surface for sign-in / sign-up / password-reset / verify-email
 * flows. Centred narrow column with brand mark at top, form in the middle,
 * helper link at the bottom ("Already have an account?" / "Forgot password?").
 *
 * One template, four variants — pick via the `variant` prop. The form
 * itself is consumer-supplied (most apps want a custom action / OAuth
 * row); the template wraps it in the canonical layout.
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Anatomy
 *
 *   <main data-slot="auth-template" data-min-viewport="320">
 *     <Container size="prose">
 *       <SectionBoundary name="auth-header">{logo} {title} {description}</SectionBoundary>
 *       <SectionBoundary name="auth-form">{form}</SectionBoundary>
 *       <SectionBoundary name="auth-footer">{footer}</SectionBoundary>
 *     </Container>
 *   </main>
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';
import { Skeleton } from '../primitives/skeleton.js';

export const MIN_VIEWPORT = 320 as const;

type AuthVariant = 'signin' | 'signup' | 'reset' | 'verify';

interface AuthTemplateProps extends Omit<React.ComponentProps<'main'>, 'title'> {
  /** Which auth flow this surface represents. Drives default copy. */
  variant?: AuthVariant;
  /** Brand mark / logo at the top of the page. */
  logo?: React.ReactNode;
  /**
   * Page title. Default per `variant` (e.g. "Sign in to your account").
   * Pass to override.
   */
  title?: React.ReactNode;
  /** One-line description under the title. */
  description?: React.ReactNode;
  /** The auth form. Consumer-supplied. */
  form: React.ReactNode;
  /** Optional footer (e.g. "Already have an account? Sign in"). */
  footer?: React.ReactNode;
}

const DEFAULT_TITLE: Record<AuthVariant, string> = {
  signin: 'Sign in to your account',
  signup: 'Create your account',
  reset: 'Reset your password',
  verify: 'Verify your email',
};

function AuthTemplate({
  variant = 'signin',
  logo,
  title,
  description,
  form,
  footer,
  className,
  ...props
}: AuthTemplateProps) {
  return (
    <main
      data-slot="auth-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-variant={variant}
      className={cn(
        'bg-background flex min-h-screen items-center justify-center py-xl',
        className,
      )}
      {...props}
    >
      <Container size="prose">
        <Stack gap="lg">
          <SectionBoundary name="auth-header" skeletonVariant="page-header">
            <Stack gap="md" align="center">
              {logo ? <div>{logo}</div> : null}
              <Typography variant="h2" as="h1" className="text-center text-balance">
                {title ?? DEFAULT_TITLE[variant]}
              </Typography>
              {description ? (
                <Typography
                  variant="body"
                  tone="muted"
                  className="max-w-prose text-center"
                >
                  {description}
                </Typography>
              ) : null}
            </Stack>
          </SectionBoundary>

          <SectionBoundary name="auth-form" skeletonVariant="newsletter-form">
            <div className="border-border bg-card rounded-lg border p-lg">
              {form}
            </div>
          </SectionBoundary>

          {footer ? (
            <SectionBoundary name="auth-footer" skeletonVariant="text">
              <div className="text-muted-foreground text-center text-sm">
                {footer}
              </div>
            </SectionBoundary>
          ) : null}
        </Stack>
      </Container>
    </main>
  );
}
AuthTemplate.displayName = 'AuthTemplate';

/**
 * Page-level loading state — the full-page silhouette of
 * `<AuthTemplate>`, not a single rect. Rendered by the consumer while
 * the whole route's data is in flight (`loading.tsx` in Next.js), or as
 * a `<SectionBoundary skeleton={…}>` override.
 *
 * Shapes mirror the real layout so the swap is CLS-neutral (R23). One
 * `role="status"` region for the page; inner skeletons pass
 * `label={null}` so screen readers hear one announcement, not ten.
 */
function AuthTemplateSkeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="auth-template-skeleton"
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
        <Stack gap="lg">
          <Skeleton variant="page-header" label={null} />
          <Skeleton variant="newsletter-form" label={null} />
          <Skeleton variant="text" label={null} />
        </Stack>
      </Container>
    </div>
  );
}
AuthTemplateSkeleton.displayName = 'AuthTemplateSkeleton';
AuthTemplate.Skeleton = AuthTemplateSkeleton;

export { AuthTemplate };
export type { AuthTemplateProps, AuthVariant };
