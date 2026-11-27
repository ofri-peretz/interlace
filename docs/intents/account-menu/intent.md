# Intent — the account control at the end of a top bar, for any app, with any sign-in service, that never moves the bar

**Status:** review · written 2026-11-27 from a read of the WhyLikeDIs site (`whylikedis` `origin/main`
8577271: `apps/site/components/account-button.tsx`, `lib/profile.ts`, `lib/supabase/config.ts`). A human
accepts at Design→Build; for this one the owner waived that gate for specs built the same day. Lives at
`docs/intents/account-menu/intent.md` with `spec.md` beside it.

## What is wanted

One pattern, `AccountMenu`, for the right end of a `Topbar`'s `actions` slot, in the three states
every app with accounts has:

1. **Unknown.** The browser has not yet read the session. The control reserves exactly the room the
   answer will take, shows nothing and says nothing, and cannot be focused. The bar does not move
   when the answer arrives.
2. **Signed out.** A "Sign in" link that carries the page the person is on, so they come back to it
   (`?next=`), and does not carry it when they are already on the sign-in page.
3. **Signed in.** Their photo, or their initials when there is none, as a menu button named
   "Account menu for Dana". The menu opens on a header (name and email), then the app's links
   ("Your account"), then "Sign out", which may take a moment and may fail.

Plus the three small pure functions every app writes beside it, in one tested file:

- `accountDisplayName` and `accountInitials`: a name to greet someone by (first name, else the
  start of the email, else a plain label) and up to two letters for an avatar with no photo, correct
  for names that are not Latin, not one code unit per letter, and not always two words.
- `signInHref(base, here)`: the sign-in address with a safe `?next=`.
- `safeReturnPath(next, fallback)`: the other side of it. Only a path on this site comes back out,
  for any input, including the ones a browser rewrites.

And one hook, `useAccount(adapter)`, that turns the app's own sign-in service into the state above
(`unknown`, then `signed-out` or `signed-in`) with a subscription, a cleanup, and no flash of
the wrong state. The service is the app's: Supabase, Auth.js, Clerk, a cookie. Nothing in the
kit names one.

Neutral, per the registry's rules: no product's name, copy or colours; every string is a `labels`
entry with a plain default.

## Why now

- The WhyLikeDIs site wrote it locally: `components/account-button.tsx` (4.3 KB), `lib/profile.ts`
  (0.9 KB, `displayName` and `initials`), and `safeNext` (nine lines in `lib/supabase/config.ts`).
  Every part but the Supabase calls is generic.
- Interlace has every piece but the assembly. `Topbar`, `Avatar`, `DropdownMenu`, `SignInForm`,
  `SignInMethods` and `SocialSignIn` exist; the account control that sits in the bar and ties them
  to a session does not (a search of `origin/main`, 2026-11-27, finds no `AccountMenu`, `UserMenu`
  or `useSession`). Every app using `Topbar` and having accounts writes it.
- **Written by hand, `safeNext` had a hole.** The first version refused `//host` and `/\host` and
  accepted the rest of anything starting with a slash: `safeNext('/\t/evil.com')` came back
  unchanged, and the URL parser a browser uses drops the tab and reads it as `//evil.com`
  (`new URL('/\t/evil.com', 'http://x.invalid').host` is `evil.com`, checked on 2026-11-27). The
  site closed it the same day (whylikedis #111, `apps/site/lib/supabase/safe-next.ts`: refuse
  whitespace, control characters and backslashes anywhere, then parse and require the same origin,
  with a 22-case test). The point for the kit is that this helper is written by hand in every
  app, and a tested one belongs here. `safeReturnPath` has #111's semantics, and its test table.
- Principle 5: the control has a keyboard path, a screen-reader name and a no-JavaScript
  projection, and the unknown state is where apps usually fail all three (a button that is
  focusable and says nothing, or a bar that jumps).

## Constraints

