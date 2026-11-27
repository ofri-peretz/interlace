---
'@interlace/ui': patch
---

Keyboard focus now shows in forced colours mode (Windows Contrast themes). Controls drew their focus ring as a box-shadow and removed the outline with `outline-none`, which in Tailwind v4 removes it in every mode; forced colours drops box-shadows, so a focused control showed nothing (WCAG 2.4.7). They now use `focus-visible:outline-hidden`: the same in a normal page, a 2px system-colour outline on keyboard focus in forced colours. `forced-colors-focus-lock` keeps `outline-none` out.

Components: chart-frame, choropleth-map, dot-plot, seat-chart, share-chart, breakout-room, pair-talk, round-summary, team-board, article-card, carousel, dialogue-stepper, dialogue, focus-grid, multi-step-form, photo-upload-crop, prev-next-post, time-slot-picker, accordion, button, button-variants, toolbar, calendar, card, checkbox, choice-card, code-block, code-editor, collapsible, combobox, command-palette, drawer, focus-ring, input, number-field, otp-field, prose, radio-group, reading-settings, scroll-area, select, skip-link, slider, switch, tabs, tag, textarea, theme-switcher, toast, toc, toggle, wordmark
