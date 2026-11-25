# Flow Philosophy

A focused sub-philosophy of [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md), for surfaces an app adopts whole.

A component is something an app places. A flow is something an app adopts: the lobby, the
countdown, the rounds and the podium of a live room; the steps of a booking; the methods,
the code and the error of a sign-in. Interlace serves the two differently, because they fail
differently. A component goes wrong one control at a time. A flow goes wrong when every app
assembles its own version of the same journey, with its own gaps between the screens.

`packages/ui/__tests__/flow-contract-lock.test.ts` holds every rule here that a parser can
see. The rest is for review.

## 1. Is it a flow?

Call a surface a flow when at least two of these are true:

| Question                                                                  | A flow                           | A component                     |
| ------------------------------------------------------------------------- | -------------------------------- | ------------------------------- |
| Does the reader move through phases or steps?                             | lobby, countdown, round, podium  | a select opens and closes       |
| Does it arrange several Interlace components into one opinionated whole?  | lobby + timer + host controls    | a button with an icon           |
| Does it carry its own waiting, empty and error states between the phases? | "Waiting for the host", "Ended"  | a `loading` prop                |
| Does the app take the journey as it is, rather than placing a part?       | the order is Interlace's opinion | the app decides where it goes   |

Primitives, and most patterns, are components. Kits in `games/` and the booking and sign-in
patterns are usually flows. When it is close, decide in the PR and say why in the header.

## 2. How each is served

Escalate only when the step below cannot say what the surface needs:

1. **Props.** One concern, fixed structure: `<Button variant size>`.
2. **Props and slots.** One or two places to insert a node: `<Callout title={…} kicker={…}>`.
3. **Compound parts, flat.** Several parts of one interaction: `DialogTrigger`, `DialogContent`.
   This is the shadcn canon and stays flat ([CONVENTIONS.md](../../packages/ui/CONVENTIONS.md)).
4. **A flow.** The test in section 1 says flow. It gets a flow map and a journey (sections 5
   and 6), and its parts are served in one of two shapes (section 3): a namespace
   (`LiveRoom.Lobby`) or flat parts that share the flow's name (`MultiStepForm`,
   `MultiStepFormStep`). A flow the app drives entirely through props (`SocialSignIn`) is
   still a flow, with one part.

Props carry configuration: variant, size, state, labels. Composition carries structure: what
appears, and in what order. A prop that switches structure (`type="a" | "b"` that renders two
different trees) is a missing part. A flow that leaves the app to assemble what Interlace
should own is a missing flow.

## 3. One spelling per part: a namespace, or flat parts

Every part of a flow has exactly one name the consumer writes. Which shape that name takes is
set by one question: **can a server component compose this flow?**

React cannot read a property of a client module from a server component. Writing
`<MultiStepForm.Step>` in a server page throws "You cannot dot into a client module from a
server component". So:

| The flow is composed…                                               | Shape          | Example                                         |
| ------------------------------------------------------------------- | -------------- | ----------------------------------------------- |
| only in a client component, because its state lives in a hook      | **namespace**  | `LiveRoom.Lobby` (the room needs `useRoom`)     |
| possibly in a server component (fields, turns, steps as server JSX) | **flat parts** | `MultiStepForm`, `MultiStepFormStep`, `DialogueStep` |

A namespace lists the whole journey when you type the name and a dot:

```tsx
import { LiveRoom, useRoom } from '@/components/ui/games/live-room';

<LiveRoom.Lobby players={room.players} join={<JoinCode code={room.code} />} actions={controls} />
<LiveRoom.Countdown startsAt={room.startsAt} size="stage" />
<LiveRoom.HostControls room={room} send={send} />
```

Flat parts share the flow's name as a prefix where they can, so the editor's completion still
groups them, and the flow map lists them all.

Either way:

- **No second path.** A part is never exported both ways. Two spellings of one part become two
  dialects across apps, and the extra one freezes the internals as public API.
- **Hooks, models and types stay flat.** `useRoom`, `room-model.ts`, `LiveRoomLobbyProps` and
  the `*Labels` interfaces are not parts.
- **The display name is what the consumer writes.** `LiveRoomLobby.displayName =
  'LiveRoom.Lobby'`, so React devtools and the Storybook source panel show the code as typed.
- **Each part is written out.** No factory mints parts; "go to definition" lands on the code.
- **Names say what the part is on the screen.** `Lobby`, `HostControls`, `Summary`; never
  `Column`, `Stack` or `Wrapper`, and never a part that only re-exports a primitive. If a
  reader cannot place the part on the screen from its name, rename it.
- **A shared piece stays itself.** `Podium`, `TallyBars` and `QuizQuestion` are game
  components that several flows use. The flow map names them; the flow does not wrap them.
  Wrap a shared piece only when the flow pins something about it (its defaults, its wiring),
  and then name the part for that role.

Changing a released flow's shape, or a released component's export shape, is breaking: a
major changeset with a `Migration:` note.

## 4. Interlace owns the shape, the app owns the run

| Interlace owns                                    | The app owns                                     |
| ------------------------------------------------- | ------------------------------------------------ |
| The phases and the part that shows each one       | Where state lives (memory, a store, a server)    |
| Layout, motion, accessibility, the 320px floor    | The network: the `RoomTransport`, the API calls  |
| The rules, as a pure model (`*-model.ts`)         | Routing between screens and URLs                 |
| Default words, all replaceable through `labels`   | The real copy, the data, and what each event does |

Parts are controlled: state comes in as props, every action leaves as a callback or an event,
and loading, empty and error are states of the part, not a check the app writes around it. The
model is the flow's specification. It is pure, so a server can run the same rules, and it is
tested to 100%.

## 5. The flow map

The header of a flow's file carries a `## Flow` section with a table: each phase, the part that
shows it on each screen, and the event that moves it on. Example from `live-room.tsx`:

```
| Phase     | Host screen                  | Player phone         | Leaves by (event)          |
| lobby     | LiveRoom.Lobby with JoinCode | LiveRoom.Lobby       | Start → `countdown`        |
| countdown | LiveRoom.Countdown           | LiveRoom.Countdown   | its deadline → `question`  |
| …         |                              |                      |                            |
```

Write the map before the parts. A phase with no part in it is a screen the app will invent.
A part with no phase is surface nobody asked for.

## 6. How a flow is tested

| Layer               | What it proves                                                   | Where                                       |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| Model               | every transition, and every event refused, at 100% coverage      | `__tests__/<flow>.test.tsx`, model section  |
| Each part alone     | every part renders from a fixture state, with no flow around it  | the same test file, one `describe` per part |
| A story per part    | each part on its own, checked by axe; the first in every mode    | `<Flow>.stories.tsx`, the visual matrix     |
| The journey         | the whole flow, start to end, through real clicks                | the `Journey` story's `play` function       |
| The contract        | one spelling per part, display names, the map, the journey      | `flow-contract-lock.test.ts`                |

Tests and analytics select by `data-slot` (`room-lobby`, `room-host-primary`) and by the
state attributes a part sets (`data-phase`, `data-state`), never by class or DOM path. Every
part spreads its props onto its root, so an app's own `data-testid` lands where it expects.

## What is not a flow

`SignInMethods` (the list of linked sign-in methods on an account page) is one list with a
confirm step per row: one phase, so it is a component.
