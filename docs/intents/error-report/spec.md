# Spec: ErrorReport, ErrorLog and ErrorFallback

Status: approved (Design→Build waived by the owner, relayed by the lead, 2026-11-27). Intent: [intent.md](./intent.md).
Floor: the 26 rules of `interlace-component`; rule ids are cited where a decision is theirs.
Read against `whylikedis` `origin/main` 8577271 and `interlace` `origin/main` d51ab18d on 2026-11-27.

## 1. Local code this replaces (whylikedis)

| File | Size | Becomes |
| --- | --- | --- |
| `apps/mobile/lib/errors/report.ts` (`ErrorReport`, `reportError`, `setReporter`, `recentErrors`, `restoreRecent`, `installGlobalHandler`) | 2.6 KB | `error-report-model.ts` and `installNativeErrorHandler` |
| `apps/mobile/lib/errors/log.ts` (`errorStore`, `installErrorLog`, 25-row cap, row validation) | 1.7 KB | `error-log.ts` with the store adapter |
| `apps/mobile/lib/errors/fallback.tsx` (`ScreenError`, reports once on mount) | 1.4 KB | `@interlace/native` `ErrorFallback` |
| `apps/mobile/lib/errors/log.test.ts`, and the `installGlobalHandler` cases in `apps/mobile/lib/shell/shell.test.ts` | n/a | the kit's model tests (§7.1) |
| the About screen's list in `apps/mobile/app/about.tsx` (reads `recentErrors()` once, newest first) | not measured | `useRecentErrors()` and `formatReports()` |
| the wiring in `apps/mobile/app/_layout.tsx` (`installGlobalHandler()`, `installErrorLog(AsyncStorage)`, `ScreenError` in the root and in `app/play/what-would-you-say/[mode].tsx`) | not measured | the same calls under the kit's names; the app writes a three-line `ErrorStore` over AsyncStorage |

The site has no equivalent. Adoption adds, to `apps/site/app/`, an `error.tsx` and a
`global-error.tsx` of under 20 lines each, and `installGlobalHandlers()` in the root client layout.
`createPersisted` (in `@whylikedis/games`) stays the app's; the kit takes a plain adapter so it
does not need it.

## 2. Files

| File (in `packages/ui/src/`) | What | Environment |
| --- | --- | --- |
| `lib/error-report-model.ts` | Pure: `ErrorReport`, `toReport`, `createErrorLog`, `coalesce`, `trim`, `formatReports`, `parseReports` (validates stored rows). No DOM, no `Date`, no storage (the clock and storage are injected). | any |
| `lib/error-report.ts` | The default log (module state), `reportError`, `setReporter`, `recentErrors`, `restoreRecent`, `subscribeErrors`, `installGlobalHandlers(target?)`. Imports the model. | any, handlers browser |
| `lib/use-recent-errors.ts` | `useRecentErrors()` through `useSyncExternalStore`. `'use client'`. | browser |
| `patterns/error-fallback.tsx` | `ErrorFallback`. `'use client'`. Registry item `error-fallback`; `registryDependencies` `button`, `typography`, `stack`, `visually-hidden`. | browser |
| `primitives/section-boundary.tsx` | Existing file. One change: optional `onError` prop, called from `componentDidCatch`. | browser |

| File (in `packages/native/src/`) | What |
| --- | --- |
| `error-fallback.tsx` | `ErrorFallback` for React Native, same props, `Screen`/`Stack`/`Text`/`Button` from the package. |
| `error-handler.ts` | `installNativeErrorHandler(utils?)`: routes uncaught JS errors through `reportError`, then to the platform's own handler. Idempotent. |

The native package imports the model from `@interlace/ui`'s `lib/` exactly as it imports the game
models today ("imported, not copied"). A changeset (minor) and `versions:derive` entries for both
packages are part of the build. No new npm dependency.

## 3. API

