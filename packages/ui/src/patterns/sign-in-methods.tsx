'use client';

/**
 * @interlace/ui — SignInMethods
 *
 * The "ways you can sign in" list on an account page: one row per method
 * (Google, Apple, email…), each with its mark, what it is linked to, and a
 * Connect or Disconnect button. Disconnecting asks once more in place
 * ("Disconnect" → "Yes, disconnect" / "Cancel"), and the last connected
 * method cannot be disconnected, with the reason said next to it, so nobody
 * locks themselves out.
 *
 * The pattern draws and reports. The consumer links and unlinks identities
 * in its auth library inside `onConnect` / `onDisconnect`; a returned promise
 * keeps that row's button busy until it settles.
 *
 * ## Anatomy
 *
 *   SignInMethods                    (ul — data-slot="sign-in-methods")
 *     └─ li × methods                (data-slot="sign-in-method", data-method, data-connected)
 *         ├─ span                    (the mark, in a bordered square)
 *         ├─ div                     (name + detail, such as the linked address or "Not connected")
 *         └─ div                     (Connect | Disconnect | Yes, disconnect + Cancel)
 *     └─ p                           (data-slot="sign-in-methods-hint" — why the last one is locked)
 *
 * Built-in ids (`google`, `apple`, `x`…) take their name and mark from
 * SocialSignIn; `email` gets a mail icon. Anything else passes `name` and
 * `icon`.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Rows wrap: on a narrow screen the buttons drop under the name.
 *
 * | Rule | Concept                 | Where in this file                                      |
 * | ---- | ----------------------- | ------------------------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'ul'>`                            |
 * | R6   | data-slot per part      | sign-in-methods / -method / -hint                       |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                       |
 * | R10  | Composition seam        | custom `name` / `icon` / `detail`; every label a prop   |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const                    |
 * | R18  | Tailwind only           | no inline style                                         |
 * | R19  | Tokens only             | `bg-card`, `border-border`, `text-muted-foreground`     |
 * | R25  | Client component        | confirm and busy state                                  |
 * | R26  | A11y                    | locked button described by the hint; confirm moves focus |
 */

import * as React from 'react';
import { Mail } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { Button } from '../primitives/button.js';
import { providerMark } from './social-sign-in.js';

export const MIN_VIEWPORT = 320 as const;

export type SignInMethod = {
  /** `google`, `apple`, `email`… or your own id. Passed to the callbacks. */
  id: string;
  /** Defaults to the built-in name for known ids. */
  name?: string;
  /** Defaults to the built-in mark for known ids. */
  icon?: React.ReactNode;
  /** What it is linked to, such as the address. Shown under the name when connected. */
  detail?: React.ReactNode;
  connected: boolean;
};

type SignInMethodsProps = React.ComponentProps<'ul'> & {
  methods: readonly SignInMethod[];
  onConnect?: (id: string) => void | Promise<unknown>;
  onDisconnect?: (id: string) => void | Promise<unknown>;
  /** @default 'Connect' */
  connectLabel?: string;
  /** @default 'Disconnect' */
  disconnectLabel?: string;
  /** @default 'Yes, disconnect' */
  confirmLabel?: string;
  /** @default 'Cancel' */
  cancelLabel?: string;
  /** @default 'Not connected' */
  notConnectedLabel?: React.ReactNode;
  /** Said when only one method is left. @default 'You need at least one way to sign in, so this one stays.' */
  lastMethodHint?: React.ReactNode;
};

function SignInMethods({
  className,
  methods,
  onConnect,
  onDisconnect,
  connectLabel = 'Connect',
  disconnectLabel = 'Disconnect',
  confirmLabel = 'Yes, disconnect',
  cancelLabel = 'Cancel',
  notConnectedLabel = 'Not connected',
  lastMethodHint = 'You need at least one way to sign in, so this one stays.',
  ...props
}: SignInMethodsProps) {
  const hintId = React.useId();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  const connectedCount = methods.filter((m) => m.connected).length;
  const locked = connectedCount <= 1;

  React.useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const run = (id: string, work: void | Promise<unknown>) => {
    setConfirming(null);
    if (!(work instanceof Promise)) return;
    setBusy(id);
    // A rejection is the consumer's to report; it must not surface as an unhandled one here.
    work.catch(() => {}).finally(() => setBusy((b) => (b === id ? null : b)));
  };

  return (
    <>
      <ul
        data-slot="sign-in-methods"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'bg-card text-card-foreground border-border divide-border divide-y rounded-xl border',
          className,
        )}
        {...props}
      >
        {methods.map((m) => {
          const known = m.id === 'email' ? { name: 'Email', icon: <Mail className="size-5" aria-hidden="true" /> } : providerMark(m.id);
          const name = m.name ?? known?.name ?? m.id;
          const icon = m.icon ?? known?.icon ?? null;
          const isBusy = busy === m.id;
          const isConfirming = confirming === m.id;
          const isLocked = m.connected && locked;
          return (
            <li
              key={m.id}
              data-slot="sign-in-method"
              data-method={m.id}
              data-connected={m.connected ? '' : undefined}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4"
            >
              <span className="border-border bg-background flex size-10 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-5">
                {icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium">{name}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {m.connected ? (m.detail ?? null) : notConnectedLabel}
                </p>
              </div>
              <div className="ms-auto flex items-center gap-2">
                {!m.connected ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={isBusy}
                    disabled={busy !== null && !isBusy}
                    aria-label={`${connectLabel} ${name}`}
                    onClick={() => onConnect && run(m.id, onConnect(m.id))}
                  >
                    {connectLabel}
                  </Button>
                ) : isConfirming ? (
                  <>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      {cancelLabel}
                    </Button>
                    <Button
                      ref={confirmRef}
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => onDisconnect && run(m.id, onDisconnect(m.id))}
                    >
                      {confirmLabel}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={isBusy}
                    disabled={isLocked || (busy !== null && !isBusy)}
                    aria-label={`${disconnectLabel} ${name}`}
                    aria-describedby={isLocked ? hintId : undefined}
                    onClick={() => setConfirming(m.id)}
                  >
                    {disconnectLabel}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {locked && connectedCount === 1 ? (
        <p id={hintId} data-slot="sign-in-methods-hint" className="text-muted-foreground mt-2 text-sm">
          {lastMethodHint}
        </p>
      ) : null}
    </>
  );
}

export { SignInMethods };
export type { SignInMethodsProps };
