# Spec: AccountMenu

Status: review; built 2026-11-27 under the owner's waiver of the Design→Build gate for specs built the same day (see "What changed in the build" at the end). Intent: [intent.md](./intent.md).
Floor: the 26 rules of `interlace-component`; rule ids are cited where a decision is theirs.
Read against `whylikedis` `origin/main` 8577271 and `interlace` `origin/main` d51ab18d on 2026-11-27.

## 1. Local code this replaces (whylikedis, `apps/site/`)

| File | Size | Becomes |
| --- | --- | --- |
| `components/account-button.tsx` (`AccountButton`: session read, profile read, three states, menu, sign-out) | 4.3 KB | `AccountMenu` + `useAccount`; the app's adapter is the Supabase half |
| `lib/profile.ts` (`Profile`, `displayName`, `initials`) | 0.9 KB | `accountDisplayName`, `accountInitials` |
| `lib/supabase/config.ts` lines 44-52 (`safeNext`) | 9 lines | `safeReturnPath` |
| `app/account/account-view.tsx` imports `initials` | 1 import | `accountInitials` |
| `app/sign-in/sign-in-panel.tsx` calls `safeNext` | 1 call | `safeReturnPath` |
| `app/auth/callback/route.ts` and any other caller of `safeNext` | 0-2 calls | `safeReturnPath` |
| `lib/supabase/safe-next.ts` and its test (#111) | the helper and 22 cases | deleted; the table moves into the kit's model test |

Stays in the app: the Supabase client and `supabaseLater`, the `profiles` query, the account page,
the sign-in panel, `nav.tsx` (which swaps the import of `AccountButton` for a wrapper of about
twenty lines that builds the adapter and passes `state` to `AccountMenu`).

## 2. Files

| File (in `packages/ui/src/patterns/`) | What | Environment |
| --- | --- | --- |
| `account-menu-model.ts` | Pure: `Account`, `AccountState`, `accountDisplayName`, `accountInitials`, `signInHref`, `safeReturnPath`, `reduceAccount` (state transitions for the hook). No DOM, no `window`, no storage. | any |
| `account-menu.tsx` | `AccountMenu`. `'use client'`. | browser |
| `use-account.ts` | `useAccount(adapter)`. `'use client'`. | browser |

Registry item `account-menu`; `registryDependencies`: `avatar`, `button`, `dropdown-menu`,
`visually-hidden`. No npm dependency. A changeset (minor) and the `versions:derive` entry are part
of the build. The wrapper for a router link goes through the `renderLink` seam the other
navigation patterns use, so the kit imports no router.

## 3. API

```ts
export interface Account {
  /** Opaque to the kit. Used only as a React key and a `data-account-id`. */
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  imageUrl?: string | null;
}

export type AccountState =
  | { status: 'unknown' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; account: Account };

export interface AccountMenuLink {
  label: string;              // 'Your account'
  href: string;
  icon?: React.ReactNode;
}

export interface AccountMenuLabels {
  signIn: string;                              // 'Sign in'
  signOut: string;                             // 'Sign out'
  signingOut: string;                          // 'Signing out…'
  signOutFailed: string;                       // 'We could not sign you out. Try again.'
  menu: (name: string) => string;              // (n) => `Account menu for ${n}`
  fallbackName: string;                        // 'Your account'
}

export interface AccountMenuProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  state: AccountState;
  /** The sign-in page. The current page is added as `?next=` unless `here` is the sign-in page. */
  signInHref: string;
  /** The page the person is on, a path. Used to build `?next=`. */
  here?: string;
  /** Links between the header and Sign out. */
  links?: readonly AccountMenuLink[];
  /** May return a promise. A rejection is shown (see §5) and passed to `onError`. */
  onSignOut: () => void | Promise<void>;
  onError?: (error: unknown) => void;
  /** Same seam as Topbar: a router's Link. */
  renderLink?: (props: { href: string; className?: string; children: React.ReactNode } & Record<string, unknown>) => React.ReactNode;
  labels?: Partial<AccountMenuLabels>;
}

export interface AccountAdapter {
  /** The current account or null. Called once on mount. */
  read(): Account | null | Promise<Account | null>;
  /** Later changes: sign in, sign out, a better profile. Returns the unsubscribe. */
  subscribe?(onChange: (account: Account | null) => void): () => void;
}
export function useAccount(adapter: AccountAdapter | null): AccountState;

export function accountDisplayName(account: Pick<Account, 'firstName' | 'email'> | null, fallback?: string): string;
export function accountInitials(account: Pick<Account, 'firstName' | 'lastName' | 'email'> | null): string;
export function signInHref(signIn: string, here?: string): string;
export function safeReturnPath(next: string | null | undefined, fallback?: string): string;
export function reduceAccount(state: AccountState, event: AccountEvent): AccountState;
```

`useAccount(null)` returns `{ status: 'unknown' }` forever; an app that has accounts switched off
renders nothing instead of `AccountMenu` (the site's `AUTH_ENABLED` check stays the app's).

## 4. Model behaviour (pure, in `account-menu-model.ts`)

### 4.1 `accountDisplayName`

First non-blank `firstName` after trim; else the part of `email` before the first `@`
(`'dana@example.com'` gives `'dana'`; an email with no `@` gives the whole string); else
`fallback` (default `'Your account'`). A `firstName` of only whitespace is blank. The result is
never an empty string.

### 4.2 `accountInitials`

Up to two grapheme clusters, in order: first grapheme of `firstName`, then of `lastName`
(`Intl.Segmenter` when present, `Array.from` otherwise, so an emoji or a combining mark is not cut in
half); if neither exists, the first grapheme of `email`; if none, `'?'`. Uppercased with
`toLocaleUpperCase()` (scripts with no case are unchanged: Hebrew, Arabic, Han). Blank strings are
absent. Whitespace is trimmed first.

### 4.3 `signInHref(signIn, here)`

`signIn` unchanged when `here` is absent, empty, or equals `signIn` after trailing-slash
normalisation (`'/sign-in'` and `'/sign-in/'` are the same page). Otherwise
`${signIn}?next=${encodeURIComponent(safeReturnPath(here))}`, with `&next=` when `signIn` already
has a query. A `here` that fails `safeReturnPath` is omitted, not encoded.

### 4.4 `safeReturnPath(next, fallback = '/')`

Returns `next` only when all hold, else `fallback`. The rules are those of the `safeNext` the site
shipped in whylikedis #111 (`apps/site/lib/supabase/safe-next.ts`), plus a length limit:

1. It is a string, non-empty, at most 2048 characters (the one addition).
2. It starts with `/`, and the second character is not `/` or `\`.
3. It contains no whitespace (the regular expression's `\s`: tab, newline, carriage return, space,
   no-break space, U+2028, U+2029, byte order mark and the other Unicode spaces), no C0 control
   character, no DEL and no backslash, anywhere.
4. Parsed with `new URL(next, 'http://return.invalid')`, its origin is that origin.

An encoded slash is allowed: `/%2F%2Fevil.com` is a path on this site, because a browser does not
decode `%2F` before it resolves an address, so it can never become `//`. It is kept as given and
documented. (An earlier draft of this spec decoded once and refused `%09`, `%0a`, `%5C` and `%2F`;
the owner chose #111's semantics instead, so the kit and the site agree. A reader that decodes the
path itself owns that second step and runs `safeReturnPath` on the decoded value as well.)

`fallback` is not checked (it is the app's own constant). The function never throws.

### 4.5 `reduceAccount(state, event)`

Events: `read(account | null)`, `change(account | null)` and `reset`.

| From | Event | To |
| --- | --- | --- |
| `unknown` | `read(null)` | `signed-out` |
| `unknown` | `read(account)` | `signed-in` |
| any | `change(null)` | `signed-out` |
| any | `change(account)` | `signed-in` (an equal account returns the same object, so nothing re-renders) |
| `signed-in` or `signed-out` | `read(...)` | unchanged (a late `read` never overwrites a newer `change`) |
| any | `reset` | `unknown` (the hook's adapter was swapped or removed) |

### 4.6 `useAccount`

On mount, call `adapter.read()` (sync or promise); subscribe if `adapter.subscribe` exists; unmount
cancels: a promise that settles after unmount is ignored and the unsubscribe is called. A `read`
that rejects becomes `signed-out` and calls nothing else (an app that wants it reported wraps its
adapter). An adapter that changes identity between renders resubscribes. The hook never touches
`window`, `document` or storage; first render is `unknown`, so the server markup equals the first
client render.

## 5. Anatomy and states of `AccountMenu`

```
AccountMenu                    (div, data-slot="account-menu", data-state, min-inline-size = Sign in)
  unknown      └─ span         (aria-hidden, inert, invisible; the size of the Sign in button)
  signed-out   └─ a            (href = signInHref(...), buttonVariants outline sm)
  signed-in    └─ DropdownMenu
                  ├─ Trigger   (button, aria-label = labels.menu(name), rounded-full)
                  │    └─ Avatar size-9: AvatarImage (alt="", no-referrer) | AvatarFallback (aria-hidden: initials)
                  └─ Content   (align end, min-w-56)
                       ├─ Label    (name; email, muted, when present)   ← not a menu item
                       ├─ Separator
                       ├─ Item × links   (render as a link through renderLink)
                       └─ Item  Sign out
```

| State | What it shows and does |
| --- | --- |
| `unknown` | The invisible, inert placeholder. Not in the accessibility tree, not in tab order. `data-state="unknown"`. |
| `signed-out` | "Sign in" link. `data-state="signed-out"`. |
| `signed-in`, closed | Avatar button. `aria-haspopup="menu"`, `aria-expanded="false"`. |
| `signed-in`, open | Menu with the header, links, Sign out. Escape closes and returns focus to the trigger. |
| Image fails to load | The fallback initials show (Avatar's behaviour); no broken-image icon. |
| No name and no email | Name is `labels.fallbackName`; initials `?`. |
| Signing out | The Sign out item is disabled and reads `signingOut`; the menu stays open until it settles, then closes. |
| Sign out rejects | The menu closes, focus returns to the trigger, a polite live region (visually hidden, always mounted) says `signOutFailed`, `onError(error)` is called. The state stays `signed-in` (the adapter decides). |
| Long name or email | Truncates with an ellipsis inside the menu header; full text in `title`. The trigger shows no text. |
| Narrow (320 px) | Same control; the menu is `max-w-[calc(100vw-2rem)]`. |
| RTL | `align="end"` follows direction; logical properties only. |
| No JavaScript | The server renders the `unknown` placeholder. A page that wants a link without JavaScript renders its own `<noscript>` Sign in link beside it; documented, not built in (the session is read in the browser). |

**The bar does not move.** The root has `min-inline-size` equal to the Sign in button's measured
width (a CSS custom property `--account-menu-room`, defaulting to the `sm` outline button's width
at the default `labels.signIn`; an app with a longer label sets it). Content is aligned to the end
of the root, so signed-in (36 px avatar) sits where Sign in's right edge was.

## 6. Interaction and accessibility contract

- **Trigger name.** "Account menu for Dana" (`labels.menu(name)`), role button, announced as
  collapsed/expanded by the menu primitive. The avatar image has `alt=""`; the initials are
  `aria-hidden`: the name carries the label. Sign in and Sign out are named by their visible text
  (Label in Name, WCAG 2.5.3; see `wordmark-label-in-name` for the logo case).
- **Keyboard.** Enter, Space or ArrowDown opens; arrows move; Home and End jump; Escape closes;
  typeahead is the primitive's. Tab leaves the menu (the primitive's rule). Focus is visible
  (the system's 2 px ring with its offset, `focus-visible`), never `outline-none` alone.
- **Header is not an item.** The name and email are a `DropdownMenuLabel`, so arrows skip them and
  they are read as the menu's heading.
- **Target size.** The trigger is 36 px visible with a 44 px hit area (padding, not margin), so it
  meets 2.5.8 (24 px) at minimum and the touch-target lock at 44.
- **Live region.** One always-mounted polite region for `signOutFailed`; empty at rest, so
  nothing is announced on load.
- **Privacy.** The image sets `referrerPolicy="no-referrer"`; `imageUrl` is not logged or
  placed in a URL; the email appears only in the open menu and in a `title` on it.
- **Contrast.** Tokens only (R19): `text-muted-foreground` for the email; covered by the composite
  contrast lock once the component is added to its list (build agent step).
- **Motion.** The menu uses the primitive's enter/exit, which already respects reduced motion.
  The component adds none: no fade between `unknown` and the resolved state (a fade on a control
  in the first viewport is the class of defect whylikedis #106 fixed). Static projection:
  the three states are three static pictures, and `data-state` names each.
- **RTL and i18n.** Every string is a `labels` entry; the name is shown as given, never
  reordered; `dir="auto"` on the name and email spans.

## 7. Test plan

Rule: a feature is not done until a check would have caught it, **and the check was shown failing
on the broken state.**

### 7.1 Pure model (`__tests__/account-menu-model.test.ts`, in the coverage glob at 100)

- `accountDisplayName`: first name; first name with spaces; blank first name falls to email;
  email with no `@`; no email falls to the fallback; never empty.
- `accountInitials`: two names; first only; last only; Hebrew (`'דנה'`, `'לוי'`); Arabic; Han (one
  grapheme each); `'Åsa'`; an emoji first name (one grapheme, not half a surrogate pair); a
  combining mark (`'é'`) kept whole; lowercase email fallback uppercased; blank everything
  is `'?'`; whitespace trimmed.
- `signInHref`: no `here`; `here` equal to the sign-in page with and without a trailing slash;
  ordinary path with query and hash encoded; `signIn` with an existing query uses `&`; a hostile
  `here` is omitted.
- `safeReturnPath`, a table of at least thirty hostile rows, and the allowed rows. The first 22
  cases are the table of whylikedis #111 (17 refusals, 4 kept, and the encoded double slash, kept
  and documented). Must return `next`: `'/'`, `'/ok/path?x=1#y'`, `'/account/'`,
  `'/sign-in/?next=/account/'`, `'/a/b'`, `'/caf%C3%A9'`, a 2048-character path, `'/%09/a'`,
  `'/%2F%2Fevil.com'`, `'/%2f%2fevil.com'`, `'/%5Cevil.com'`, `'/a@evil.com'`. Must return the
  fallback: `'//evil.com'`, `'/\\evil.com'`, `'/\t/evil.com'`, `'/\n/evil.com'`, `'/\r/evil.com'`,
  `'/\u0000/evil.com'`, a vertical tab, a form feed, DEL, U+2028, U+2029, a no-break space, a byte
  order mark and an ideographic space between the slashes, `'https://evil.com'`,
  `'javascript:alert(1)'`, `'data:text/html,x'`, `'evil.com'`, `''`, `null`, `undefined`, `123`,
  a 2049-character path, `' /a'`, `'/a\\b'`. Plus a property test: for 5000 seeded random strings
  from an alphabet of `/`, `\`, tab, newline, `%`, hex digits, letters, `.`, `@`, `:`, `?`, `#`
  and a no-break space, the result is either the fallback or a string whose
  `new URL(result, 'http://return.invalid').origin` is `'http://return.invalid'`.
- `reduceAccount`: every row of the §4.5 table; a late `read` after `change` is ignored; an equal
  account is the same object (referential equality).

### 7.2 Hook (`__tests__/use-account.test.tsx`, fake adapter)

First render `unknown`; sync adapter resolves to `signed-in` after mount; promise adapter; `read`
rejecting becomes `signed-out`; `subscribe` change updates; unmount unsubscribes and a late promise
is ignored; adapter identity change resubscribes; `useAccount(null)` stays `unknown`; no `window`
access during render (server render of the hook's component equals first client render).

### 7.3 Component (`__tests__/account-menu.test.tsx`)

- `unknown`: no role in the tree, not focusable (Tab skips), `aria-hidden` and `inert` present,
  `data-state`.
- `signed-out`: link name "Sign in"; href with `next`; no `next` on the sign-in page.
- `signed-in`: trigger name "Account menu for Dana"; avatar `alt=""`; initials `aria-hidden`;
  image has `referrerPolicy="no-referrer"`; opens by Enter, Space and ArrowDown; header is not a
  menu item (arrow skips it); links render through `renderLink`; Escape returns focus to the
  trigger.
- Sign out: pending disables the item and shows `signingOut`; resolves and closes; rejects, closes,
  focuses the trigger, fills the live region, calls `onError`; double activation calls once.
- State changes: `signed-out` to `signed-in` keeps the root's width (measured in jsdom with a stubbed
  layout: the root's inline `min-inline-size` custom property is the same in all three states).
- Axe (jest-axe) on each of the five states finds nothing.

### 7.4 Browser stories as tests (existing storybook job)

`Unknown`, `SignedOut`, `SignedIn`, `SignedInNoPhoto`, `SignedInHebrewName`, `MenuOpen`,
`SigningOut`, `SignOutFailed`, `LongEmail`, `InTopbar` (inside `Topbar`'s `actions`), `Mobile320`,
`Rtl`, `HighContrast`, `TextSize150`. A play function on `InTopbar` records the `left` of the
control to the logo's right across the three states and asserts it is identical (this is the
check that is red on the old reserve-only-Sign-in rule).

### 7.5 Deliberate-break proofs (each shown red before the fix is kept)

| Break (done by hand, then reverted) | Test that must fail |
| --- | --- |
| `safeReturnPath` falls back to a prefix check (`startsWith('/')` and not `//`, not `/\`) | the tab, newline, carriage return, NUL, vertical tab, form feed, DEL, U+2028, U+2029, no-break space, byte order mark and ideographic-space rows |
| `safeReturnPath` drops step 3 (whitespace, control characters and backslash) | the same rows, and `'/ok\\evil.com'`, `'/x '`, `'/x\u0001y'` (a backslash later in the path; the parser reads a backslash as a slash) |
| `safeReturnPath` drops step 2's second-character test | `'//evil.com'`, `'//'`, `'//a/b'` and `'/\\evil.com'` |
| `safeReturnPath` drops the length limit | the 2049-character row |
| `safeReturnPath` drops step 4 (origin check) | none: after steps 1 to 3 the parser cannot change the origin, so this is an equivalent mutant, recorded as such and kept as defence in depth; the property test would catch a gap in steps 1 to 3 that made it reachable |
| `accountInitials` uses `s[0]` | the emoji and combining-mark rows |
| `accountInitials` does not trim | the whitespace row |
| `accountDisplayName` treats `'  '` as a name | the blank-first-name row |
| `signInHref` always adds `next` | the sign-in-page row |
| `reduceAccount` lets a late `read` overwrite `change` | the late-read row |
| `useAccount` does not unsubscribe on unmount | the unsubscribe case (listener count) |
| `useAccount` sets state after unmount | the late-promise case (act warning is a failure) |
| `unknown` renders the Sign in button instead of a placeholder | the not-in-tree and not-focusable cases |
| `unknown` loses `inert` | the Tab-skips case |
| Root has no `min-inline-size` | the `InTopbar` play function (neighbour moves) |
| Avatar image drops `referrerPolicy` | the attribute case |
| Sign out rejection swallowed | the live-region and `onError` cases |
| Header rendered as `DropdownMenuItem` | the arrow-skips-header case |
| Initials not `aria-hidden` | axe plus the accessible-name case |

Plus the mutation lane (see `mutation-testing-room-logic`): `account-menu-model.ts` joins its scope
the day it merges.

## 8. Stories and docs

`apps/storybook/src/stories/blocks/AccountMenu.stories.tsx` (`stories/blocks/` is where the pattern-story lock looks) (`Meta<typeof AccountMenu>`) with the
list above. The docs page carries three ten-line adapters, all marked as the app's code: Supabase
(`getSession`, `onAuthStateChange`, an optional `profiles` read that emits twice), Auth.js
(`getSession`, the session event), and a cookie-only app. It also carries the `safeReturnPath`
table of hostile inputs and the sentence "use it on the reading side too, not only when you build
the link".

## 9. Performance and size

- The model has no React import. The component is one client file; the menu primitive is already
  in the registry item graph. The auth library stays the adapter's: the docs show the lazy
  `import()` the site uses (`supabaseLater`) so the library (about 70 kB of script in the site's
  case, per its own comment) is not in the first load.
- CLS 0 by construction (§5); the story proves it.
- Budgets, **recorded at first build, then ratcheted**: gzip size of model and component. No
  number appears in docs before it is measured, with command and date.

## Out of scope

Sign-in forms, providers and OTP. The account page. Profile reading and caching. Server-side
sessions. Remembering the last-used sign-in method. Multiple accounts, organisations, roles. A
notifications bell. Presence dots. A guest state. A modal "are you sure" on Sign out.

## 10. Open questions, each with the default the build agent takes

| Question | Default |
| --- | --- |
| Is `here` read from the router by the component? | No. The app passes it; the kit imports no router. |
| Does the menu header show the email? | Yes, when present, muted; an app that does not want it omits `email` from the `Account` it passes. |
| `Intl.Segmenter` where missing (older runtimes)? | `Array.from` fallback, same tests, documented as less exact for ZWJ sequences. |
| Reserve room by CSS custom property or by measuring? | Custom property with a default; measuring needs layout and makes the server markup differ. |
| Should `safeReturnPath` live in `lib/` so non-React code can import it? | Yes: `lib/return-path.ts` re-exported from the model; the build agent splits it if the registry item graph needs it. |
| Call the sign-out through a `<form>` for no-JS? | No: the session is read in the browser, so there is no no-JS signed-in state. |

## 11. What changed in the build

Recorded 2026-11-27, so the next reader finds the differences from the draft in one place.

- **`safeReturnPath` follows whylikedis #111**, not the draft's step 4 (decode once): an encoded
  slash is allowed and documented, and any whitespace, including a no-break space, is refused.
  The draft's table rows `'/%09/evil.com'`, `'/%2F/evil.com'`, `'/%5Cevil.com'`, `'/%2f%2fevil.com'`
  and the no-break-space and soft-hyphen "kept" rows are therefore inverted or moved (§4.4, §7.1).
  The 2048-character limit is the only addition. The "red on a prefix-only implementation" claim
  holds for the rows a prefix check lets through, not for every row (`'//evil.com'` is refused by
  both); the intent's success criterion says so.
- **`reduceAccount` has a third event, `reset`,** so a swapped or removed adapter goes back to
  `unknown` and its first `read` counts. A `read` is ignored whenever anything is known, signed out
  as well as signed in.
- **`renderLink` returns an element** (as `Topbar`'s does) and receives `data-slot` so the part keeps
  its slot. It is used for Sign in and for the menu's links.
- **The hook's adapter must be stable** (module scope or `useMemo`): a new object each render is a
  new subscription and a fresh `unknown`.
- **`--account-menu-room` defaults to 4.5rem (72 px)**; the outline small Sign in button at the
  default label measures 70.6 px in the built Storybook (2026-11-27), and the root is 72 px wide in
  all three states with the neighbour at the same `left` (§5). The registry item ships `use-account` and the model as part of
  `account-menu` (the component re-exports the hook).
- **Visuals:** the trigger's hit area is 44 px by a pseudo-element, so the layout stays 36 px.
- **Floors:** `account-menu-model.ts` is in the mutation floor file with `null` floors, like every
  model before the first full nightly run measures them.
- **Break proofs (§7.5), run by hand on 2026-11-27.** Red: prefix-only check (15 rows), no whitespace/control/
  backslash rule (12), no second-character test (2: the origin check catches `//evil.com` too, so
  the two are defence in depth for each other), no length limit (1), `s[0]` initials (2), no trim
  (5), `next` always added (1), late `read` overwriting (1), no unsubscribe (2), unknown renders
  Sign in (2), no `inert` (1), no `min-inline-size` (2), no `referrerPolicy` (1), swallowed rejection
  (3), initials not `aria-hidden` (1). Survived, equivalent: the origin check (steps 1 to 3 already
  keep the origin), and the `live` guard on a read that settles after unmount (React 19 does not
  warn on a state update after unmount, so there is nothing to observe; the guard stays).
