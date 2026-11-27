# Intent — the rest of a workshop's open-voice moments run on a live room

**Status:** review · **Opened:** `2026-11-26`

Asked for by Ofri in chat, from the owner's interactive workshop catalog (36 activity types). Not
accepted: a human accepts at Design→Build and at Deploy.

## Why now

#243 shipped eighteen live activities, #247 teams, breakouts and pairs, #266 the submit/acknowledge
layer. Checked against the catalog, what is left that a workshop notices is small and specific: a
place to stand and defend a position, a feedback ticket with the standard recommend score, a face
check-in people can do while the room fills, and sounds for the big moments.

## What is wanted

Four activities, on the room's own state and transport (`submit` from #266), neutral (no product's
name, copy or colours; a brand arrives through CSS variables):

1. **DebateCorners** (catalog: Debate corners): a statement with two to four positions; each person
   picks a corner and may move until the host locks it; the host calls one corner at a time to defend.
2. **ExitTicket** (catalog: Exit ticket, NPS scale): three quick questions (a 0 to 10 recommend score
   with promoter, passive and detractor bands and the score, a rating, a choice), changeable until the
   host closes it, numbers shown only once enough people have sent theirs.
3. **CheckIn** (catalog: Emoji check-in, Lobby game): a face check-in that works in the lobby, asked
   again later so the room's mood shift can be shown.
4. **SoundCueToggle** with `useSoundCues` (catalog: Sound and music cues): short cues for join,
   countdown, question, reveal and podium, off until a person turns them on, each also written as words.

## Constraints

- Packages never services, zero new dependencies (the cues are Web Audio tones, no files).
- No second implementation of #243's, #247's or #266's: `submit`, `acked`, `shared`, `useSubmit` are used.
- Nothing a person typed reaches the screen: all four take taps and numbers only, so none needs the
  text-safety layer.

## Success criteria

For each of the room activities: reconnect, a late joiner, a host that refreshes, 40 players, a move
delivered three times, a move lost on the way, messages late, twice and in reverse, a removed player.
For the cues: nothing plays for a state a screen loaded into, a repeated or older state, or while off.
Keyboard alone, spoken updates, and reduced motion. 100% coverage of the new models. Every new test was
shown failing against a deliberately broken version first (the PR lists the breaks).

## Out of scope

- Virtual space (the catalog says skip for in-person sessions), collaborative board and map pin (built
  in #243).
- Open text on any of these: a typed comment would need the moderation queue.
- Audio files and music; only short synthesised cues.
- A hosted transport adapter and wiring any of this into a site.
