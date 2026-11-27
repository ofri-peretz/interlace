---
'@interlace/ui': minor
---

Four more things a workshop does, on the live room. `DebateCorners` puts a statement in front of the room with two to four positions: each person picks a corner and may move until the host locks it, and the host calls one corner at a time to defend (`cornersActivity`, `useRoomCorners`). `ExitTicket` asks up to five quick questions as people leave, among them a 0 to 10 recommend score grouped into promoters, passives and detractors with the score (`npsBand`, `summarizeNps`, `summarizeTicket`), changeable until the host closes it, with the room's numbers shown only once enough people have sent theirs (`exitTicketActivity`, `useRoomExitTicket`). `CheckIn` is a face check-in that works in the lobby and can be asked again to show how the room's mood moved (`checkInActivity`, `useRoomCheckIn`). `SoundCueToggle` and `useSoundCues` play short synthesised cues for someone joining, the countdown, the question, the reveal and the podium: off until a person turns them on, never for a state a screen loaded into or a repeated or older one, and each cue is also written as words.

All three room activities use the room's `submit` (applied once, sent again until shown, restored for a late joiner and a refreshed host); `useSubmit` is now exported from `use-live-activities`.

Components: debate-corners, exit-ticket, check-in, sound-cue-toggle