```ts
export interface ErrorReport {
  /** A stable id for this report, from `makeId` (injected); never derived from the message. */
  id: string;
  /** Epoch ms from the injected clock. */
  at: number;
  /** What the person was doing, chosen by the caller: 'checkout: save', 'uncaught', 'route: /play'. */
  where: string;
  message: string;           // trimmed to `maxMessage`
  stack?: string;            // trimmed to `maxStackLines`
  fatal: boolean;
  /** 1 for a single report; more when the same `where` and `message` repeated within `coalesceMs`. */
  count: number;
}

export type Reporter = (report: ErrorReport) => void;

export interface ErrorLogOptions {
  max?: number;              // @default 25
  maxMessage?: number;       // @default 300 characters
  maxStackLines?: number;    // @default 12
  coalesceMs?: number;       // @default 1000
  now?: () => number;
  makeId?: () => string;
  /** Applied to message and stack before anything is kept or reported. The app's redaction hook. */
  redact?: (text: string) => string;
}

export interface ErrorLog {
  report(error: unknown, where: string, fatal?: boolean): void;
  recent(): readonly ErrorReport[];             // oldest first
  restore(earlier: readonly unknown[]): void;   // validated; kept ones go in front
  setReporter(next: Reporter | null): void;     // null restores the development logger
  subscribe(listener: () => void): () => void;
  clear(): void;
}

export function createErrorLog(options?: ErrorLogOptions): ErrorLog;

/** The default log, as functions, so a call site is one import. */
export const reportError: ErrorLog['report'];
export const recentErrors: ErrorLog['recent'];
export const setReporter: ErrorLog['setReporter'];
export const restoreRecent: ErrorLog['restore'];

/** Reports kept on the device. `load` returns what was saved; anything it returns is untrusted. */
export interface ErrorStore {
  load(): unknown | null | Promise<unknown | null>;
  save(reports: readonly ErrorReport[]): void | Promise<void>;
}
export function installErrorLog(store: ErrorStore, log?: ErrorLog): Promise<void>;

export function installGlobalHandlers(target?: Pick<Window, 'addEventListener' | 'removeEventListener'>): () => void;

export function formatReports(reports: readonly ErrorReport[], options?: { locale?: string }): string;
export function useRecentErrors(): readonly ErrorReport[];

export interface ErrorFallbackLabels {
  title: string;        // 'Something went wrong here'
  description: string;  // 'Try again, or go back.'
  retry: string;        // 'Try again'
  back: string;         // 'Go back'
  referenceLine: (id: string) => string;   // 'Reference: ab12'
}

export interface ErrorFallbackProps extends Omit<React.ComponentProps<'section'>, 'children'> {
  /** What the router hands a boundary. */
  error: unknown;
  /** Next and Remix call it `reset`; Expo Router calls it `retry`. Pass either. */
  reset?: () => void;
  retry?: () => void;
  /** Where the screen is, for the report: 'route: /play'. Required: a report with no place is noise. */
  where: string;
  /** Leave the broken screen. Omit to hide the second button. */
  onBack?: () => void;
  /** Extra lines the app is sure of: 'Your progress is saved.' Rendered as given. */
  reassurance?: React.ReactNode;
  /** Show the short reference so a person can quote it. @default true */
  showReference?: boolean;
  /** Called with the report once, on mount; defaults to the default log. */
  report?: (error: unknown, where: string) => void;
  labels?: Partial<ErrorFallbackLabels>;
}
```

Notes on the API:

- `where` is required on `ErrorFallback` and on `reportError`. The seam to a vendor is `report`,
  a function, not a vendor prop (R10, composition seam).
- `labels` are plain English defaults; every string is a prop. The reference line shows the
  first four characters of `id`.
- `ErrorFallback` renders neither the message nor the stack. They are in the log, never on the
  screen: a person does not need a stack, and a stack can hold what they typed.

## 4. Behaviour of the model (pure, in `error-report-model.ts`)

1. **Build.** `toReport(error, where, fatal)`: an `Error` yields its message and stack; anything
   else is `String(error)` (a thrown string, object or `null` becomes text, never throws); a thrown
   object whose `toString` throws becomes `'[unprintable error]'`. Message and stack are passed
   through `redact`, then trimmed (message to `maxMessage` with an ellipsis, stack to the first
   `maxStackLines` lines).
2. **Coalesce.** If the newest kept report has the same `where` and `message` and is within
   `coalesceMs` of `now`, its `count` rises by one, its `at` is updated, and nothing is appended.
   The reporter still hears every occurrence (a vendor wants to count), with `count` set.
3. **Ring.** The log keeps the last `max` reports, oldest dropped.
4. **Contain.** The reporter runs inside `try`; a throw is swallowed. A reporter that calls
   `report` inside its own call is dropped (a depth flag), so a reporter bug cannot loop.
5. **Restore.** `restore(earlier)` runs each row through `parseReports` (an object with a numeric
   `at`, a string `where` and `message`, a boolean `fatal`; a missing `count` is 1; a missing `id`
   is made from `makeId`), drops the rest, puts the kept ones in front of this session's, then
   re-applies `max`.
