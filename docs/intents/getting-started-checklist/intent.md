# Intent — a getting-started checklist that makes progress feel real, and never nags

**Status:** review · **Opened:** `2026-11-26`

Written from Ofri's list of remaining design-system gaps; the spec is [spec.md](./spec.md). A human
accepts at Design→Build.

## What is wanted

One flow, `GettingStarted`, for any app that has a short list of things a person should do
before it is useful to them. It shows the steps, how far along they are, what to do next, and
a small, honest reward when they finish one. The motivating user is **a host preparing a
workshop**: pick a date, write the agenda, invite people, test the room, rehearse, run the day.
Nothing in the component says "workshop"; the steps are data the app passes.

1. **Steps with progress.** Required and optional steps, steps that unlock after others, groups
   ("Plan", "Prepare", "Day of"), a progress bar with words ("3 of 7 done"), and a clear next step.
2. **A pace, when there is a date.** "5 steps left, 4 days to go: on track", from a due date.
3. **A streak, if the app wants one.** Days in a row the person did something on the list, with
   rest days that never break it, reusing the kit's streak arithmetic. Off by default.
4. **Celebration that respects the person.** A tick that settles, a milestone line at 25, 50, 75
   percent, a finish moment. Under reduced motion all of it becomes still text. Never on a
   reload, never twice for the same thing, never a guilt message after a missed day.
5. **A persistence adapter.** The app passes `store`: `load`, `save`, optional `subscribe`.
   The kit ships memory and `localStorage` stores; a server store is the app's few lines.
6. **Keyboard and screen reader first.** A step that is locked still explains itself to a
   screen reader and to a keyboard user, instead of silently refusing.

## Why now

- Ofri listed it as a remaining gap on 2026-11-26. A search of `origin/main` the same day finds
  `MultiStepForm` and `DialogueStepper` (a form's own steps, a conversation's steps) but no list
  of independent tasks with progress; the registry app's `getting-started` page is a docs page,
  not a component.
- The games kit already holds the hard parts as pure code: `streak-model` (rest days, shields,
  "today is open"), `progress-model` (milestones crossed exactly once), `daily` (day keys in a
  time zone). A checklist that reuses them costs a model and a view, not a second set of rules.
- The live-room work (`room-facilitation`) is where a host's preparation happens. A checklist
  that stands alone but fits there is the practical shape: a step's action can be the app's own
  button into the room, with no coupling in either direction.

## Constraints

- **Gamification is honest.** Progress counts required steps only. Reward is for finishing a
  thing, never for a self-rating. A missed day is a plain fact ("Pick it up today"), never
  loss framing. Streak, levels and badges are opt-in; the default is progress, pace and a tick.
- **Motion has a static projection.** Every celebration has a still form that says the same
  thing in words. Nothing flashes (WCAG 2.3.1) and nothing loops (2.2.2).
- **Time is injected.** No hidden `Date.now()`; a test, an agent or a server replays any day.
- **Persistence never loses progress silently.** A failed save keeps state on the page, tells
  the person once, and retries; two tabs merge instead of overwriting.
- **No new dependency.** Reuse `Progress`, `Checkbox`, `Accordion`, `Button`, `GoalRing`'s
  tokens, `streak-model`, `progress-model`, `daily`. Confetti is CSS, and only in `full` mode.
- **Neutral.** No product nouns in props, types or defaults; example copy lives in stories.

## Decisions already taken (the spec carries the reasoning)

| Decision | Why |
| --- | --- |
| Steps are plain data (`ChecklistDef`), validated by a pure `parseChecklist` | An agent writes a checklist as JSON; cycles, duplicate ids and unknown dependencies are caught before render. |
| Snapshot holds `done`, `skipped`, `celebrated`, an append-only `activeDays` and `dismissed` | `celebrated` is why a reload never celebrates again; `activeDays` is why un-ticking a step does not erase a streak. |
| Merge is last-writer-wins per step, grow-only for `celebrated` and `activeDays` | Two tabs or two devices converge without a server deciding. |
| A locked step is `aria-disabled`, focusable, and says why in text | A `disabled` control is skipped by keyboard and unexplained to a screen reader. |
| `quiet` is the default celebration; `full` adds a short CSS burst | Most apps want the tick and the line; a burst is an opt-in. |
| No XP or levels in v1 | They imply a reward economy this component should not start; `progress-model` makes them a later one-prop addition. |

## Left out

- Detecting that a step is done (the app knows, and sets it, or the person ticks it).
- A server, a notification, an email nudge, a reminder (the kit's `reminder-model` already makes
  a calendar file; wiring it is the app's choice).
- A leaderboard or any comparison between people.
- A tour, tooltips, coach marks, spotlight overlays.

## Success criteria

- Registry install e2e passes; zero axe violations and suppressions on every story, in light,
  dark and `contrast-more`; reduced-motion story renders zero animated elements (counted).
- Model files enter the mutation scope at merge with a recorded floor (see
  `mutation-testing-room-logic`).
- No claim about completion rates or engagement until an adopter app measures one, with a date.
  A breach of any lock writes a new intent.

## Open questions

Listed with a default in `spec.md` §12.
