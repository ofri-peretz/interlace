---
"@interlace/ui": patch
---

Tooling only: the room and game logic (`src/games`, `src/patterns`) is now mutation-tested. A control gate proves a weak test goes red and a strong one green, a ratchet keeps each floor from falling, and canary patches prove the known room bugs (a non-host sending a host event, a locked, expired or full room admitting a player, an answer accepted twice) are caught. No shipped component changes.

Components: none
