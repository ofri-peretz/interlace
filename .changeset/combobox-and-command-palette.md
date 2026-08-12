---
'@interlace/ui': minor
---

New `Combobox` and `CommandPalette`.

`Combobox` mirrors `Select` part-for-part, plus one part that is ours rather
than Base UI's: `ComboboxControl`, a `relative` row. Base UI has no concept of
"the input plus the affordances docked inside its border", and without it
`ComboboxClear` and `ComboboxTrigger` sit beside the field instead of in it.
The root is aliased rather than wrapped so the `<Value, Multiple>` generics
survive at the call site.

`CommandPalette` is a composition, not a new primitive: `DialogContent`
supplies the portal, backdrop, focus trap, Escape and focus restore, wrapped
around `Combobox.Root` in **`inline`** mode. That flag is load-bearing —
without it the combobox handles Escape for a popup that is not open and the
dialog never closes, a WCAG 2.1.2 keyboard trap. `closeOnSelect` closes by
clicking a hidden `DialogClose` rather than calling `setOpen`, so it routes
through Base UI's own close path: `onOpenChange` fires with a real reason,
focus restores exactly as for Escape, and the uncontrolled case works.

The ⌘K binding is a separate opt-in hook. A design system should not seize a
global chord on mount from every app that installs it.

Three rows of the keyboard contract differ from `Select` and are the ones
callers get wrong: Home/End move the text caret rather than the highlight;
Escape on a *closed* popup clears the input and the selection; focus never
enters the list — it is virtual focus via `aria-activedescendant`.

Components: combobox, command-palette
