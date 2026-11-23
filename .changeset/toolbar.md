---
"@interlace/ui": minor
---

New Toolbar: a row of controls that is one stop in the Tab order. Tab enters on the control used last and the next Tab leaves the whole bar; inside, the arrow keys move between controls, Home and End jump to the ends, and focus wraps, so a keyboard user no longer Tabs through every button of a formatting bar or a table's bulk actions. Built on Base UI's Toolbar: buttons take Button's `variant` and `size` (ghost, icon-sm by default), any trigger joins through `render` (`<ToolbarButton render={<Toggle />} />`), a disabled button stays reachable so its label can be read, and the bar wraps at 320px. Parts: Toolbar, ToolbarButton, ToolbarLink, ToolbarGroup, ToolbarSeparator, ToolbarInput.

Components: toolbar
Kind: Feature