- **The bar does not move.** The slot's width is the same in all three states (the larger of the
  Sign in button and the avatar button, which is the Sign in button), with the content aligned to
  the end. A test measures the bounding box of the neighbour to its left across the states.
- **The unknown state is inert.** `aria-hidden`, `inert`, `invisible`: nothing is announced,
  focusable or visible. A copy of the Sign in button's size, not of its words.
- **Only same-site paths come back.** `safeReturnPath` accepts a string that starts with `/` not
  followed by `/` or `\`, has no whitespace, control character or backslash anywhere, and, parsed
  with `new URL` against a fixed fake origin, keeps that origin; anything else is the fallback.
  `/%2F%2Fevil.com` is allowed and documented: a browser does not decode `%2F` before it resolves
  an address, so it stays a path on this site. A table of hostile inputs is a test.
- **A failed sign-out is said, not swallowed.** The menu closes, focus returns to the trigger, a
  polite live region says it failed, and the app's `onError` is called.
- **The kit never reads or writes a session.** Reading is the adapter's; the kit holds the state
  and nothing else. No cookie, no token, no storage key.
- **A third-party photo does not leak the page.** The avatar image loads with
  `referrerPolicy="no-referrer"`.
- **Every caller is served.** A person sees a name and a photo; a screen reader hears "Account
  menu for Dana, button, collapsed"; a keyboard opens it with Enter or Space and closes it with
  Escape; an agent reads `data-state` and `data-slot` attributes.

## Decisions already taken (the spec carries the reasoning)

| Decision | Why |
| --- | --- |
| The component takes `state`; the hook builds it from an adapter | A server-rendered app, a client-only app and a test each have a different source of truth. The component stays a function of its props. |
| The adapter is `{ read, subscribe }`, not a vendor client | It is the smallest shape both Supabase's `getSession`/`onAuthStateChange` and Auth.js's `getSession`/events fit. The app writes it in ten lines. |
| Reserve the larger room, not the Sign in room only | The WhyLikeDIs version reserved a Sign in button and the avatar (36 px) is narrower, so for a signed-in reader the neighbours move once when the session resolves (inferred from the code; the site's test covers the signed-out case only, and the spec's test measures it). Reserving the larger is the only way no state moves the bar. |
| Initials are `aria-hidden`; the name carries the label | The name is "Account menu for Dana"; the initials "D" are a picture of a person, not a label that must appear in the name (WCAG 2.5.3 is about text labels). Checked with axe. |
| `safeReturnPath` parses instead of prefix-checking | A prefix check is what failed. The parser is what the browser uses, so it agrees with the browser by construction. |
| The menu is the kit's `DropdownMenu` | One menu primitive, one keyboard model, one place for the focus rules. |

## Left out

- Sign-in itself (the form, the providers, OTP): `SignInForm`, `SignInMethods`, `SocialSignIn` and
  the app's service.
- The account page (profile form, linked identities, delete account).
- Profile fetching and caching: the adapter emits a better account when it has one.
- Multi-account switching, organisations, roles, a notifications bell.
- Remembering the last sign-in method (`lib/last-sign-in.ts`, 0.5 KB); it belongs with a safe
  per-browser storage helper, which waits for the `GettingStarted` store (PR #271) to land first.
- Server-side session reading; the kit is a client control.

## Success criteria

- WhyLikeDIs deletes `components/account-button.tsx`, `lib/profile.ts` and `safeNext`, adopts the
  kit's, and its existing "the bar does not move when the session is read" test in
  `e2e/settles.spec.ts` stays green at all three widths, now also with a signed-in session.
- The hostile-path table in the model test has at least thirty rows, includes the 17 refusals of
  the site's own table, and the rows a prefix check lets through (a tab, a newline, a carriage
  return, NUL, a line separator, a no-break space between the slashes) are red on a prefix-only
  implementation, proven in the PR.
- 100% line, branch and function coverage on the model, and the model in the mutation scope from
  the day it merges.
