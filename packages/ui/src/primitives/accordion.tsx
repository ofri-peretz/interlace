'use client';

/**
 * @interlace/ui — Accordion
 *
 * A disclosure stack: a column of headers whose panels open and close. Wraps
 * @base-ui/react/accordion — Base UI owns the open state (single or multiple),
 * the keyboard model and every piece of the accordion ARIA.
 *
 * We own the item divider, the trigger row, and the chevron that rotates on
 * `data-panel-open`.
 *
 * ## Anatomy
 *
 *   Accordion                        (Base UI Accordion.Root — data-min-viewport=320)
 *     └─ AccordionItem               (border-b, dropped on the last item)
 *          ├─ AccordionTrigger       (Accordion.Header > Accordion.Trigger + ChevronDownIcon)
 *          └─ AccordionContent       (Accordion.Panel > div)
 *
 * Every node above carries a `data-slot`, including the two that used not to:
 * the `Accordion.Header` around the trigger button (`accordion-header`) and the
 * padding `div` inside the panel (`accordion-content-inner`).
 *
 * ## Where `className` lands
 *
 * `AccordionContent` forwards the caller's `className` to the `Panel` — the box
 * that owns `overflow-hidden` and the open/close animation — not to the inner
 * padding `div`. It used to be the other way round, which left the animated box
 * unreachable from a call site. `primitive-api-contract-lock` pins it.
 *
 * ## MIN_VIEWPORT — 320
 *
 * A disclosure stack is full-width by construction: the trigger row is
 * `flex-1` and the chevron is `shrink-0`, so a long heading wraps inside the
 * row instead of pushing the chevron off a 320px screen.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | every wrapper is `React.ComponentProps<typeof BaseAccordion.*>` |
 * | R6   | data-slot per part               | accordion / -item / -header / -trigger / -content / -content-inner |
 * | R7   | cn + ...rest                     | `cn('border-b last:border-b-0', className)` + `{...props}`  |
 * | R12  | Reuse over wrap                  | Base UI owns open state, keyboard and ARIA                  |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` on the root      |
 * | R19  | Tokens only                      | `text-muted-foreground`, `ring-ring/50`, `border-ring`      |
 * | R25  | Client component                 | Required — Base UI Accordion ships client hooks             |
 * | R26  | A11y from upstream               | `Accordion.Header` + `Trigger` emit the button/region pair  |
 */

import * as React from 'react';
import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. A disclosure
 * stack is full-width by construction: the trigger row is `flex-1` with the
 * chevron `shrink-0`, so headings wrap instead of clipping at 320px.
 */
export const MIN_VIEWPORT = 320 as const;

function Accordion(
  props: React.ComponentProps<typeof BaseAccordion.Root>,
) {
  return (
    <BaseAccordion.Root
      data-slot="accordion"
      data-min-viewport={String(MIN_VIEWPORT)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Item>) {
  return (
    <BaseAccordion.Item
      data-slot="accordion-item"
      className={cn('border-b last:border-b-0', className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Trigger>) {
  return (
    <BaseAccordion.Header data-slot="accordion-header" className="flex">
      <BaseAccordion.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-panel-open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseAccordion.Panel>) {
  return (
    <BaseAccordion.Panel
      data-slot="accordion-content"
      // `className` lands HERE, on the Panel — the box that owns
      // `overflow-hidden` and the open/close animation. It used to land on the
      // inner padding `div` instead, which left the animated box unreachable
      // from a call site: restyling it meant editing this file.
      className={cn(
        'data-[open]:animate-accordion-down data-[closed]:animate-accordion-up overflow-hidden text-sm',
        className,
      )}
      {...props}
    >
      {/*
       * The padding is its own node so the Panel's animation can measure a
       * stable box. It carries a `data-slot` (R6) so a consumer can reach the
       * padding without fighting the animation.
       */}
      <div data-slot="accordion-content-inner" className="pt-0 pb-4">
        {children}
      </div>
    </BaseAccordion.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
