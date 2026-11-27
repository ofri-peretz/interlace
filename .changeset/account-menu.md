---
'@interlace/ui': minor
---

Add the account control for a top bar. `AccountMenu` sits at the end of a `Topbar`'s `actions` slot in the three states every app with accounts has: unknown (it keeps the room the answer will take, shows nothing, says nothing and cannot be focused, so the bar does not move when the session is read), signed out (a Sign in link that carries the current page as `?next=`, and nothing on the sign-in page) and signed in (a photo or initials as a menu button named "Account menu for Dana", a header with the name and email, the app's links, and Sign out, which may take a moment and may fail: a failure closes the menu, returns focus to the button, says so in a polite live region and calls `onError`). `useAccount(adapter)` builds the state from any sign-in service through `{ read, subscribe }`; the kit never reads or writes a session. `patterns/account-menu-model` adds `accountDisplayName`, `accountInitials` (by grapheme, so Hebrew, Han and emoji names are whole), `signInHref` and `safeReturnPath`, which keeps only a path on this site: it refuses anything that does not start with a single `/`, and any whitespace, control character or backslash anywhere in it (a browser deletes a tab or newline from an address, so `/\t/host` is `//host`), then parses the rest. An encoded slash (`/%2F%2Fhost`) is a path on this site and is kept.

Components: account-menu
