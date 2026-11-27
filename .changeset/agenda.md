---
'@interlace/ui': minor
---

A running order for live sessions. `Agenda` is the presenter's console: the item that is on, a clock that counts down and then counts over in the warning tone and in words, the presenter's notes, how far the session has drifted from the plan and when it will end at this pace, and Back, Pause, Add a minute and Next. With `shortcuts`, a presentation remote moves it on (Page Down, Page Up, arrows, `p`), except while typing. `AgendaNow` is the room's view of the same state: what is on, the time left and what comes next, with `size="stage"` for a shared screen. The state is pure and made of timestamps (`games/agenda-model`: `createAgenda`, `applyAgendaEvent`, `agendaStatus`, `formatClock`), so a refreshed tab or a late screen reads the right clock at once, and `next` and `back` name the item they move from, so an event delivered twice moves once. The bar empties in one linear transform animation; under reduced motion nothing moves.

Components: agenda
