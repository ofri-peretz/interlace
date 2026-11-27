'use client';

/**
 * @interlace/ui — AccountMenu
 *
 * The account control at the right end of a `Topbar`'s `actions` slot, for any sign-in service.
 * It has the three states every app with accounts has:
 *
 * 1. **Unknown.** The browser has not read the session yet. The control keeps exactly the room
 *    the answer will take, shows nothing, says nothing and cannot be focused.
 * 2. **Signed out.** A "Sign in" link that carries the page the person is on (`?next=`), and
 *    does not when they are already on the sign-in page.
 * 3. **Signed in.** Their photo, or their initials when there is none, as a menu button named
 *    "Account menu for Dana". The menu opens on a header (name and email), then the app's links,
 *    then "Sign out", which may take a moment and may fail.
 *
 * The component is a function of its props: it takes `state`. `useAccount(adapter)` builds that
 * state from the app's own service (Supabase, Auth.js, Clerk, a cookie), and the kit never reads
 * or writes a session. The pure helpers beside it (`accountDisplayName`, `accountInitials`,
 * `signInHref`, `safeReturnPath`) are in `account-menu-model`.
 *
 * ## The bar does not move
 *
 * The root keeps a minimum inline size, `--account-menu-room`, the width of the Sign in button at
 * its default label, and aligns its content to the end. So the neighbour to its left sits in the
 * same place in all three states, and the avatar (narrower) lands where Sign in's right edge was.
 * An app with a longer label sets the property. There is no fade between the states: a control
 * in the first viewport that fades in is a layout and paint cost for nothing.
 *
 * ## Flow
 *
 * A flow (docs/philosophies/FLOW_PHILOSOPHY.md) with one part: the app drives every phase through
 * `state` (usually from `useAccount`), so there is nothing to compose.
 *
 * | Phase       | Part                                         | Leaves by                                        |
 * | ----------- | -------------------------------------------- | ------------------------------------------------ |
 * | unknown     | AccountMenu, an inert placeholder            | the adapter answers → signed-out or signed-in    |
 * | signed-out  | AccountMenu, the Sign in link                | the person signs in (the app's page) → signed-in |
 * | signed-in   | AccountMenu, the avatar and its menu         | Sign out → signing-out                           |
 * | signing-out | AccountMenu, Sign out disabled, "Signing out…" | the promise settles → signed-out, or failed   |
 * | failed      | AccountMenu, a polite live region, `onError` | the person tries again → signing-out             |
 *
 * ## Anatomy
 *
 *   AccountMenu                    (div — data-slot="account-menu", data-state, min inline size = --account-menu-room)
 *     ├─ span                      (unknown: data-slot="account-menu-placeholder", aria-hidden, inert, invisible)
 *     ├─ a                         (signed-out: data-slot="account-menu-sign-in", buttonVariants outline sm)
 *     └─ DropdownMenu              (signed-in)
 *         ├─ Trigger               (data-slot="account-menu-trigger", aria-label = labels.menu(name), round)
 *         │   └─ Avatar            (image alt="", no-referrer, or initials aria-hidden)
 *         ├─ Content               (align end)
 *         │   ├─ Label             (name and email: a heading, not an item)
 *         │   ├─ Separator
 *         │   ├─ Item × links      (data-slot="account-menu-link", through `renderLink`)
 *         │   └─ Item              (data-slot="account-menu-sign-out")
 *         └─ span role=status      (data-slot="account-menu-live", visually hidden, polite)
 *
 * ## States
 *
 * Unknown, signed out, signed in (closed, open), image failed (initials show), no name and no
 * email (the fallback name, `?`), signing out, sign-out failed, long name or email (truncated,
 * full text in `title`), 320 px, RTL. Without JavaScript the server renders the unknown
 * placeholder: the session is read in the browser. A page that wants a Sign in link without
 * JavaScript renders its own `<noscript>` link beside this.
 *
 * ## Source of the API
 *
 * The slot and the three states are what apps with accounts write at the end of a header; the
 * adapter's `{ read, subscribe }` is the smallest shape that both a `getSession` plus
 * `onAuthStateChange` pair and an Auth.js `getSession` plus session event fit. It diverges from
 * those libraries on purpose: it names none of them.
 *
 * | Rule | Concept                  | Where                                                      |
 * | ---- | ------------------------ | ---------------------------------------------------------- |
 * | R6   | data-slot per part       | every part above                                           |
 * | R14  | declares a min viewport  | `MIN_VIEWPORT` on the root (`data-min-viewport`)           |
 * | R19  | tokens only              | `text-muted-foreground`, `ring-ring`, `size-control`       |
 * | R25  | client component         | the menu primitive and the live region need the browser    |
 * | R26  | A11y                     | named trigger, header is not an item, polite live region   |
 */
import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Avatar, AvatarFallback, AvatarImage } from '../primitives/avatar.js';
import { buttonVariants } from '../primitives/button-variants.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu.js';
import { VisuallyHidden } from '../primitives/visually-hidden.js';
import {
  accountDisplayName,
  accountInitials,
  DEFAULT_FALLBACK_NAME,
  signInHref as buildSignInHref,
  type Account,
  type AccountState,
} from './account-menu-model.js';

export { useAccount, type AccountAdapter } from './use-account.js';
export type { Account, AccountState };

export const MIN_VIEWPORT = 320 as const;

/**
 * The width of the Sign in button at its default label: its 12px padding twice, its border twice
 * and the word. An app with a longer label sets `--account-menu-room` on the control or above it.
 */
const DEFAULT_ROOM = '4.5rem';

