---
'@interlace/ui': minor
---

Live rooms close the door on time and on guessers. `createRoom` takes `codeExpiresAt`: after it, the room refuses new players with `expired` while anyone already in can still reconnect, and the host moves it with an `extend-code` event. `useRoom` now stamps each join with the host's clock, like answers, so a phone cannot beat the expiry by setting its clock back, and a join that arrives unstamped while the room has an expiry is refused. `checkJoinAttempt` / `recordJoinAttempt` (games/room-model) cap wrong codes per source (5) and per room (30) in a sliding window (10 minutes), so a six-character code cannot be guessed while a person who mistyped is never stopped. `JoinCode` takes `expiresAt` and says how many minutes the code still works; once it has expired the QR goes, the code is struck through and the change is announced.

Components: live-room, join-code
