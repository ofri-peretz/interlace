# Spec: GettingStarted

Status: draft for acceptance at Design→Build. Intent: [intent.md](./intent.md).
Floor: the 26 rules of `interlace-component`; rule ids are cited where a decision is theirs.
Read against `origin/main` of `interlace-ds-viz` on 2026-11-26. Reuses, unchanged:
`games/daily` (`dayKey`, `DayKey`, `daysBetween`, `msUntilNextDay`), `games/streak-model`
(`summarizeStreak`, `RestRule`), `games/progress-model` (`milestonesCrossed`, `nextMilestone`),
`lib/use-reduced-motion`, and the primitives `Checkbox`, `Progress`, `Accordion`, `Button`.

## 1. Files

| File (in `packages/ui/src/patterns/`) | What | Environment |
| --- | --- | --- |
| `getting-started-model.ts` | Pure: `parseChecklist`, `deriveChecklist`, `complete`/`uncomplete`/`skip`, `celebrationsFor`, `pace`, `mergeSnapshots`, `parseSnapshot` (untrusted input), `announcementFor`. No DOM, no `Date`. | any |
| `getting-started-store.ts` | `ChecklistStore` type, `memoryStore()`, `localStorageStore(key)`. | browser (guarded) |
| `getting-started.tsx` | The flat parts. `'use client'`. | browser |
| `getting-started-burst.tsx` | The CSS burst for `celebrate="full"`; lazy; never rendered under reduced motion. | browser |

Registry item `getting-started`: `registryDependencies` are `checkbox`, `progress`, `accordion`,
`button`, `streak-model`, `progress-model`, `daily` (the last three as library items so the
install copies the pure cores). No new npm dependency. Changeset (minor) and
`versions:derive` are part of the build.

## 2. Data and API

```ts
export interface StepDef {
  id: string;                    // stable, [a-z0-9-], unique
  title: string;
  description?: string;
  /** Does not count toward progress or completion. @default false */
  optional?: boolean;
  /** Locked until every id here is done (or skipped, if that step is optional). */
  after?: readonly string[];
  /** Counts toward progress. @default 1 */
  weight?: number;
  group?: string;                // a group id from `groups`
}
export interface GroupDef { id: string; title: string }
export interface ChecklistDef {
  steps: readonly StepDef[];
  groups?: readonly GroupDef[];
  /** Percent marks worth a line of their own. @default [25, 50, 75] */
  milestones?: readonly number[];
}

/** What is stored and merged. Plain JSON, versioned. */
export interface ChecklistSnapshot {
  v: 1;
  done: Record<string, number>;      // step id → ms it was done
  skipped: Record<string, number>;   // optional step id → ms
  celebrated: readonly string[];     // 'step:<id>' | 'milestone:<pct>' | 'complete'
  activeDays: readonly string[];     // DayKey[], append-only, sorted
  dismissed: boolean;
  /** ms of the last change; the tie-break for merge. */
  at: number;
}

export interface ChecklistStore {
  /** `null`: nothing saved yet. Rejects only for a real failure (not for "empty"). */
  load(): ChecklistSnapshot | null | Promise<ChecklistSnapshot | null>;
  save(snapshot: ChecklistSnapshot): void | Promise<void>;
  /** Other tabs or devices. Returns the unsubscribe. */
  subscribe?(onChange: (snapshot: ChecklistSnapshot) => void): () => void;
}

export type ChecklistChange =
  | { type: 'complete' | 'uncomplete' | 'skip' | 'unskip'; stepId: string }
  | { type: 'dismiss' | 'restore' }
  | { type: 'merge' };                 // from `subscribe`, not the person

export type Celebration =
  | { type: 'step'; stepId: string }
  | { type: 'milestone'; percent: number }
  | { type: 'complete' };

export interface GettingStartedProps
  extends Omit<React.ComponentPropsWithoutRef<'section'>, 'onChange' | 'defaultValue'> {
  'data-testid': string;                                  // R5
  definition: ChecklistDef;
  value?: ChecklistSnapshot;                              // R14 controlled
  defaultValue?: ChecklistSnapshot;                       //     uncontrolled
  onValueChange?: (snapshot: ChecklistSnapshot, change: ChecklistChange) => void;
  /** Persistence. With `value` set, the app persists and `store` is ignored. */
  store?: ChecklistStore;
  /** Fires once per celebration, at the moment it happens, never on load. */
  onCelebrate?: (celebration: Celebration) => void;
  /** @default 'quiet' */
  celebrate?: 'off' | 'quiet' | 'full';
  /** Shows days in a row; see §5. Absent: no streak anywhere. */
  streak?: { rest?: RestRule; timeZone?: string };
  /** The date the list is for, ms. Enables pace. */
  dueAt?: number;
  /** Steps the person can realistically finish a day, for pace. @default 2 */
  capacityPerDay?: number;
  /** Lets the person hide the list once complete. @default false */
  dismissible?: boolean;
  /** Which steps start open. @default 'next' */
  defaultOpen?: 'next' | 'none' | 'all';
  labels?: GettingStartedLabels;                          // every string, default plain English
  now?: () => number;                                     // injected clock, @default Date.now
  timeZone?: string;                                      // for day keys, @default the browser's
}
```