export interface AccountMenuLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export interface AccountMenuLabels {
  signIn: string;
  signOut: string;
  signingOut: string;
  signOutFailed: string;
  /** The trigger's accessible name, given the display name. */
  menu: (name: string) => string;
  /** What to call a person with no name and no email. */
  fallbackName: string;
}

export interface AccountMenuLinkRenderProps {
  href: string;
  className?: string;
  /** Put this on the element you return, so the part keeps its `data-slot`. */
  'data-slot'?: string;
  children: React.ReactNode;
}

export interface AccountMenuProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  state: AccountState;
  /** The sign-in page. The current page is added as `?next=` unless `here` is the sign-in page. */
  signInHref: string;
  /** The page the person is on, a path. Used to build `?next=`. Read from your router, not here. */
  here?: string;
  /** Links between the header and Sign out. */
  links?: readonly AccountMenuLink[];
  /** May return a promise. A rejection is shown (a polite message) and passed to `onError`. */
  onSignOut: () => void | Promise<void>;
  onError?: (error: unknown) => void;
  /** The same seam as `Topbar`: a router's Link. Defaults to a plain `<a>`. */
  renderLink?: (props: AccountMenuLinkRenderProps) => React.ReactElement;
  labels?: Partial<AccountMenuLabels>;
}

export const DEFAULT_LABELS: AccountMenuLabels = {
  signIn: 'Sign in',
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  signOutFailed: 'We could not sign you out. Try again.',
  menu: (name) => `Account menu for ${name}`,
  fallbackName: DEFAULT_FALLBACK_NAME,
};

const defaultRenderLink: NonNullable<AccountMenuProps['renderLink']> = ({ href, className, children, ...rest }) => (
  <a href={href} className={className} {...rest}>
    {children}
  </a>
);

const SIGN_IN_CLASS = buttonVariants({ variant: 'outline', size: 'sm' });

function AccountMenu({
  state,
  signInHref,
  here,
  links = [],
  onSignOut,
  onError,
  renderLink = defaultRenderLink,
  labels: labelOverrides,
  className,
  style,
  ...props
}: AccountMenuProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const busy = React.useRef(false);
  const trigger = React.useRef<HTMLButtonElement>(null);

  async function signOut() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onSignOut();
      setOpen(false);
    } catch (error) {
      setOpen(false);
      setFailed(true);
      onError?.(error);
      trigger.current?.focus();
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div
      data-slot="account-menu"
      data-state={state.status}
      data-account-id={state.status === 'signed-in' ? state.account.id : undefined}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex min-h-control items-center justify-end', className)}
      style={{ minInlineSize: `var(--account-menu-room, ${DEFAULT_ROOM})`, ...style }}
      {...props}
    >
      {state.status === 'unknown' ? (
        <span
          data-slot="account-menu-placeholder"
          aria-hidden="true"
          inert
          className="invisible block h-control-sm min-w-full"
        />
      ) : null}
      {state.status === 'signed-out'
        ? renderLink({
            href: buildSignInHref(signInHref, here),
            className: SIGN_IN_CLASS,
            'data-slot': 'account-menu-sign-in',
            children: labels.signIn,
          })
        : null}
      {state.status === 'signed-in' ? (
        <SignedIn
          account={state.account}
          labels={labels}
          links={links}
          renderLink={renderLink}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setFailed(false);
          }}
          pending={pending}
          failed={failed}
          onSignOut={signOut}
          triggerRef={trigger}
        />
      ) : null}
    </div>
  );
}
AccountMenu.displayName = 'AccountMenu';

interface SignedInProps {
  account: Account;
  labels: AccountMenuLabels;
  links: readonly AccountMenuLink[];
  renderLink: NonNullable<AccountMenuProps['renderLink']>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  failed: boolean;
  onSignOut: () => void;
  triggerRef: React.Ref<HTMLButtonElement>;
}

function SignedIn({
  account,
  labels,
  links,
  renderLink,
  open,
  onOpenChange,
  pending,
  failed,
  onSignOut,
  triggerRef,
}: SignedInProps) {
  const name = accountDisplayName(account, labels.fallbackName);
  const email = account.email?.trim();
  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          ref={triggerRef}
          data-slot="account-menu-trigger"
          aria-label={labels.menu(name)}
          className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background after:absolute after:-inset-1 after:rounded-full after:content-['']"
        >
          <Avatar className="size-control">
            {account.imageUrl ? <AvatarImage src={account.imageUrl} alt="" referrerPolicy="no-referrer" /> : null}
            <AvatarFallback aria-hidden="true">{accountInitials(account)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)] min-w-56">
          <DropdownMenuLabel data-slot="account-menu-header">
            <span dir="auto" title={name} className="block truncate font-medium">
              {name}
            </span>
            {email ? (
              <span dir="auto" title={email} className="block truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {links.map((link) => (
            <MenuLink key={link.href} link={link} renderLink={renderLink} />
          ))}
          <DropdownMenuItem
            data-slot="account-menu-sign-out"
            closeOnClick={false}
            disabled={pending}
            onClick={onSignOut}
          >
            {pending ? labels.signingOut : labels.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <VisuallyHidden role="status" aria-live="polite" data-slot="account-menu-live">
        {failed ? labels.signOutFailed : ''}
      </VisuallyHidden>
    </>
  );
}

function MenuLink({ link, renderLink }: { link: AccountMenuLink; renderLink: NonNullable<AccountMenuProps['renderLink']> }) {
  const content = (
    <>
      {link.icon}
      {link.label}
    </>
  );
  return (
    <DropdownMenuItem data-slot="account-menu-link" render={renderLink({ href: link.href, children: content })}>
      {content}
    </DropdownMenuItem>
  );
}

export { AccountMenu };
