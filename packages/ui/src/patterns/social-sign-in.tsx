'use client';

/**
 * @interlace/ui — SocialSignIn
 *
 * "Continue with Google / Apple / X / …" plus an optional email link, in one
 * form. Pick the providers and their order; the first `featured` ones get a
 * full-width button with their name, the rest share a row of icon buttons,
 * and the provider the visitor used last time moves to the front with a
 * "Last used" tag. The pattern draws the buttons and reports which one was
 * pressed. It does not know about any auth library.
 *
 * ## Two ways to wire it
 *
 * 1. **As a form** (works without JavaScript). Pass `action`, such as a
 *    server action. Every provider button is a submit button with
 *    `name="provider"` and its id as the value, and the email button submits
 *    `provider=email` with the `email` field. While the action runs, the
 *    pressed button shows its spinner (`useFormStatus`).
 * 2. **With callbacks.** Pass `onProviderSelect` and/or `onEmailSubmit`. The
 *    submit is intercepted, the callback runs, and the pressed button spins
 *    until its promise settles.
 *
 * ## Email link
 *
 * `email` adds an "or" divider, an email field and a submit button. When the
 * link has gone out, pass `sentTo` with the address and the form becomes a
 * "Check your inbox" message with a way back (`onUseAnotherEmail`).
 *
 * ## Provider marks
 *
 * The built-in providers carry their own marks, drawn the way each
 * provider's sign-in guidelines ask: Google's four-colour G, Microsoft's four
 * squares, Facebook and LinkedIn in their blue. These are the only literal
 * colours in Interlace, and they are not themeable on purpose: a recolored
 * Google G breaks Google's branding terms. Apple, X, TikTok and GitHub are
 * one-colour marks and follow `currentColor`, so they work on dark themes.
 * Anything else is a `{ id, name, icon }` object; `id` is what gets submitted.
 *
 * ## Anatomy
 *
 *   SocialSignIn                     (form — data-slot="social-sign-in")
 *     ├─ div                         (data-slot="social-sign-in-featured" — full-width buttons)
 *     │   └─ Button                  (data-slot="social-sign-in-provider", data-provider, data-last-used)
 *     ├─ div                         (data-slot="social-sign-in-more" — a row of icon buttons)
 *     ├─ div                         (data-slot="social-sign-in-divider" — "or")
 *     ├─ div                         (data-slot="social-sign-in-email" — field + submit)
 *     ├─ div[role=status]            (data-slot="social-sign-in-sent" — replaces everything once sent)
 *     └─ p[role=alert]               (data-slot="social-sign-in-error")
 *
 * ## MIN_VIEWPORT — 320
 *
 * Featured buttons are full width; the icon row wraps, and every icon button
 * is 44px square, the WCAG 2.5.5 target.
 *
 * | Rule | Concept                   | Where in this file                                            |
 * | ---- | ------------------------- | ------------------------------------------------------------- |
 * | R4   | Extends native el         | `Omit<React.ComponentProps<'form'>, 'children'>`              |
 * | R6   | data-slot per part        | social-sign-in / -featured / -more / -provider / -email / -sent |
 * | R7   | cn + ...rest              | `cn(…, className)` + `{...props}` on the form                 |
 * | R8   | Enums, no booleans        | `SocialProvider` union; `featured` is a count                 |
 * | R10  | Composition seam          | custom providers as `{ id, name, icon }`; every label a prop  |
 * | R13  | Ecosystem first           | Button (spinner), Input, Badge; React `useFormStatus`         |
 * | R14  | Declares min viewport     | `data-min-viewport` + exported const                          |
 * | R18  | Tailwind only             | no inline style                                               |
 * | R19  | Tokens only               | except the provider marks, see above                          |
 * | R25  | Client component          | `'use client'`: pending state and submit interception         |
 * | R26  | A11y                      | icon buttons named by `aria-label`; sent state is a live region; error is an alert |
 */

import * as React from 'react';
import { useFormStatus } from 'react-dom';

import { cn } from '../lib/cn.js';
import { Badge } from '../primitives/badge.js';
import { Button } from '../primitives/button.js';
import { Input } from '../primitives/input.js';

