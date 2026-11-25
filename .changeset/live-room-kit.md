---
'@interlace/ui': minor
---

A live room kit for game nights on one big screen and everyone's phones. `QrCode` draws a join link as one SVG path from a dependency-free encoder (`games/qr-model`: byte mode, versions 1 to 40, levels L to H), and keeps dark-on-light on a dark page so every camera reads it. `JoinCode` shows the address, a code no one misreads (`makeJoinCode`, `normalizeJoinCode`, `formatJoinCode`) spelled out for screen readers, the QR and a copy-link button. `useRoom` keeps the host and every player on the same room: the host applies events with the pure rules in `games/room-model` (no joining a locked room, one answer a round, only the host starts) and sends the state to all, over any `RoomTransport`; an in-memory hub and a BroadcastChannel transport ship, and a realtime service is a small adapter in the app. `RoomLobby` (players pop in and are announced, the host can remove one), `RoomHostControls` (start, reveal, next, podium, lock, end, moving on by itself), `RoomCountdown` (3, 2, 1, Go to a host timestamp) and `Podium` (top three rising 3rd, 2nd, 1st with a burst for the winner, everyone else below) complete it. Every word goes through `labels`; all motion is transform or opacity and off under reduced motion.

Components: qr-code, join-code, live-room, podium
