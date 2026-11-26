---
'@interlace/ui': minor
---

Questions from the room, ranked by the room. `QuestionAsk` lets a phone send a question of up to `maxLength` characters (default 200) with a live counter, refuses unsafe text through `text-safety-model` with a reason, and thanks the asker differently when the room is moderated. `QuestionBoard` lists live questions, the pinned one first and marked "Answering now", with a vote toggle (`aria-pressed`, the count in its name) that is off for the viewer's own question; questions glide to their new rank when votes change and the count rises into place. `QuestionQueue` gives a moderator review, live and done lists with approve, dismiss, pin, answered and restore, each sending one event. The state is pure and exported from `games/question-board-model`: `createBoard`, `applyBoardEvent` (review → live → answered or dismissed, one vote per person, never on your own, per-person limits) and `rankQuestions` (pinned, then votes, then oldest).

Components: question-board
