---
'@interlace/ui': minor
---

More contrast: an AAA reading mode on top of every theme.

Interlace is AA in every theme. For readers who find that hard to read, the base CSS now carries a more-contrast mode, which lifts every text pair to 7:1 and every line to 3:1, on any theme and in both schemes. It turns on by itself when the reader's system asks for more contrast (`prefers-contrast: more`), or when the page sets `data-contrast="more"` on `<html>` or on any region. `data-contrast="normal"` opts a page out of the automatic switch.

- Secondary text takes the full foreground.
- Muted, accent and secondary surfaces become a faint tint of the foreground.
- Primary becomes foreground on background. To keep a brand colour, re-point `--primary` inside `[data-contrast='more']` with a pair measured at 7:1.
- Status colours deepen until their text clears 7:1, both as text and as a filled chip.
- Borders and inputs darken, and the focus ring takes the foreground. With `data-contrast="more"` it becomes a 3px outline, 2px outside the element.

A new lock, `contrast-more-lock`, recomputes every pair for every theme.

Components: interlace-base

Kind: Feature
