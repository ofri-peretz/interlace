---
'@interlace/ui': minor
---

A quiz round where people type the answer. `TypeAnswer` takes every accepted spelling, forgives case, accents, punctuation and a slip of a letter in a longer word (and spells the answer out when it did), and never forgives a different number. It runs on the same clock rules as `QuizQuestion`, with "Stop the clock", and running out sends whatever was typed. The reveal marks the field, says the outcome in a focused sentence, and shows what the room typed, folded together, with the right answer always given a row. `games/typed-answer-model` folds and matches answers (`normalizeAnswer`, `matchAnswer`, `editDistance`), scores them like a multiple-choice answer (`scoreTyped`) so both kinds of round share a leaderboard, and groups the room's answers (`groupTyped`).

Components: type-answer
