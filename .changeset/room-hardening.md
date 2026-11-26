---
'@interlace/ui': patch
---

Room activities hold up after a reconnect. `buildCloud` counts an entry with an `id` once however often it arrives, and counts a sender (`by`) once per word, so a resent batch of words changes nothing. The hand queue's docs say to send `call` with `by`, so a call delivered twice calls one person. New tests replay a busy room of 60 with every event doubled, restore a board from a saved snapshot (a late joiner or a refreshed host), flood the reaction stream after a refresh, and place a spectrum dot with the keyboard alone.

Components: word-cloud, reactions
