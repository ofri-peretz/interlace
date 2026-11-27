# Intent — nothing in an app built on Interlace fails silently, and a crash never leaves a blank screen

**Status:** approved · written 2026-11-27 from a read of the WhyLikeDIs mobile app
(`whylikedis` `origin/main` 8577271, `apps/mobile/lib/errors/`) and its site. Design→Build was waived
by the owner for specs written this way (relayed by the lead, 2026-11-27); Deploy stays a human's:
the PR merges. Lives at `docs/intents/error-report/intent.md` with `spec.md` beside it.

## What is wanted

Three small parts that work alone and together, on web and on React Native:

1. **`reportError(error, where)`**: one function every caught failure goes through (a storage write
   that failed, a screen that crashed, an unhandled rejection). It builds a typed report, keeps the
   last few in memory, and hands each to a **pluggable reporter**. Default reporter: a development
   log and nothing else. A crash service is one `setReporter` call, with no call site touched.
2. **A device-only crash log.** The last reports are kept in the app's own storage (an adapter the
   app passes, the same `load`/`save` shape as `GettingStarted`'s store), so a problem from an
   earlier session, including the one that closed the app, can be read on a diagnostics screen and
   shared by the person if they choose. Nothing is sent anywhere on its own.
3. **`ErrorFallback`**: what a screen shows when it crashes, instead of a blank page or a red
   box. Plain words, "your progress is saved" only if the app says so, a Try again button and a
   way out. It reports once on mount. It matches the shape router boundaries hand it
   (`{ error, reset }` or `{ error, retry }`), and imports no router.

Plus the two install functions that make "nothing fails silently" true: `installGlobalHandlers()`
for the browser (`error`, `unhandledrejection`) and `installNativeErrorHandler()` for React Native
(`ErrorUtils`, chaining to the platform's own handler so a production crash still crashes).

Neutral, per the registry's rules: no product's name, copy or colours; every string is a `labels`
entry with a plain default; a brand arrives through the kit's tokens.

## Why now

- The WhyLikeDIs mobile app wrote it locally: `lib/errors/report.ts` (2.6 KB), `log.ts` (1.7 KB),
  `fallback.tsx` (1.4 KB) and `log.test.ts`. It is generic except one string ("Back to Play") and
  an `expo-router` import.
- The WhyLikeDIs site has none of it. A search of `origin/main` for `error.tsx` or
  `global-error.tsx` under `apps/site/app/` finds neither, and `lib/player.ts` swallows a failed
  save with `.catch(() => {})` (twice). This is the common case: the app that needs it has not written it.
- Interlace has the pieces but not the seam. `SectionBoundary` (primitives) catches a render error
  in a section and shows a fallback; `ErrorTemplate` is a whole-page 404/500; neither reports
  anything or keeps anything, and the native package has no fallback at all.
- Principle 5: a person with a screen reader and a person on a phone both land on the fallback.
  Today what they land on is whatever the framework draws.
- Principle 4: "nothing fails silently" is a slogan until a test proves a thrown error reaches
  the reporter. The spec's break table does.

## Constraints

- **A reporter that throws is contained.** Reporting must never become the next crash. A reporter
  that calls `reportError` is contained too (no recursion).
- **Failing to store an error does not report an error.** The log's own failures are silent by
  design, and a test says so.
- **Private by construction.** A report carries a place the developer named, a message and a
  stack, trimmed to a limit, and a redaction hook the app can use. It carries no storage
  contents, no props, no URL query. The default reporter never leaves the device.
- **A flood is a count, not a thousand rows.** The same place and message in one second is one
  report with a count.
- **The fallback is a landmark of its own.** Focus moves to its heading on mount; it is announced
  once; Try again calls the router's reset and nothing else.
- **No dependency.** No router, no crash vendor, no storage library. The app passes functions.
- **Every caller is served.** A person reads the fallback; an agent reads `formatReports()`
  (plain text, one line per report, newest last) and `--json`-style `recentErrors()`; CI reads a
  non-zero exit when a test sees an unreported throw.

## Decisions already taken (the spec carries the reasoning)

| Decision | Why |
| --- | --- |
| A module-level default log plus `createErrorLog()` for tests and for apps that want two | The WhyLikeDIs version is module state and every call site is one import. A factory underneath keeps it testable. |
| Reports carry `where: string`, chosen by the caller | A stack says where the code is; `where` says what the person was doing. It is the field a diagnostics screen groups by. |
| Storage is an adapter with `load` and `save`, not `localStorage` | The same log serves web storage, AsyncStorage and a test. The shape matches `GettingStarted`'s `ChecklistStore` (PR #271) so an app writes one adapter. |
| Native fallback in `@interlace/native`, web fallback in `@interlace/ui` | The views differ; the model, the log and the copy defaults are one file, imported by both (as the game models already are). |
| `ErrorFallback` takes `reset` or `retry`, never imports a router | Next, React Router, TanStack and Expo Router all hand a boundary an error and a retry function. |
| Chain to the platform's own global handler on native | The red screen in development and the crash in production must still happen. |

## Left out

- A hosted crash dashboard, sampling, breadcrumbs, release tracking, source maps: that is a vendor
  (principle 1), and `setReporter` is where one plugs in.
- Sending anything. The kit never calls `fetch`.
- User feedback forms ("what were you doing?").
- Wrapping every component in a boundary; `SectionBoundary` stays the section-level tool and gets
  an optional `onError` that calls `reportError` (a one-line change, in the spec).

## Success criteria

- WhyLikeDIs mobile deletes its four local files and its tests stay green with the kit's model
  tests covering what `log.test.ts` did.
- WhyLikeDIs site adds `app/error.tsx` and `app/global-error.tsx` of under 20 lines each, and
  routes the empty handlers that hide a real failure through `reportError`. A search of
  `origin/main` on 2026-11-27 finds about thirty empty `catch` handlers under `apps/site/`; most are
  deliberate ("storage may be blocked") and stay silent, a handful hide a failed save or request
  (`lib/player.ts` lines 87 and 129, `lib/analytics.ts` line 97, `sign-in-methods.tsx` line 122).
  The adoption PR lists which it moved and why; the count is re-run with the same command.
- 100% line, branch and function coverage on the model, and the model in the mutation scope from
  the day it merges.
