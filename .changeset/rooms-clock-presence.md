---
'@interlace/ui': minor
---

Live rooms hold up on real phones. Every state the host sends carries its clock, and `useRoom`
returns `now`, this device's clock corrected to the host's (`clockOffset` in room-model), so a
phone whose clock is off still counts down to the host's deadline; `TimerRing` takes `now` too.
A player's page now says it is away on `pagehide`, asks for the room again when it is seen, and
rejoins by itself when shown away, unless the player left on purpose (`presence: false` turns it off).

Components: live-room, room-model, timer-ring
