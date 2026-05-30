import * as React from 'react';

import { Button } from '../primitives/button.js';
import { Checkbox } from '../primitives/checkbox.js';
import { Field, FieldControl, FieldError, FieldLabel, Form } from '../primitives/form.js';
import { Input } from '../primitives/input.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';

/**
 * @interlace/ui — NewsletterForm
 *
 * Canonical email-signup pattern: title + (optional) description + email
 * field + consent checkbox + submit. Composition of the auth primitive set
 * (Form / Field / Input / Button + Checkbox + Typography). The block owns
 * *structure*; consumers wire `action` and pass brand copy via props.
 *
 * Includes a honeypot `<input type="text" name="website">` rendered with
 * `tabIndex={-1}`, `aria-hidden`, and `.sr-only` — invisible + unreachable
 * to humans + assistive tech, but auto-filled by naive form-spam bots. The
 * server handler should reject any submission where `website` is non-empty.
 *
 * ## Anatomy
 *
 *   NewsletterForm                    (block — data-min-viewport=320)
 *     ├─ Typography variant=h3        (title)
 *     ├─ Typography variant=body      (description — optional)
 *     ├─ Form                         (the <form> element from primitives/form.tsx)
 *     │   ├─ Field name="email"
 *     │   │   ├─ FieldLabel
 *     │   │   └─ FieldControl render={<Input type="email" />}
 *     │   ├─ <label> Checkbox + consentLabel
 *     │   ├─ <input type="text" name="website" /> (honeypot — sr-only, aria-hidden)
 *     │   └─ Button type="submit"
 *     └─ <slot for footer>
 *
 * MIN_VIEWPORT — 320. Newsletter forms are typically embedded in footers
 * and sidebars on the narrowest viewports; must work on a 320 CSS-px
 * iPhone SE.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends React.ComponentProps     | `React.ComponentProps<'form'> & NewsletterFormProps`        |
 * | R6   | data-slot on root                | `data-slot="newsletter-form"`                               |
 * | R7   | className merged + ...rest       | `cn(...) + {...props}` on the Form root                     |
 * | R10  | Composition seam                 | `footer` prop slots consumer-supplied UI                    |
 * | R13  | Ecosystem first                  | Built on the primitives layer; no bespoke form state        |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline style; classes only                             |
 * | R19  | Tokens only                      | Spacing/typography from existing primitives                 |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from primitives             | Base UI Field owns label association + aria-describedby     |
 */

export const MIN_VIEWPORT = 320 as const;

type NewsletterFormProps = React.ComponentProps<'form'> & {
  /** Headline above the form. Defaults to "Subscribe to the newsletter". */
  title?: React.ReactNode;
  /** Optional supporting copy under the title. */
  description?: React.ReactNode;
  /** Label on the submit button. Defaults to "Subscribe". */
  submitLabel?: React.ReactNode;
  /** Consent text rendered next to the consent checkbox. */
  consentLabel?: React.ReactNode;
  /** Slot below the form — typically a privacy-policy link or unsubscribe note. */
  footer?: React.ReactNode;
};

export function NewsletterForm({
  className,
  title = 'Subscribe to the newsletter',
  description,
  submitLabel = 'Subscribe',
  consentLabel = 'I agree to receive occasional emails. Unsubscribe any time.',
  footer,
  ...props
}: NewsletterFormProps) {
  return (
    <Stack
      gap="lg"
      data-slot="newsletter-form"
      data-min-viewport={String(MIN_VIEWPORT)}
      className="w-full max-w-sm"
    >
      <div>
        <Typography as="h3" variant="h3">
          {title}
        </Typography>
        {description ? (
          <Typography variant="body" tone="muted" className="mt-2">
            {description}
          </Typography>
        ) : null}
      </div>

      <Form className={className} {...props}>
        <Stack gap="md">
          <Field name="email">
            <FieldLabel>Email</FieldLabel>
            <FieldControl
              render={
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@interlace.tools"
                  required
                />
              }
            />
            <FieldError />
          </Field>

          <label className="flex items-start gap-sm text-ui-sm">
            <Checkbox name="consent" required className="mt-0.5" />
            <span className="text-muted-foreground">{consentLabel}</span>
          </label>

          {/*
            Honeypot field. Hidden from sighted users (sr-only) and AT
            (aria-hidden + tabIndex=-1); naive bots will still fill it.
            The server handler should reject any submission where this
            field is non-empty.
          */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            aria-hidden
            autoComplete="off"
            className="sr-only"
          />

          <Button type="submit" className="mt-2 w-full">
            {submitLabel}
          </Button>
        </Stack>
      </Form>

      {footer ? (
        <Typography variant="ui-sm" tone="muted" align="center">
          {footer}
        </Typography>
      ) : null}
    </Stack>
  );
}
