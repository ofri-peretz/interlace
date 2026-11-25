---
'@interlace/ui': minor
---

Live rounds reach every phone. `games/room-model` gains `RoomState.prompt` and `RoomState.solution`: the host's `question` event can carry what the round asks (`prompt`) and its `reveal` the answer (`solution`), so every screen, and a player who joins mid-round, shows the same round without a second channel. Both are null in the lobby, cleared by the next question and by `restart`. `AnswerPad` is the player's side of a live round: big lettered tiles, the first pick final, "Answer in" while the host waits, then the right tile marked and the outcome in words. It never needs the right answer before the reveal, its state follows from `value`, `closed` and `correct` (so a reconnect shows the same thing), `display="keys"` shows letters only for rooms that keep the words on the big screen, and `choiceKey(i)` gives the big screen the same letters. Keys A to Z and 1 to 9 pick a tile; motion is transform only.

Components: answer-pad, live-room, join-code