export const MIN_VIEWPORT = 320 as const;

export type SocialProvider =
  | 'google'
  | 'apple'
  | 'facebook'
  | 'x'
  | 'tiktok'
  | 'microsoft'
  | 'linkedin'
  | 'github';

export type CustomSocialProvider = {
  /** Submitted as the `provider` value, and passed to `onProviderSelect`. */
  id: string;
  /** Shown on the button: "Continue with {name}". */
  name: string;
  /** A 20px mark. Decorative: the button is named by its text. */
  icon?: React.ReactNode;
};

export type SocialSignInProvider = SocialProvider | CustomSocialProvider;

const svg = (viewBox: string, children: React.ReactNode) => (
  <svg viewBox={viewBox} aria-hidden="true" focusable="false" className="size-5 shrink-0">
    {children}
  </svg>
);

/* Provider marks. The fills are the providers' own and stay literal (see header). */
const MARKS: Record<SocialProvider, { name: string; icon: React.ReactNode }> = {
  google: {
    name: 'Google',
    icon: svg(
      '0 0 48 48',
      <>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </>,
    ),
  },
  apple: {
    name: 'Apple',
    icon: svg(
      '0 0 24 24',
      <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />,
    ),
  },
  facebook: {
    name: 'Facebook',
    icon: svg(
      '0 0 24 24',
      <path fill="#0866FF" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />,
    ),
  },
  x: {
    name: 'X',
    icon: svg(
      '0 0 24 24',
      <path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />,
    ),
  },
  tiktok: {
    name: 'TikTok',
    icon: svg(
      '0 0 24 24',
      <path fill="currentColor" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />,
    ),
  },
  microsoft: {
    name: 'Microsoft',
    icon: svg(
      '0 0 21 21',
      <>
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
      </>,
    ),
  },
  linkedin: {
    name: 'LinkedIn',
    icon: svg(
      '0 0 24 24',
      <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />,
    ),
  },
  github: {
    name: 'GitHub',
    icon: svg(
      '0 0 24 24',
      <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />,
    ),
  },
};

const DEFAULT_PROVIDERS: readonly SocialProvider[] = ['google', 'apple', 'facebook', 'x'];

type Resolved = { id: string; name: string; icon: React.ReactNode };

/** A built-in provider's display name and mark, or undefined for an unknown id. */
export function providerMark(id: string): { name: string; icon: React.ReactNode } | undefined {
  return Object.prototype.hasOwnProperty.call(MARKS, id) ? MARKS[id as SocialProvider] : undefined;
}

function resolve(p: SocialSignInProvider): Resolved {
  if (typeof p === 'string') return { id: p, ...MARKS[p] };
  return { id: p.id, name: p.name, icon: p.icon ?? null };
}

/** The providers in display order, with the last-used one moved to the front. */
export function orderProviders(
  providers: readonly SocialSignInProvider[],
  lastUsed?: string,
): Resolved[] {
  const list = providers.map(resolve);
  const i = lastUsed ? list.findIndex((p) => p.id === lastUsed) : -1;
  if (i > 0) list.unshift(...list.splice(i, 1));
  return list;
}

