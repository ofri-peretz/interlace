---
'@interlace/ui': patch
---

`DailyPuzzle` no longer fades its first round in. The body's entry transition (`starting:opacity-0`) is meant for one round giving way to the next, but it also ran on first paint, so the question, often the page's largest paint, was invisible until the fade ended (LCP 5.0 s against 1.05 s on a throttled phone). The first round is now there at first paint; each round after it still rises in, and reduced motion is unchanged.

Components: daily-puzzle
