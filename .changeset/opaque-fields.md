---
'@interlace/ui': patch
---

Form fields paint their own opaque face and text colour, so they read on a brand band, an image or a dark hero. `Input`, `Textarea`, `Combobox` (input and chips), `Checkbox` and `RadioGroup` now use `bg-background` in both schemes instead of `bg-transparent` / `dark:bg-input/30`, and the text fields (and `NumberField`'s group) set `text-foreground` rather than inheriting the band's foreground. `ComboboxCompose` now warns once, naming them, when two items share a `value` (each value keys a row, so filtering and selection broke with no error).

Components: input, textarea, combobox, checkbox, radio-group, number-field
Kind: Fix
