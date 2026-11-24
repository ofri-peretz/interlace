---
'@interlace/ui': minor
---

`Prose` takes a `labels` prop (`{ table, code }`) for the names it gives a table or code block that scrolls sideways, so a site in Hebrew, Arabic or any other language no longer gets English screen-reader names. Pass part of the set and the rest keep the English default. A change of labels, such as a language switch, renames blocks already marked. The per-element logic moved into small helpers; behaviour is otherwise unchanged.

Components: prose
