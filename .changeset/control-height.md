---
'@interlace/ui': minor
---

Control heights are tokens now, with an opt-in comfortable density.

Button, Input, Select, Combobox, Toggle, Tabs, NumberField and ThemeSwitcher take their height from `--spacing-control-xs`, `-sm`, `--spacing-control` and `-lg`, through the new `h-control` and `size-control` utilities. The defaults are unchanged: 24, 32, 36 and 40px. Put `data-density="comfortable"` on `<html>` or on any region, and they become 32, 40, 44 and 48px, so the default control meets the 44px touch target. A brand can also re-point a single token, for example `:root { --spacing-control: 2.5rem; }`.

Components: button, input, select, combobox, toggle, tabs, number-field, theme-switcher, toolbar, pagination, skeleton

Kind: Feature
