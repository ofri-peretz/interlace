---
'@interlace/ui': minor
---

Two pieces for booking pages. `Calendar`: one month of days to pick one from, as the WAI-ARIA date grid (one tab stop; arrows by a day or a week, mirrored in RTL; Home and End; Page Up and Page Down by a month, with Shift by a year). Days are plain `YYYY-MM-DD` strings, so the day a reader picks is the day a server stores in every time zone. `min` and `max` bound it, `isDateUnavailable` strikes a day through and says so, `isDateMarked` dots the days that have room, and today carries `aria-current="date"`. Names come from `Intl` in `locale`, and the week starts where the locale starts it. A new month slides in from its side, six rows always, nothing below moves. `TimeSlotPicker`: the times open on one day as tiles on Base UI's radio group, read from `HH:MM` or ISO instants in `timeZone`, with `groupBy="period"`, a loading state and words for an empty day. The date arithmetic is pure and exported from `calendar-model`, the slot hours from `patterns/time-slot-model`. Every word goes through `labels`; every motion is transform or opacity and is off under reduced motion.

Components: calendar, time-slot-picker
