# Intent — every live activity of #243 runs on a live room with the room's guarantees

**Status:** review · **Opened:** `2026-11-26`

Asked for by Ofri in chat, as the follow-on to #266.

## Why now

#243 shipped eighteen live activities as pure models and components. #266 put four of them (the Q&A
board, reactions, raised hands, the spectrum) on a live room: a move applied once, sent again until the
host shows it, restored for a late joiner and a refreshed host. The other fourteen still only work on a
page that holds their state itself.

## What is wanted

The same room side for the fourteen that are left: the rating, quadrant, pin on a picture, ranking, points
split, dot vote, prediction, typed answer, word cloud, open wall (with the reflections a person chooses to
share), note board, room goal and picture reveal. For each an activity rule the host runs, a reader that
treats what the room holds as untrusted, and a hook that gives the unchanged component its props.

## Constraints

- No second implementation of #243's: its pure models and components are used as they are, and nothing of
  theirs is renamed.
- Reuse #266's `submit` and `useSubmit`; no new transport or message.
- Typed text passes `checkText` on the host, whatever the phone did, and the open wall holds posts for review.
- Neutral: no product's name, copy or colours.

## Success criteria

For every activity where each person sends something: reconnect, a late joiner, a host that refreshes, 40
players, a move delivered three times, a move lost on the way, messages late, twice and in reverse, a
removed player, and a delayed repeat of an old move. For the two the host alone drives: reconnect, late
join, refresh, reordered messages, and a phone that tries to move them. Keyboard, spoken updates and no
animation are tested through the room with the components. 100% coverage of the new models. Every new
test was shown failing against a deliberately broken version first (the PR lists the breaks).

## Out of scope

- Anonymity (see the spec).
- A hosted transport adapter and wiring any of this into a site.
- Moderation by a second person (a co-host role).
