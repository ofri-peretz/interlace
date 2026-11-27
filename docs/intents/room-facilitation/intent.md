# Intent — a facilitator can run a whole live workshop from the room kit

**Status:** review · **Opened:** `2026-11-26`

Asked for by Ofri in chat; built in the PR that adds this file.

## Why now

#243 landed eighteen live activities, but each is a piece on its own: nothing runs a workshop across
teams, breakouts and pairs, and nothing keeps a second presenter screen right through a refresh.

## What is wanted

The live room (`games/live-room`, `games/room-model`) runs a quiz night. A workshop needs more
than rounds: a presenter with notes and a clock, people in teams, people in groups that come
back, people talking in pairs. Four activities, on the room's own state and transport, neutral
(no product's name, copy or colours; a brand arrives through CSS variables):

1. **Presenter notes with an agenda timer, on a second screen.** `Agenda` (merged in #243) already
   has the notes, the timer and the shortcuts; what it lacked, and this adds, is the second screen:
   the same agenda in two windows, a repeated tap applied once, a refresh that keeps the clock.
2. **Team mode.** Assign players to teams (auto-balance, move by hand), team scores, team-colour
   tokens.
3. **Breakouts.** Split a room into groups with a timer, send one message to every group, recall
   everyone.
4. **Pair talk.** Pair players, a prompt card for each pair, swap partners, a timer.

## Constraints

Neutral (no product's name, copy or colours), packages never services, and no second implementation of
what #243 already shipped (its `Agenda` and group dealing are used, not copied).

## Success criteria

For every one of them: reconnect, a late joiner, a host that refreshes, 30+ players, a network that delays, repeats and
reorders messages, a keyboard alone, a screen reader (live regions), reduced motion. Each is a
test, and each test was shown failing against a deliberately broken version first (the PR lists
the breaks).

## Decisions

| Decision | Why |
| --- | --- |
| Teams, groups and pairs ride in `RoomState.shared`, written by one host `share` event, read back as untrusted data | They inherit what the room already proves: newest `seq` wins, a late joiner gets them with the state, a restored host restores them. A second channel would need all of that again. |
| `serializeRoom` / `restoreRoom` move `seq` ahead by 1,000 and bring every player back `away` | A host that restores a save written just before its last changes would otherwise send states every phone already holds newer ones of, and be ignored. `away` is the truth after a refresh; phones that are open rejoin by themselves. |
| Presenter notes do not ride in the room | They are for the presenter. `useAgendaSync` reuses the same `RoomTransport` (now typed by message) between the presenter's own windows. |
| A second screen's tap carries the `seq` it was made against and a unique id | A repeated message is applied once; a tap made against an older screen is dropped, and the screen is brought up to date, so a double tap never moves the agenda twice. |
| Moving a player is a native `<select>`, not a drag | Keyboard, switch and screen reader work without a second implementation. |
| Teams rank by average by default | Teams differ in size by one; a bigger team should have no edge. |
| A message to every group has a count; a phone shows (and so speaks) it only if newer | A repeated or late state must not be read twice. |

## Left out

- A transport adapter for a hosted realtime service: an app writes it (two functions).
- Dragging players between teams or groups.
- Saving the presenter's notes to a server: the notes live in the page that holds the agenda.
