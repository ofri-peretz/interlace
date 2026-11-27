# Spec: workshop activities on a live room

Status: draft for acceptance at Design→Build. Intent: [intent.md](./intent.md).
Read against `origin/main` and the open pull requests on 2026-11-26.

## 1. Files (`packages/ui/src/games/`)

| File | What | Environment |
| --- | --- | --- |
| `room-activity-kit.ts` | Guards that read a room's slice as untrusted data (`isRecord`, `finite`, `isStr`, `isId`, `safeKey`, `cleanLabel`, `presentIds`). | any |
| `debate-corners-model.ts` | Corners, `tallyCorners`, `cornersActivity` (the rule), `readCorners`. Pure. | any |
| `exit-ticket-model.ts` | Questions, `npsBand`, `summarizeNps`, `summarizeTicket`, `exitTicketActivity`, `readExitTicket`. Pure. | any |
| `check-in-model.ts` | Moods, `summarizeMoods`, `moodShift`, `checkInActivity`, `readCheckIn`. Pure. | any |
| `sound-cues-model.ts` | `stepCues` (which cue, if any), `CUE_NOTES`, `createCuePlayer` over a small audio interface. Pure but for the audio it is given. | any |
| `use-workshop-activities.ts` | `useRoomCorners`, `useRoomExitTicket`, `useRoomCheckIn`: props for the components from a room. Reuses `useSubmit` from `use-live-activities`. | browser |
| `use-sound-cues.ts` | `useSoundCues(room)`. | browser |
| `debate-corners.tsx`, `exit-ticket.tsx`, `check-in.tsx`, `sound-cue-toggle.tsx` | The components. | browser |

## 2. Room rules

Each activity is an `ActivityReducer` under its own key (`corners`, `exit-ticket`, `check-in`).
A phone's move arrives as a `submit` event, so it is applied once and sent again until the host shows it.

| Activity | Host only | A phone |
| --- | --- | --- |
| corners | `start`, `lock`, `call`, `clear` | `pick` (any time while open, moves its own pick) |
| exit ticket | `start`, `close`, `clear` | `send` (the whole ticket; a second send replaces the first, until closed) |
| check-in | `start`, `round`, `open`, `clear` | `pick` (in the newest round, until closed) |

A move that is not the shape of one, or that names an id the slice does not have, is refused
`bad-action`. Readers drop whoever is no longer in the room and treat the slice as untrusted.

## 3. Sound cues

`stepCues(state, view, now)` returns the new watching state and a cue or null. The first state seen
plays nothing; a state with `seq` not above the last seen plays nothing; changes that arrive together
play the last one once; joins play at most once per `joinGapMs`. Sound is off until a switch is turned
on from a tap; every cue has a word (`CUE_LABELS`) written in a polite live region by `SoundCueToggle`.

## 4. Privacy

Picks and answers are held by player id in the room's `shared` state so a person can move or resend.
Screens show counts, never names. The state is visible to a client that reads it directly; hiding who
chose what from a determined phone would need a server, which this package does not have (stated, not
solved).

## 5. Risks

- Face icons are the consumer's (`faces`): the kit ships none.
- `AudioContext` needs a tap on mobile: `setEnabled(true)` is called from the switch's click.

## Out of scope

- Open text on any of these (it would need the moderation queue), audio files, a hosted transport
  adapter, and wiring any of it into a site.
- Virtual space (the catalog says skip for in-person sessions).

## Rejected alternatives

- One shared "choice" rule behind all three activities: corners lock and call, the ticket takes a
  whole set of answers, the check-in keeps rounds. A shared rule would have needed a flag for each.
- Emoji glyphs for the faces: they draw differently on every platform. The faces are the consumer's.
