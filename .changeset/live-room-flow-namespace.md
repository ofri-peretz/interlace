---
'@interlace/ui': minor
---

The live room is now a flow with one namespace: `LiveRoom.Lobby`, `LiveRoom.Countdown` and `LiveRoom.HostControls`, so typing `LiveRoom.` lists the whole journey and every app writes it the same way. `useRoom`, `useSecondsLeft`, the label and prop types stay flat (now `LiveRoomLobbyProps`, `LiveRoomLobbyLabels` and so on). The header carries a flow map: each phase of the room, the part that shows it on the host screen and on a phone, and the event that moves it on. The live room has not been released yet, so the flat `RoomLobby`, `RoomCountdown` and `RoomHostControls` names go without a deprecation step. The rules for flows are in `docs/philosophies/FLOW_PHILOSOPHY.md`, and a new lock test holds them.

Components: live-room