type SocialSignInProps = Omit<React.ComponentProps<'form'>, 'children' | 'onSubmit'> & {
  /** Which providers, in order. @default ['google', 'apple', 'facebook', 'x'] */
  providers?: readonly SocialSignInProvider[];
  /**
   * How many providers get a full-width named button; the rest share a row of
   * icon buttons. When everything fits (four or fewer), all are featured.
   * @default 2
   */
  featured?: number;
  /** The provider id (or `'email'`) used last time: it moves first and is tagged. */
  lastUsed?: string;
  /** @default 'Last used' */
  lastUsedLabel?: string;
  /** Button text for a featured provider. @default name => `Continue with ${name}` */
  labelFor?: (name: string) => string;
  /** Called with the provider id. A returned promise keeps that button busy. */
  onProviderSelect?: (provider: string) => void | Promise<unknown>;
  /** Adds the email-link field under an "or" divider. @default false */
  email?: boolean;
  /** Called with the address. A returned promise keeps the button busy. */
  onEmailSubmit?: (email: string) => void | Promise<unknown>;
  /** @default 'Email' */
  emailLabel?: string;
  /** @default 'you@example.com' */
  emailPlaceholder?: string;
  /** @default 'Email me a sign-in link' */
  emailSubmitLabel?: string;
  /** @default 'or' */
  dividerLabel?: string;
  /** The address the link went to. Replaces the form with a "check your inbox" note. */
  sentTo?: string;
  /** @default 'Check your inbox' */
  sentTitle?: React.ReactNode;
  /** @default email => `We sent a sign-in link to ${email}.` */
  sentMessage?: (email: string) => React.ReactNode;
  /** Shows a "use a different email" button in the sent state. */
  onUseAnotherEmail?: () => void;
  /** @default 'Use a different email' */
  useAnotherEmailLabel?: string;
  /** Shown under the buttons as an alert. */
  error?: React.ReactNode;
  /** Fine print under everything, such as links to the terms and privacy notice. */
  footer?: React.ReactNode;
  /** Disables every button. */
  disabled?: boolean;
};

