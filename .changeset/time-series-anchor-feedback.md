---
'@interlace/ui': patch
---

TimeSeries — the first mark stays visible, and Space is documented

Components: time-series

Two review findings from the consumer side.

Tapping once left no visible trace: the pointer leaves, `cursor` goes null, and
the whole marker disappeared with it. For touch that is the normal state
between the first tap and the second, so a touch user had no sign their mark
had registered. The selection was always kept in state; only the evidence was
missing. The anchor edge is now drawn whether or not a second edge exists.

The accessible name promised Enter but Space has always worked too, so the key
existed for anyone who guessed it and nobody else.
