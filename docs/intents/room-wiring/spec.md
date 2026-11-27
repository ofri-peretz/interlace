# Spec: the rest of #243's live activities on a room

Status: draft for acceptance at Design→Build. Intent: [intent.md](./intent.md).
Read against `origin/feat/ui-room-activities` (#266) and the open pull requests on 2026-11-26.

## 1. Files (`packages/ui/src/games/`)

| File | What |
| --- | --- |
| `room-activity-kit.ts` | Guards that read a slice as untrusted data (shared with the workshop activities). |
| `live-collect-model.ts` | `collectActivity(spec)`: one answer per person, with the host's `start`, `open`, `clear`, `reveal`. The rating, quadrant, pin, ranking, points, dots, prediction and typed-answer specs, their readers. |
| `live-text-model.ts` | The word cloud, the open wall (review queue, spotlight) and the note board, with `checkText` on the host. |
| `live-host-model.ts` | The picture reveal and the room goal: the host's alone. |
| `use-room-activities.ts` | The fourteen hooks. Reuses `useSubmit`. |

## 2. Room rules

| Activity | Host | A phone |
| --- | --- | --- |
| rating, quadrant, pin, ranking, points, dots | `start` (the shape), `open`, `clear` (pin: `reveal`) | `send` one answer; a second replaces it while open |
| prediction | `start`, `open`, `clear`, `reveal` (closes it) | `send` once; the first stands |
| typed answer | `start`, `open`, `clear` | `send` text once, after `checkText` |
| word cloud | `start`, `open`, `clear` | `word`, up to `maxWords`, the same word once |
| open wall | `start` (moderated by default), `approve`, `dismiss`, `spotlight`, `open`, `clear` | `post`, up to five at a time |
| note board | `start` (2 to 6 columns), `open`, `clear` | `add` (up to ten), `move` (any note) |
| picture reveal, room goal | everything | nothing: a phone's move is refused |

A move that is not the shape of one, or does not fit the question the host started, is refused
`bad-action`. Readers drop whoever left the room, and re-check every answer against the host's question.

## 3. Choices

- The room's goal value is the room's own points (`RoomState.scores`), so the meter fills as the quiz is played.
- The typed answer's accepted answers stay with the consumer (`useRoomTypeAnswer` takes them), so the room
  never holds an answer the phones could read before the reveal; the host's `typedActivity` checks only
  the text's shape.
- A private reflection never reaches the room. A shared one is a wall post, so it is checked and reviewed.

## 4. Privacy

Not anonymous. The room holds each answer by player id (so it can be replaced, and removed with its
player), visible to the host and to a client reading the room's state. Screens show shares and no names.
Aggregating on the host does not fix this: the state is broadcast after every move, so consecutive states
show whose move changed which count.

## Out of scope

- Anonymity, a hosted transport adapter, a co-host role, and wiring any of it into a site.

## Rejected alternatives

- A rule per activity written out by hand: eight of them differ only in the shape of the answer, so one rule
  takes the shape as a spec.
- Putting `accepted` answers for the typed question in the room: the state is broadcast, so every phone
  could read them before the reveal.