Flat parts (RSC-composable shape, one context, R15), all `data-slot`ed (R6):

```tsx
<GettingStarted definition={def} store={localStorageStore('prep')} dueAt={...} streak={{}}>
  <GettingStartedHeader />                          {/* title, progress, pace, streak */}
  <GettingStartedGroup id="plan">                   {/* optional; heading + its steps */}
    <GettingStartedStep id="date" action={<Button render={<a href="/schedule" />}>Pick a date</Button>} />
  </GettingStartedGroup>
  <GettingStartedCelebration />                     {/* the milestone / finish line, in words */}
</GettingStarted>
```

- `GettingStartedStep` takes `id`, `action?: ReactNode` (R11: a slot, never a string label),
  `children?: ReactNode` for the open body; title and description come from `definition`.
- With no children the root renders the default arrangement from `definition`, so a minimal use
  is `<GettingStarted definition={def} data-testid="x" />`. Children replace the default (R11).
- **R8** booleans default false (`dismissible`). **R9** `onValueChange(snapshot, change)`; no
  bespoke `onStepDone` (the `change` carries the type). **R10** `stepProps`, `headerProps` pass
  through. **R12** `Checkbox`, `Progress`, `Accordion` and `Button` are slotted, not wrapped.
  **R16** the step's action is the app's button; the component renders no link of its own.
  **R17** closest incumbents are Intercom/Appcues-style checklists and the Base UI `Checkbox`
  group; the divergence block (no overlay, no tour, data as JSON) goes in the source header.
- **R24** no product nouns: ids, copy and examples are the app's.

## 3. Anatomy

```
GettingStarted                  (section aria-labelledby; data-slot="getting-started"; data-state=loading|active|complete|dismissed; data-motion=full|reduced)
  ├─ GettingStartedHeader       (data-slot="getting-started-header")
  │   ├─ h2                     (data-slot="getting-started-title")
  │   ├─ Progress               (data-slot="getting-started-progress"; valuetext "3 of 7 steps done")
  │   ├─ p                      (data-slot="getting-started-pace": "5 steps left, 4 days to go. On track.")
  │   ├─ p                      (data-slot="getting-started-streak": "3 days in a row"; only with `streak`)
  │   └─ p role=status          (data-slot="getting-started-save": empty until a save fails)
  ├─ ol | groups of ol          (data-slot="getting-started-list", labelled)
  │   └─ li × n                 (data-slot="getting-started-step"; data-state=todo|done|skipped|locked|next)
  │       ├─ Checkbox           (native input; aria-disabled when locked; labelled by the title)
  │       ├─ title, description (the description is `aria-describedby`)
  │       ├─ p                  (data-slot="getting-started-reason": "Finish 'Pick a date' first" — locked only)
  │       ├─ Accordion item     (the body and `action`; open for the next step by default)
  │       └─ Button             (data-slot="getting-started-skip": optional steps only)
  ├─ GettingStartedCelebration  (data-slot="getting-started-celebration"; role=status; the line in words)
  │   └─ span aria-hidden       (data-slot="getting-started-burst": `full` only, never under reduced motion)
  └─ p aria-live=polite         (data-slot="getting-started-announce", sr-only, atomic)
```

