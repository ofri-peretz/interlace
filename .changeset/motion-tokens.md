---
'@interlace/ui': patch
---

Every primitive and pattern now times its transitions with the motion tokens, so a brand that retunes `--duration-*` or `--ease-*` retunes all of them. Before, the toast, select and combobox popups, command palette and combobox rows, progress bar, article card image, flip card, guess reveal, social sign-in and focus grid kept literal timings (`duration-150`, `duration-[180ms]`, `ease-out`). With the default tokens the change is a few milliseconds: the flip card turns in 400ms instead of 500ms and the toast arrives in 150ms instead of 180ms.

Components: article-card, combobox, command-palette, flip-card, focus-grid, guess-reveal, progress, select, social-sign-in, toast
