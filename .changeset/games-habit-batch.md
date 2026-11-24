---
'@interlace/ui': minor
---

Four new pieces for daily games and live quizzes. `Poll`: one question, one tap; the options turn into the results in place, bars growing to everyone's shares, the viewer's choice named, and `minVotes` keeping small polls private. `QuizQuestion`: big answer tiles you tap or pick with keys 1 to 9, an optional `timeLimit` drawn by the new `TimerRing` (with a "Stop the clock" button that always works and never pays more than racing), and a reveal that marks the right tile, says how you did and shows how everyone answered in the new `TallyBars`. `OrderGame`: put items in order by dragging a handle, the arrow keys or up and down buttons, then watch the rows travel to their right places with each value and where you had it. Dealing and scoring are pure and exported from `games/tally-model` (`tally`, `wholePercents`: percents that sum to 100), `games/quiz-model` (`scoreAnswer`) and `games/order-model` (`dealOrder`, `scoreOrder`, `moveItem`), so a server repeats them. Every word goes through `labels`; every motion is transform or opacity and is off under reduced motion.

Components: poll, quiz-question, timer-ring, tally-bars, order-game
