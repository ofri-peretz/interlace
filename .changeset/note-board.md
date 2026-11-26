---
'@interlace/ui': minor
---

A shared board of sticky notes in columns. `NoteBoard` holds a retrospective ("Keep / Change / Try"), an affinity sort or a "before / during / after" map: people post a note into a column after the room's text checks, and the room sorts notes by moving them between columns. Each note's move buttons name the column they lead to, focus stays on the note that moved, the move is announced, and the note glides to its new place. `games/note-board-model` folds posts and moves into the board (`foldBoard`), so every screen agrees whatever order events arrive in and however often one is delivered.

Components: note-board