6. **Format.** `formatReports` returns plain text, one line per report, oldest first:
   `2026-11-27 10:04  route: /play  Something broke (x3)`. Time is `Intl.DateTimeFormat` in `locale`.
   It never includes a stack (a person shares this text; stacks are in the JSON form).
7. **Install log.** `installErrorLog(store, log)`: `load`, `restore`, then `setReporter` to a
   function that calls the development logger and `save(log.recent().slice(-max))`. A `load` or
   `save` that throws or rejects is swallowed: failing to store an error must not report an error.
   Returns after `restore`, so a diagnostics screen reads earlier sessions first.
8. **Global handlers.** `installGlobalHandlers`: `error` (uses `event.error ?? event.message`,
   `where` `'uncaught'`, `fatal` false) and `unhandledrejection` (`event.reason`, `where`
   `'unhandled rejection'`). Idempotent per target; returns the remover. Does not call
   `preventDefault`, so the browser console still logs.
9. **Native handler.** `installNativeErrorHandler(utils = globalThis.ErrorUtils)`: no `utils`, no-op;
   otherwise wraps `setGlobalHandler` to `reportError(error, 'uncaught', !!isFatal)` and then calls
   the previous handler with the same arguments. Idempotent.
10. **Development logger.** `__DEV__` (React Native) or `process.env.NODE_ENV !== 'production'`
    guards a `console.warn('[where] message')`; in production it does nothing. It is the only
    default reporter.

## 5. Anatomy and states of `ErrorFallback`

```
ErrorFallback                 (section, data-slot="error-fallback", role="alert")
  ├─ Heading                  (h2, tabIndex -1, data-slot="error-fallback-title")
  ├─ Description              (p, data-slot="error-fallback-description")
  ├─ Reassurance              (optional ReactNode)
  ├─ Actions                  (Try again: primary; Go back: ghost, when onBack is given)
  └─ Reference                (p, text-muted, "Reference: ab12", when showReference)
```

| State | What it shows |
| --- | --- |
| First render | The heading, description, actions. `report` runs once in an effect; the reference line appears when the report id is known. |
| Retry pressed | `reset` or `retry` is called; the fallback does not hide itself (the router replaces it). Pressed twice quickly, called once per press. |
| `reset` and `retry` both missing | Try again is not rendered; the description still reads correctly (no "try again" in the default text when there is no way to). A dev warning names the missing prop. |
| `onBack` missing | One button. |
| Same `error` object re-rendered | Reports once (a ref on the error identity), not once per render. |
| New `error` object | A new report. |
| Narrow (320 px) | Buttons stack and are full width; text wraps; no horizontal scroll. |
| RTL | Logical properties only; the button order follows reading order. |

## 6. Interaction, accessibility and motion

- **Focus.** On mount, focus moves to the heading (`tabIndex={-1}`, `focus({ preventScroll: false })`),
  once. A person on a keyboard or screen reader lands on "Something went wrong here" instead of on
  nothing.
- **Announcement.** `role="alert"` on the section, so a screen reader reads title and description
  once on mount. It is not re-announced on re-render (the node does not change).
- **Names.** The two actions are named by their visible text (Label in Name, WCAG 2.5.3). Targets
  are 44 px on touch (native: `minHeight` 44, `hitSlop` as the kit's `Button` has; the touch-target
  lock test covers the web `Button`).
- **Contrast.** Tokens only (R19). The reference line uses the muted foreground token; the
  build agent adds the fallback to the composite contrast lock so its pair is measured, not assumed.
- **Native.** `accessibilityRole="alert"` on the container; `accessibilityLiveRegion="polite"`
  on Android; focus moves to the title with `AccessibilityInfo.setAccessibilityFocus` on mount.
- **Motion.** None. The component has no animation of its own, so reduced motion changes nothing
  and the static projection (principle 6) is the component itself.
- **Static projection.** Title, description and actions in reading order; the reference line last.

## 7. Test plan

Rule: a feature is not done until a check would have caught it, **and the check was shown failing
on the broken state.**

### 7.1 Pure model (`__tests__/error-report-model.test.ts`, in the coverage glob at 100)

- `toReport`: Error, string, number, `null`, object, object with throwing `toString`, error
  with no stack, a 10 000 character message (trimmed, ends with an ellipsis), a 200-line stack (12
  kept), `redact` applied to both, `redact` that throws (the report is still built, text replaced
  by `'[redaction failed]'`).
