---
"@interlace/ui": minor
---

RecallCard: a prompt the player answers in their head, then checks. Reveal opens the answer and moves focus to it; the ratings ("I had it", "Not yet", or your own two to four) appear only then, pressed and said in words. Controlled or uncontrolled; a details element holds the answer without JavaScript.

UpdateFeed: what is new, newest first, grouped by day or month under real time headings, each entry with a kind, a linked title and a line on what it is. Pass `since` and the entries after it are tagged "New" with a one-line count; a first visit marks nothing. Container-query layout, a `renderLink` seam for routers, and a pure model (`update-feed-model`) that sorts, groups and counts new entries for a badge.

Components: recall-card, update-feed
Kind: Feature