export function SocialSignIn({
  className,
  providers = DEFAULT_PROVIDERS,
  featured = 2,
  lastUsed,
  lastUsedLabel = 'Last used',
  labelFor = (name) => `Continue with ${name}`,
  onProviderSelect,
  email = false,
  onEmailSubmit,
  emailLabel = 'Email',
  emailPlaceholder = 'you@example.com',
  emailSubmitLabel = 'Email me a sign-in link',
  dividerLabel = 'or',
  sentTo,
  sentTitle = 'Check your inbox',
  sentMessage = (address) => `We sent a sign-in link to ${address}.`,
  onUseAnotherEmail,
  useAnotherEmailLabel = 'Use a different email',
  error,
  footer,
  disabled = false,
  ...props
}: SocialSignInProps) {
  const emailId = React.useId();
  const errorId = React.useId();
  const [busy, setBusy] = React.useState<string | null>(null);

  const ordered = orderProviders(providers, lastUsed);
  const cut = ordered.length <= 4 ? ordered.length : Math.max(0, featured);
  const big = ordered.slice(0, cut);
  const small = ordered.slice(cut);

  // A rejected callback is the consumer's to report through `error`; it must not surface as an
  // unhandled rejection here.
  const run = (id: string, work: void | Promise<unknown>) => {
    if (!(work instanceof Promise)) return;
    setBusy(id);
    work.catch(() => {}).finally(() => setBusy((b) => (b === id ? null : b)));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const id = submitter?.value;
    if (!id) return;
    // One submission at a time: a second press while one runs does nothing. (The busy button also
    // swallows clicks itself; this covers Enter in the email field and any other submitter.)
    if (busy !== null) {
      e.preventDefault();
      return;
    }
    if (id === 'email' && onEmailSubmit) {
      e.preventDefault();
      const address = String(new FormData(e.currentTarget).get('email') ?? '').trim();
      run('email', onEmailSubmit(address));
    } else if (id !== 'email' && onProviderSelect) {
      e.preventDefault();
      run(id, onProviderSelect(id));
    }
  };

  if (sentTo) {
    return (
      <div
        role="status"
        data-slot="social-sign-in-sent"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'bg-muted/50 border-border flex flex-col gap-2 rounded-xl border p-5 text-sm',
          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-(--duration-medium)',
          className,
        )}
      >
        <p className="text-foreground text-base font-semibold">{sentTitle}</p>
        <p className="text-muted-foreground">{sentMessage(sentTo)}</p>
        {onUseAnotherEmail ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="self-start px-0"
            onClick={onUseAnotherEmail}
          >
            {useAnotherEmailLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form
      data-slot="social-sign-in"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex w-full flex-col gap-4', className)}
      onSubmit={handleSubmit}
      aria-describedby={error ? errorId : undefined}
      {...props}
    >
      {big.length > 0 ? (
        <div data-slot="social-sign-in-featured" className="flex flex-col gap-2">
          {big.map((p) => (
            <ProviderButton
              key={p.id}
              provider={p}
              label={labelFor(p.name)}
              lastUsed={p.id === lastUsed ? lastUsedLabel : undefined}
              busy={busy}
              disabled={disabled}
            />
          ))}
        </div>
      ) : null}

      {small.length > 0 ? (
        <div data-slot="social-sign-in-more" className="flex flex-wrap justify-center gap-2">
          {small.map((p) => (
            <ProviderButton
              key={p.id}
              provider={p}
              label={labelFor(p.name)}
              compact
              busy={busy}
              disabled={disabled}
            />
          ))}
        </div>
      ) : null}

      {email ? (
        <>
          <div
            data-slot="social-sign-in-divider"
            className="text-muted-foreground flex items-center gap-3 text-xs uppercase tracking-wide"
          >
            <span aria-hidden="true" className="bg-border h-px flex-1" />
            {dividerLabel}
            <span aria-hidden="true" className="bg-border h-px flex-1" />
          </div>
          <div data-slot="social-sign-in-email" className="flex flex-col gap-2">
            <label htmlFor={emailId} className="text-foreground text-sm font-medium">
              {emailLabel}
              {lastUsed === 'email' ? <LastUsedTag label={lastUsedLabel} /> : null}
            </label>
            <EmailField id={emailId} placeholder={emailPlaceholder} disabled={disabled} />
            <SubmitButton
              value="email"
              busy={busy}
              disabled={disabled}
              variant="default"
              className="w-full"
            >
              {emailSubmitLabel}
            </SubmitButton>
          </div>
        </>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" data-slot="social-sign-in-error" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {footer ? (
        <div className="text-muted-foreground text-center text-xs [&_a]:underline [&_a]:underline-offset-2">
          {footer}
        </div>
      ) : null}
    </form>
  );
}

function LastUsedTag({ label }: { label: string }) {
  return (
    <Badge variant="secondary" data-slot="social-sign-in-last-used" className="ms-1">
      {label}
    </Badge>
  );
}

function EmailField({ id, placeholder, disabled }: { id: string; placeholder: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Input
      id={id}
      name="email"
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder={placeholder}
      disabled={disabled}
      readOnly={pending}
      // Required only for the email button: provider buttons use formNoValidate.
      required
    />
  );
}

type SubmitButtonProps = Omit<React.ComponentProps<typeof Button>, 'value' | 'type'> & {
  value: string;
  busy: string | null;
};

/** A submit button that spins while its own submission is pending. */
function SubmitButton({ value, busy, disabled, children, ...rest }: SubmitButtonProps) {
  const status = useFormStatus();
  const pendingHere = status.pending && status.data?.get('provider') === value;
  const loading = busy === value || pendingHere;
  const anyBusy = busy !== null || status.pending;
  return (
    <Button
      type="submit"
      name="provider"
      value={value}
      loading={loading}
      disabled={disabled || (anyBusy && !loading)}
      {...rest}
    >
      {children}
    </Button>
  );
}

function ProviderButton({
  provider,
  label,
  lastUsed,
  compact = false,
  busy,
  disabled,
}: {
  provider: Resolved;
  label: string;
  lastUsed?: string;
  compact?: boolean;
  busy: string | null;
  disabled: boolean;
}) {
  return (
    <SubmitButton
      value={provider.id}
      busy={busy}
      disabled={disabled}
      variant="outline"
      size={compact ? 'icon-lg' : 'lg'}
      formNoValidate
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      data-slot="social-sign-in-provider"
      data-provider={provider.id}
      data-last-used={lastUsed ? '' : undefined}
      className={cn(
        compact ? 'size-11' : 'w-full justify-center gap-3',
        'motion-safe:transition-transform motion-safe:active:scale-[0.98]',
      )}
    >
      {provider.icon}
      {compact ? null : <span>{label}</span>}
      {lastUsed ? <LastUsedTag label={lastUsed} /> : null}
    </SubmitButton>
  );
}
