# Intent — the room's audience activities survive a bad network and a refreshed host

**Status:** review · **Opened:** `2026-11-26`

Asked for by Ofri in chat after #243 merged eighteen activities; built in the PR that adds this file.

## Why now

#243's Q&A board, reactions, raised hands and spectrum are pure models and components: nothing sends
a phone's move to the host, applies it once, sends it again when it is lost, or brings it back after
the host refreshes. A workshop of 40 phones on a venue's wifi meets all of those in the first hour.

## What is wanted

A general player move (`submit`) on the live room, with a host that applies each move once, a phone
that sends it again until the host shows it, and several moves in flight at once. The four audience
activities run on it, and #243's components are used as they are.

## Constraints

- No second implementation of what #243 shipped: its models and components are the rules and the
  screens; this adds only the room side.
- No renamed export of #243's. Everything here is new.
- Neutral: no product's name, copy or colours.

## Success criteria

For each of the four activities, a test that fails on a deliberately broken version first and passes
on the fixed one: reconnect, a late joiner, a host that refreshes, 40 players, a move delivered
three times, a move lost on the way, messages reordered, and a removed player. Keyboard alone, one
spoken update, and reduced motion are tested through the room, not only on the component.
