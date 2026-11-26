---
'@interlace/ui': patch
---

Focus rings are drawn at full strength with one recipe: a 2px ring in `--ring` with a 2px gap in the page colour, the same weight as the preflight outline. Before, most controls drew a 3px ring at 50% or 60% of `--ring`, which measured 2.5:1 against the light themes (WCAG 1.4.11 asks 3:1), and a destructive button focused at 20%, which measured 1.4:1. Inputs, selects, buttons, tabs, checkboxes, switches, dialogs, sheets, drawers, toasts, menus and the patterns built on them now all focus alike, and the ring sits outside the control instead of over its edge.

Components: accordion, badge, banner, button, checkbox, combobox, command-palette, dialog, dialogue, dialogue-stepper, drawer, focus-grid, input, otp-field, radio-group, scroll-area, scroller, select, sheet, switch, tabs, textarea, toast, toolbar, topbar-menu, wordmark
