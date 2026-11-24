---
'@interlace/ui': minor
---

Reading settings for the reader: a text size control and a More contrast toggle.

`TextSizeControl` is a labelled group of three buttons: smaller, the current size (which resets), and larger. It sets the root font size to 100, 112, 125 or 150% of the browser's own default through `data-text-size` on `<html>`, so type, spacing, control heights and containers all grow together and the layout holds. At the ends the buttons stay focusable, so a keyboard user is never dropped to the top of the page.

`ContrastToggle` turns More contrast on or off. Off stores an explicit `normal`, which also overrides `prefers-contrast: more`.

`useReadingPrefs` is the hook behind both: it persists the choices, keeps every control in the document and every open tab in step, and follows the OS when nothing is stored. `THEME_SCRIPT` now restores both choices before first paint, so a returning reader never sees the page reflow. Every word in both controls is a prop.

Components: reading-settings, use-reading-prefs, theme-script, interlace-base

Kind: Feature
