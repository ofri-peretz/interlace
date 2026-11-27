---
'@interlace/ui': minor
---

The Q&A board, reactions, raised hands and spectrum now run on a live room with the room's guarantees. `useRoomBoard`, `useRoomReactions`, `useRoomHand` and `useRoomSpectrum` give the props for `QuestionBoard`, `QuestionAsk`, `QuestionQueue`, `ReactionBar`, `ReactionStream`, `RaiseHand`, `HandQueue` and `Spectrum` (unchanged), and `boardActivity`, `reactionsActivity`, `handsActivity` and `spectrumActivity` are the rules the host runs. A move is applied once however often it arrives, a phone sends it again until the host's state shows it (a reaction is sent once: a late reaction is no reaction), several moves can be in flight at once, a refreshed host gets everything back, and a player who is removed disappears from what every screen reads.

For that, `RoomEvent` gains `submit` (a player's move in an activity: `key`, `action`, and a unique `id`), `RoomState` gains `acked` (the last ids of each player's moves, kept through `serializeRoom` and `restoreRoom`), and `RoomSettings` gains `activities`, a map of rules by key. `useRoom` stamps a move with the host's clock and tells a phone why a move was refused. Existing rooms are unchanged.

Components: live-room
