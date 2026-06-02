'use client';

/**
 * @interlace/ui — FAQ
 *
 * Frequently-asked-questions accordion. Composes the canonical Accordion
 * primitive into a single-prop API: pass an array of {question, answer}
 * and get the full disclosure pattern (keyboard, ARIA, animation)
 * inherited from Accordion → Base UI.
 *
 * ## Anatomy
 *
 *   <section data-slot="faq" data-min-viewport="320">
 *     <Container>
 *       <Typography variant="h2">{title}</Typography>
 *       <Accordion>{questions.map(...)}</Accordion>
 *     </Container>
 *   </section>
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'section'>` + FAQ props               |
 * | R6   | data-slot on root                | `data-slot="faq"`                                           |
 * | R10  | Composition seam (questions)     | Array<{question, answer}>                                    |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`                                         |
 * | R19  | Tokens only                      | Container + Accordion own all tokens                        |
 * | R25  | Client component                 | Accordion is client-tier                                    |
 * | R26  | A11y from Accordion              | Accordion owns disclosure ARIA                              |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../primitives/accordion.js';
import { Container } from '../primitives/container.js';
import { Skeleton } from '../primitives/skeleton.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';

export const MIN_VIEWPORT = 320 as const;

interface FAQItem {
  question: React.ReactNode;
  answer: React.ReactNode;
}

interface FAQProps extends Omit<React.ComponentProps<'section'>, 'title'> {
  title?: React.ReactNode;
  lead?: React.ReactNode;
  items?: FAQItem[];
  /**
   * Whether more than one item can be open at a time. Defaults to
   * `false` (single-open).
   */
  multiple?: boolean;
  /** When true, render a placeholder list of card skeletons. */
  loading?: boolean;
  /** Skeleton count when loading. Defaults to 4. */
  loadingCount?: number;
}

function FAQ({
  title,
  lead,
  items = [],
  multiple = false,
  loading,
  loadingCount = 4,
  className,
  ...props
}: FAQProps) {
  return (
    <section
      data-slot="faq"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('py-xl', className)}
      {...props}
    >
      <Container size="prose">
        <Stack gap="lg">
          {(title || lead) && (
            <Stack gap="sm">
              {title ? (
                <Typography variant="h2" as="h2" className="text-balance">
                  {title}
                </Typography>
              ) : null}
              {lead ? (
                <Typography variant="long" tone="muted">
                  {lead}
                </Typography>
              ) : null}
            </Stack>
          )}
          {loading ? (
            <Stack gap="sm">
              {Array.from({ length: loadingCount }).map((_, i) => (
                <Skeleton key={i} variant="card" label={null} />
              ))}
            </Stack>
          ) : items.length > 0 ? (
            <Accordion multiple={multiple}>
              {items.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : null}
        </Stack>
      </Container>
    </section>
  );
}
FAQ.displayName = 'FAQ';

export { FAQ };
export type { FAQProps, FAQItem };