- `createErrorLog`: ring drops oldest at `max`; coalesce within and outside `coalesceMs` (injected
  clock), different `where` is not coalesced; the reporter hears every occurrence with the right
  `count`; a throwing reporter does not throw; a reporter that calls `report` is not re-entered;
  `setReporter(null)` restores the development logger; `subscribe` fires on report, restore and
  clear, and not after unsubscribe.
- `restore`/`parseReports`: valid rows kept; rows missing `at`, `where` or `message` dropped; an
  `at` that is a string dropped; more than `max` rows keeps the newest; kept rows precede this
  session's.
- `installErrorLog`: restores then saves on each report; a `load` that rejects; a `save` that
  rejects; a `save` that throws synchronously; neither calls the reporter with an error about
  storing (spied); two installs do not double-save.
- `formatReports`: order, count suffix, locale, no stack text, empty list is an empty string.
- `installGlobalHandlers`: a fake target receives an `error` event with `error`, with only
  `message`, and an `unhandledrejection` with a non-Error reason; `preventDefault` is not called;
  the remover removes both; a second install on the same target adds nothing.
- `installNativeErrorHandler`: a fake `ErrorUtils`; the previous handler is called with the same
  arguments after the report; no `utils` is a no-op; second call adds nothing.

### 7.2 Component (`__tests__/error-fallback.test.tsx`, injected `report`)

- Renders title, description, Try again; Go back only with `onBack`.
- Reports once on mount; re-render with the same error does not report; a new error does.
- Try again calls `reset`, or `retry` when only that is given; both missing hides it and warns.
- Focus is on the heading after mount; a second render does not steal it back.
- `role="alert"` present; no stack or message text appears anywhere in the output.
- Axe (jest-axe) finds nothing; at 320 px (container query) buttons are full width.
- SSR: server markup equals first client render (no `window` access during render).
- Native (`packages/native/__tests__/error-fallback.test.tsx`): the same cases with the native
  test renderer; `accessibilityRole` is `alert`.

### 7.3 Browser stories as tests (existing storybook job)

