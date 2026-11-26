---
'@interlace/ui': minor
---

A live word cloud for rooms. `WordEntry` lets a phone send up to `maxWords` words (default 3), each checked before `onWord` fires; a refused word says why, and the viewer's sent words show as chips. `WordCloud` groups what the room sent by its folded form (case, accents and marks), shows the spelling most people used, sizes words on a square-root scale in five steps and puts the biggest in the middle, while the DOM stays in rank order with each word read with its count. Words glide to their new places through FlipGroup and a word that gained a vote pulses once; under reduced motion they simply take their place. `size="stage"` is for a shared screen. The rules are pure and exported: `games/word-cloud-model` (`buildCloud`, `centerOut`) and `games/text-safety-model` (`checkText`, `foldText`, `isBlocked`), which refuses empty text, overlong text, links, email addresses, phone numbers and words on the consumer's `blocklist` (whole words, through letter swaps and spelled-out letters). Interlace ships no word list.

Components: word-cloud
