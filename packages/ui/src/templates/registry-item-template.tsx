/**
 * @interlace/ui — RegistryItemTemplate
 *
 * Full-page surface for a single registry item's documentation
 * (`/c/[name]` on ds.interlace.tools). Composes the header (item name +
 * description + install snippet), the anatomy diagram, the variants
 * matrix, related-components grid, and a CTA back to the registry —
 * each in its own `<SectionBoundary>` so the page streams
 * section-by-section.
 *
 * The DS eats its own dog food here: the registry app's `/c/[name]/page.tsx`
 * uses this template instead of hand-rolling the layout per-item.
 *
 * ## Anatomy
 *
 *   <article data-slot="registry-item-template" data-min-viewport="320">
 *     <Container size="content">
 *       <SectionBoundary name="registry-item-header">
 *         Header: name + description + install command
 *       </SectionBoundary>
 *       <SectionBoundary name="registry-item-anatomy">
 *         Anatomy / API surface
 *       </SectionBoundary>
 *       <SectionBoundary name="registry-item-variants">
 *         Variant matrix (CVA-driven)
 *       </SectionBoundary>
 *       <SectionBoundary name="registry-item-related">
 *         Related components
 *       </SectionBoundary>
 *     </Container>
 *   </article>
 *
 * ## MIN_VIEWPORT — 320
 *
 * Container.content collapses to full width below 1024; the template
 * layout is fluid down to 320 CSS-px.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'article'>` + template props          |
 * | R6   | data-slot on root                | `data-slot="registry-item-template"`                        |
 * | R7   | className merged + ...rest       | `cn(className)` + `{...props}` on <article>                 |
 * | R10  | Composition seam (slots)         | `header` / `anatomy` / `variants` / `related` ReactNode props |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}`                  |
 * | R18  | Tailwind only                    | Zero inline `style`; layout via Container + Stack + cn()    |
 * | R19  | Tokens only                      | (delegated to composed primitives)                          |
 * | R20  | AA contrast                      | (delegated)                                                  |
 * | R25  | Server component                 | Pure composition — no hooks                                 |
 * | R26  | A11y                             | `<article>` landmark + per-section `<SectionBoundary>` regions |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Container } from '../primitives/container.js';
import { Typography } from '../primitives/typography.js';
import { Stack } from '../primitives/stack.js';

export const MIN_VIEWPORT = 320 as const;

interface RegistryItemTemplateProps
  extends Omit<React.ComponentProps<'article'>, 'title'> {
  /** Component name — rendered as the page h1. */
  name: string;
  /** One-line description shown under the name. */
  description?: React.ReactNode;
  /**
   * Install command — typically a `<CodeBlock language="bash">npx shadcn
   * add @interlace/<name></CodeBlock>` element. Pass as ReactNode so the
   * template doesn't take a hard dep on CodeBlock.
   */
  install?: React.ReactNode;
  /** Anatomy diagram + API surface (slots, props, R-rule mapping). */
  anatomy?: React.ReactNode;
  /** Variants matrix — CVA cells, themed in light + dark. */
  variants?: React.ReactNode;
  /** Related-components grid (e.g. "Often used with…"). */
  related?: React.ReactNode;
  /**
   * Extra trailing content (e.g. a CTA back to the index, a "Report an
   * issue" link). Rendered AFTER `related` inside its own SectionBoundary.
   */
  footer?: React.ReactNode;
}

function RegistryItemTemplate({
  name,
  description,
  install,
  anatomy,
  variants,
  related,
  footer,
  className,
  ...props
}: RegistryItemTemplateProps) {
  return (
    <article
      data-slot="registry-item-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('py-xl', className)}
      {...props}
    >
      <Container size="content">
        <SectionBoundary
          name="registry-item-header"
          skeletonVariant="page-header"
        >
          <Stack gap="md">
            <Typography variant="h1" as="h1" className="text-balance">
              {name}
            </Typography>
            {description ? (
              <Typography
                variant="long"
                as="p"
                tone="muted"
                className="max-w-prose"
              >
                {description}
              </Typography>
            ) : null}
            {install ? <div className="mt-md">{install}</div> : null}
          </Stack>
        </SectionBoundary>

        {anatomy ? (
          <SectionBoundary
            name="registry-item-anatomy"
            skeletonVariant="code-block"
            className="mt-xl"
          >
            <Stack gap="md">
              <Typography variant="h2" as="h2">
                Anatomy
              </Typography>
              {anatomy}
            </Stack>
          </SectionBoundary>
        ) : null}

        {variants ? (
          <SectionBoundary
            name="registry-item-variants"
            skeletonVariant="card"
            className="mt-xl"
          >
            <Stack gap="md">
              <Typography variant="h2" as="h2">
                Variants
              </Typography>
              {variants}
            </Stack>
          </SectionBoundary>
        ) : null}

        {related ? (
          <SectionBoundary
            name="registry-item-related"
            skeletonVariant="article-card"
            className="mt-xl"
          >
            <Stack gap="md">
              <Typography variant="h2" as="h2">
                Related components
              </Typography>
              {related}
            </Stack>
          </SectionBoundary>
        ) : null}

        {footer ? (
          <SectionBoundary
            name="registry-item-footer"
            skeletonVariant="card"
            className="mt-xl"
          >
            {footer}
          </SectionBoundary>
        ) : null}
      </Container>
    </article>
  );
}
RegistryItemTemplate.displayName = 'RegistryItemTemplate';

export { RegistryItemTemplate };
export type { RegistryItemTemplateProps };