`Default`, `WithReassurance`, `NoBack`, `NoRetry`, `LongTitle`, `Mobile320`, `Rtl`,
`HighContrast`, `TextSize150` (the visual job's six conditions), plus a play function that
presses Tab once and asserts focus is on the heading, then Enter on Try again and asserts the
call.

### 7.4 Deliberate-break proofs (each shown red before the fix is kept)

| Break (done by hand, then reverted) | Test that must fail |
| --- | --- |
| `report` does not wrap the reporter in `try` | throwing-reporter case |
| The re-entry flag is removed | reporter-calls-report case (stack overflow) |
| `installErrorLog` reports a `save` failure | failing-store case |
| Coalesce ignores `where` | different-`where` case |
| `restore` keeps a row with no `message` | validation case |
| `toReport` trims after `redact` instead of before | a secret split by the cut shows in the output |
| `formatReports` includes `stack` | no-stack case |
| `installGlobalHandlers` calls `preventDefault` | handler case |
| Native handler does not call the previous handler | previous-handler case |
| `ErrorFallback` reports in render instead of an effect | SSR and strict-mode double-report cases |
| Focus effect runs on every render | focus-steal case |
| Message rendered in the fallback | no-message-text case |
| `SectionBoundary` `onError` not called | boundary case |

Plus the mutation lane (see `mutation-testing-room-logic`): `error-report-model.ts` joins its
scope the day it merges.

## 8. Stories and docs

`apps/storybook/src/stories/patterns/ErrorFallback.stories.tsx` (`Meta<typeof ErrorFallback>`) with
the conditions above. The docs page has three short, copy-ready blocks, all marked as the app's
code: `app/error.tsx` for Next, an Expo Router `ErrorBoundary` export, and a ten-line crash-service
reporter. It also has the table of what a report contains and what it never contains.

## 9. Performance and size

- Model has no import of React. `ErrorFallback` is a client component with one effect; no
  layout shift (CLS 0: the fallback replaces a screen, it does not insert into one).
- Budgets, **recorded at first build, then ratcheted**: gzip size of model and of the component.
  No number appears in docs before it is measured, with command and date.

## Out of scope

Sending reports anywhere; a hosted dashboard; breadcrumbs, sampling, release tags, source maps;
user feedback forms; automatic retry with backoff; wrapping every component in a boundary;
crash reporting for native code (Hermes, Objective-C, Kotlin crashes: the platform's tools); a
store implementation for a specific library (the adapter is the app's three lines).

## 10. Open questions, each with the default the build agent takes

| Question | Default |
| --- | --- |
| Show the stack on screen in development? | No. The log has it; the fallback never renders it. |
| Is `reference` worth showing? | Yes, four characters; it lets a person quote one report from a diagnostics list. Hidden with `showReference={false}`. |
| Should `ErrorFallback` also render a full page with the `ErrorTemplate` shell? | No. It lives inside whatever the router renders; an app that wants the full page wraps it in `ErrorTemplate`. |
| Where is the file for web `ErrorFallback`: `patterns/` or `blocks/`? | `patterns/` (a composition of primitives with behaviour). |
| Coalesce window 1 s, cap 25, message 300 | Yes, until measured against a real render-loop case in the stories; the number that stays is what the test picks. |
| Report `fatal` for a boundary catch? | No: a boundary caught it, so the app is alive. `fatal` is for the native global handler's flag. |
| Does `redact` run before `makeId`? | Yes; the id never depends on message text. |

## Check

The feedback loop, and the check that would have caught the problem: one command that exits
non-zero when a thrown error does not reach the reporter, a reporter bug escapes, a stored row is
trusted, or the fallback fails to report once.

**Check:** `cd packages/ui && npx vitest run __tests__/error-report __tests__/error-fallback __tests__/section-boundary-on-error && cd ../native && npx vitest run`

## Build notes (where the build differs from the draft, and why)

| Draft said | Built | Why |
| --- | --- | --- |
| `installErrorLog` sets the reporter to a function that saves | It subscribes to the log and saves on every change, and does not touch the reporter | A crash service is one `setReporter` call. If the device log held the reporter slot, that call would silently stop the log. The test "keeps saving when an app sets its own reporter afterwards" holds this. A clear is saved too, so the device log can be emptied. |
| `ErrorLog.report` returns `void` | Returns the kept `ErrorReport`, or `undefined` when dropped | The fallback needs the id to show the reference line, and an injected `report` is the only seam. Still assignable where `void` is expected. |
| `installGlobalHandlers(target?)` | `installGlobalHandlers(target?, log?)`; the model holds `attachGlobalHandlers(target, log)` | The logic joins the mutation scope; the file that holds module state stays a thin wrapper. |
| `installNativeErrorHandler` wraps `setGlobalHandler` | The model's `wrapNativeHandler(utils, log)` does; the native file is the wiring | Same reason. It reads the previous handler with `getGlobalHandler` when `ErrorUtils` has one. |
| `restore` keeps rows that pass `parseReports` | Also skips rows whose `id` the log already holds, and trims message and stack on the way in | Installing twice must not double the stored rows; storage is untrusted. |
| `formatReports(reports, { locale })` | Also `{ timeZone }` | A test needs a fixed zone; so does a support page that must say which. |
| `ErrorFallbackLabels.referenceLine(id)` | Receives the four-character reference, not the id | The id is never shown whole. |
| The description default is one string | The default names only the actions the screen has (`resolveFallbackLabels`) | §5: no "try again" when there is no way to. A `labels.description` is used as given. |
| `lib/` has no model in the mutation glob | `src/lib/*-model.ts` joins `scope.json` and `oxmutate.config.json`; the mutation workflow also watches `packages/ui/src/lib/**` | §7.4: the model is in the scope the day it merges. The floor row is `null` until the first measured run, as every other row. |
| Native component tests with the native test renderer | The native package runs Node-only tests of its pure files (`vitest.config.ts`: "a React Native renderer in Node is a later wave"). `error-handler.ts` is in its 100% list; `error-fallback.tsx` is type-checked and shares its copy, report and reference rules with the web component through the model | No native renderer exists in the repo yet. The behaviours are proven where they live (the model) and on the web component. |
| `SectionBoundary` gets `onError` | Done; its props now `Omit<ComponentProps<'section'>, 'onError'>` | The DOM `onError` is an image-load event and cannot mean "a descendant threw". |

Registry: `error-fallback` (pattern), `error-report-model`, `error-report` and `use-recent-errors`
(lib items it installs with). Package paths: `@interlace/ui/error-report`,
`@interlace/ui/error-report-model`, `@interlace/ui/use-recent-errors`,
`@interlace/ui/patterns/error-fallback`; `@interlace/native` re-exports the log functions.