Loading: while `store.load()` is pending the root renders the list shell with `aria-busy`, the
step titles as skeleton lines of fixed height (`min-h` reserved from `definition.steps.length`),
so nothing shifts when state arrives (R23).

## 4. Model behaviour (pure, in `getting-started-model.ts`)

- `parseChecklist(unknown) → { ok: true, def } | { ok: false, errors: string[] }`: unique
  `[a-z0-9-]` ids; every `after` and `group` resolves; no cycle (Kahn); `weight > 0` finite;
  milestones in 1..99 ascending; at least one required step. Errors name the step.
- `deriveChecklist(def, snapshot)` → per step `state` (`done | skipped | locked | next | todo`),
  `lockedBy: string[]`, `progress` = done weight of required steps ÷ total required weight
  (0 for an empty denominator is impossible: parse refuses it), `complete` when every required
  step is done, `next` = first required step in definition order that is not done and not locked.
  Skipping applies to optional steps only; a skipped optional step satisfies `after`.
- `complete(snapshot, id, now, tz)` / `uncomplete`: return a **new** snapshot; completing a locked
  step is a no-op (the view reports the reason, the model never lets it through); completing adds
  `dayKey(now, tz)` to `activeDays` (append-only, deduped, sorted); uncompleting never removes a day
  and never removes anything from `celebrated`.
- `celebrationsFor(def, before, after)` → `Celebration[]` in priority order, **each only if its
  key is not in `after.celebrated`**: a `step` per step newly done; `milestone` per
  `milestonesCrossed(pct(before), pct(after), def.milestones)`; `complete` when `after` is
  complete and `before` was not. The view shows only the highest (`complete` > milestone > step),
  and writes every shown key into `celebrated`. Unticking and re-ticking a step does not
  celebrate it twice.
- `pace(def, snapshot, now, dueAt, capacityPerDay, tz)` → `{ state: 'none' | 'done' | 'on-track' |
  'behind' | 'overdue', stepsLeft, daysLeft }`. `daysLeft = max(0, daysBetween(dayKey(now), dayKey(dueAt)))`;
  `on-track` iff `stepsLeft <= max(1, daysLeft) × capacityPerDay`; `overdue` when the due day has
  passed and the list is not complete. The sentence carries the state in words and an icon; the
  number is never the only signal.
- Streak: `summarizeStreak(snapshot.activeDays, today, { rest })` from `streak-model`, unchanged.
  Copy for each `StreakStatus`: `played` "3 days in a row", `pending` "Do one step today to keep
  your 3 days going", `resting` "Rest day. Your 3 days are safe", `none` nothing shown.
  No copy anywhere says "lost", "broken" or "you missed".
- `mergeSnapshots(a, b)`: `done` and `skipped` per step: the entry with the later `at` wins, and an
  absent entry loses to a present one only if the present one is newer than the other side's
  `at` (this is what makes "unticked on tablet" survive "never seen on phone"); `celebrated`,
  `activeDays`: set union; `dismissed`: the newer snapshot's; result `at = max`. Commutative,
  associative, idempotent, each proven by a property test (§8).
- `parseSnapshot(unknown)`: stored data is **untrusted**: wrong or missing `v`, non-finite or
  negative times, ids not in the definition (dropped, not an error: the list may have changed),
  non-array `celebrated`, `__proto__`/`constructor` keys, strings longer than 64 chars, more than
  400 `activeDays`: each handled, none throws, a hostile blob yields a clean snapshot.
- `announcementFor(def, before, after)` → one string or null: "Pick a date done. 3 of 7 steps
  done." / "Halfway: 4 of 7 steps done." / "All 7 steps done. You are ready." / "Pick a date is
  open again." Never on load, never twice for one change.

## 5. Persistence adapter

- Uncontrolled with `store`: on mount `load()`; `parseSnapshot` the result; `defaultValue` is the
  fallback when it is `null`. State `loading` until it settles. If `load` rejects, show the list
  from `defaultValue` and one polite line "Could not load your saved progress", saving still tried.
- Each change updates state first (instant), then `save` is called debounced 300 ms, last value
  wins, flushed on `pagehide`. A rejected `save` sets `getting-started-save` text "Not saved yet.
  Your progress is kept on this page", retries at 2 s, 8 s, 30 s, then waits for the next change;
  success clears the line. The line is `role="status"` and announced once per failure, not per retry.
- `subscribe`: a snapshot from elsewhere is `parseSnapshot`ed, `mergeSnapshots`ed into state, and
  reported as `{ type: 'merge' }`. A merge never triggers a celebration (it did not happen here).
- `localStorageStore(key)`: all access in `try/catch` (private mode, blocked storage, quota),
  falls back to memory with the same interface and says so through `load`'s result being
  `null` and `save` resolving (the save-failed line then never lies: it reports a real failure
  only when the app's own `save` rejects). Subscribes to the `storage` event, ignoring other keys.
  Key stored with the version: `<key>:v1`.
- `memoryStore()`: for tests, stories and a single-page app with its own persistence.
- Server stores: documented as ten lines in the docs page (a `fetch` to the app's API inside
  `load`/`save`); the component never imports one.

## 6. Motion and celebration

| Moment | `quiet` (default) | `full` | Reduced motion |
| --- | --- | --- | --- |
| Step done | the check scales in once (`@starting-style`, 200 ms, `motion-safe:`) and the row text settles to done style | same | still done style, no scale |
| Progress | bar fill transitions on `--duration-medium` | same | instant |
| Milestone | the milestone line appears in `getting-started-celebration` | same | same line, no transition |
| Complete | "All set" banner with a check | banner plus a CSS burst: 16 absolutely positioned `aria-hidden` spans, transform and opacity only, 1.2 s, once, `pointer-events: none` | banner only; `getting-started-burst` is **not rendered** |
| Forced colors | no change | burst hidden | n/a |

- Reduced motion is read with `useReducedMotion` for anything JavaScript decides (mounting the
  burst, any timer) and with `motion-safe:` for CSS; `data-motion` on the root reports it. The
  hook returns the right value on the first client render (see its header) and the CSS reset
  covers the hydration frame.
- Nothing flashes more than once per second (2.3.1). The burst's total duration is 1.2 s with
  no looping; the banner stays until the person dismisses or navigates (2.2.2 needs no pause control).
- A celebration is a function of a **transition in this session** (`celebrationsFor` with the
  `celebrated` ledger), so a reload, a merge from another tab and a re-tick are all silent.
- `celebrate="off"` renders nothing for `GettingStartedCelebration` except the static complete
  line; the announcements still happen.

## 7. Interaction and accessibility contract

| Input | Result |
| --- | --- |
| Tab / Shift+Tab | through each step's checkbox, its Skip, and its action, in reading order; collapsed bodies' controls are not tabbable |
| Space on a checkbox | toggles done (native) |
| Space or Enter on an `aria-disabled` (locked) checkbox | does not toggle; the polite region says "Pick a date first, then this step" and focus stays |
| Enter / Space on the step header | opens or closes its body (`aria-expanded`) |
| Skip (optional steps) | marks skipped; announced; Undo is the same control relabelled "Do this step" |
| Hide (with `dismissible`, when complete) | removes the list from the layout; focus moves to the nearest following focusable in the page and the polite region says "Checklist hidden" |

- Structure: `section` named by its title; the list is an `<ol>` (order matters) named by the
  title; groups are `h3`-headed lists; the progress element is a `Progress` with
  `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext` "3 of 7 steps done".
- A **locked step is `aria-disabled="true"` and focusable**, not `disabled`, with its reason as
  visible text referenced by `aria-describedby`. The reason names the step it waits for.
- Live regions: one polite, atomic region; at most one message per change (`announcementFor`),
  coalesced 400 ms; nothing on first render; the save failure is its own `role="status"` line.
  Per-percent progress is never announced.
- Focus: completing a step does not move focus; the next step's body may open but focus stays on
  the checkbox just used. Dismiss is the only focus move (above).
- State is never colour alone: done = check icon + "Done" text for assistive tech, skipped =
  dash icon + "Skipped", locked = lock icon + reason, next = arrow + "Next". Contrast AA in
  light, dark and `contrast-more`; target size 44 px; reading order equals visual order at 320 px
  (`@container`, `MIN_VIEWPORT = 320`); logical properties for RTL.
- Static projection (principle 6): with nothing moving and no storage, the markup is an ordered
  list of titles with done marks and a progress bar with words; the server render of
  `defaultValue` is that list.

## 8. Test plan

### 8.1 Pure model (`__tests__/getting-started-model.test.ts`, added to the coverage glob at 100)

Table tests for every function in §4; `parseChecklist` rejects duplicate ids, unknown `after`,
cycles (including self-loops and a 3-cycle), zero or negative weights, a list of only optional
steps; weights shift progress correctly; an optional step never changes progress; skipping an
optional step unlocks its dependants; `complete` of a locked step is a no-op returning the same
object; `activeDays` is append-only across complete/uncomplete/complete; `celebrationsFor`: each
key once, `complete` outranks a milestone it crosses, unticking then re-ticking is silent,
`milestonesCrossed` boundaries (24→25, 25→25, 74→100 crosses 75 and completes);
`pace` boundaries (exactly at capacity, due today, due yesterday, no `dueAt`, time zone edges
with `dayKey`); `parseSnapshot` against a hostile corpus (`__proto__`, `NaN`, `Infinity`, `-1`,
huge arrays, wrong types, v2); **property tests** (a seeded generator, 500 cases, seed printed)
for merge: commutative, associative, idempotent, never loses a `celebrated` or `activeDays`
entry, and "newer unticked beats older ticked".

### 8.2 Component (`__tests__/getting-started.test.tsx`, injected `now`, `memoryStore`, matchMedia stub)

Renders from `definition` with no children and with composed parts; locked reason text and
`aria-disabled` focusability; activating a locked step does not toggle and announces; announce
text for step, milestone, complete and reopen, once each; first render silent; reload with a
populated store is silent (no celebration, no announcement); two tabs: `subscribe` merge updates
the view, reports `merge`, celebrates nothing; save debounce (one `save` for five fast changes),
flush on `pagehide`, failure line appears once, retry succeeds and clears it; `load` rejecting;
`localStorageStore` with `localStorage` throwing on read and on write; controlled mode ignores
`store`; `celebrate` off/quiet/full; **reduced motion**: with the media query matching, the
burst element count is **0** and `data-motion="reduced"`, and the banner text is present; loading
state reserves height (class lock on the shell); dismiss moves focus and announces; streak copy for
each of `played`, `pending`, `resting`, `none`, and that no string contains "lost", "broken",
"missed" (a copy lock over the default `labels`).

### 8.3 Browser stories as tests (existing storybook test job)

Keyboard-only path through a seven-step workshop list (Tab, Space, Enter, locked step, Skip,
complete); axe on every story with zero suppressions; baselines in light, dark, `contrast-more`;
a 320 px story; an RTL story; a story with the media feature forced to `reduce` that asserts no
element has a running animation (`document.getAnimations().length === 0`).

### 8.4 Deliberate-break proofs

| Break (by hand, then reverted) | Test that must fail |
| --- | --- |
| `complete` lets a locked step through | locked no-op case |
| `uncomplete` also removes the day from `activeDays` | append-only case |
| `celebrationsFor` ignores the `celebrated` ledger | re-tick and reload cases |
| the celebration effect runs on mount | reload-is-silent case |
| burst mounted without checking reduced motion | reduced-motion count is 0 |
| `quiet` also mounts the burst | `celebrate` mode case |
| locked checkbox is `disabled` instead of `aria-disabled` | focusable-locked case and keyboard story |
| merge takes the later `at` for `celebrated` instead of the union | merge property test |
| `parseSnapshot` trusts `__proto__` | hostile corpus |
| `localStorageStore` not wrapped in try/catch | throwing-storage case |
| saves not debounced | one-save-for-five-changes case |
| save failure announced on every retry | announce-once case |
| default labels gain the word "missed" | copy lock |
| `pace` uses `<` instead of `<=` | boundary case |
| step list rendered as `ul` | structure lock (`ol`) |
| loading shell has no `min-h` | CLS lock |

Plus the mutation lane (see `mutation-testing-room-logic`): `getting-started-model.ts` joins its
scope when it merges, and its first full run is part of the build's definition of done.

## 9. Storybook stories (`apps/storybook/src/stories/patterns/GettingStarted.stories.tsx`)

`Default` (minimal, no children), `WorkshopHost` (seven steps in three groups, a due date four days
out, streak on, local store), `Empty`, `HalfWay`, `Complete` (quiet), `CompleteFull` (burst),
`CompleteReducedMotion`, `LockedSteps`, `OptionalSteps`, `WithDueDate` (on-track, behind, overdue
as three stories with a fixed `now`), `StreakRestDays`, `Loading` (a store that never resolves),
`SaveFailing` (a store that rejects, then succeeds), `TwoTabs` (two instances on one store),
`Dismissible`, `Mobile320`, `Rtl`. The workshop story's step action for "Test the room" renders
the app's own button; the docs page says it can open the room kit and that neither depends on the other.

## 10. Performance and size

Client component; the burst is lazy and absent in `quiet`; the model has no React import.
Rerender: one memoized context value; step rows are `memo`ed by `id` and state, so one change
renders at most the changed row, the header and the live region (a render-count test locks it).
Budgets to be **recorded at first build, then ratcheted**: gzip size of model + component, render
count per change at 7 and 50 steps. No number is published before it has a command and a date.

## Out of scope

Step auto-detection, tours, tooltips, spotlight overlays, notifications, email, a server store,
XP and levels, badges, leaderboards, reset-with-confirm, drag-to-reorder, analytics events (the app
wraps `onCelebrate` and `onValueChange`), calendar integration (the kit's `reminder-model` exists).

## 12. Open questions, each with the default the build agent takes

| Question | Default |
| --- | --- |
| Ship XP and levels (`progress-model`) now? | No; one prop later. A reward economy is a separate decision. |
| Is `capacityPerDay` 2 right? | Yes as a documented knob; the number is the app's, never a claim. |
| Should a missed day ever change copy? | No: `pending` says what to do, never what was lost. |
| Streak counts any step done that day, or only required steps? | Any step (`activeDays` is written on every complete); an app that wants otherwise passes its own snapshot. |
| Un-skipping: allowed? | Yes, as "Do this step". |
| Burst particle count and palette? | 16, from `--primary` and `--accent` tokens, no raw colours. |
| Where does the dismissed state live? | In the snapshot (`dismissed`), so it syncs. |
| Group progress shown per group? | Yes, in the group heading as text ("2 of 3"), no second bar. |
| Add to the registry app's `getting-started` docs page as a dogfood? | Not in this change; offer it as a follow-up once installed in a scratch app. |
