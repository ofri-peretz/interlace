---
'@interlace/ui': minor
---

Motion tokens and a press, hover and overlay standard.

- New tokens in `structure/motion.css`: `--ease-enter`, `--ease-exit`, `--ease-move` (Tailwind utilities `ease-enter`, `ease-exit`, `ease-move`) and `--duration-fast` / `-base` / `-medium` / `-slow` (100 / 150 / 250 / 400ms, used as `duration-(--duration-fast)`). Override any of them on `:root` and the whole system follows.
- `Button` and `Toggle` answer a press: they scale to 0.97 while pressed (not under reduced motion), and time hover, focus and press with `--duration-fast`. A `link` button keeps its size.
- Dialog, AlertDialog, Sheet, Popover, Tooltip, DropdownMenu and ContextMenu ease in with `ease-enter` and leave faster with `ease-exit`. Sheet now opens in 250ms (was 500ms) and closes in 150ms (was 300ms).
- View transitions (`startViewTransition`, React `<ViewTransition>`, cross-document) take the tokens: 250ms with `ease-move`. Under reduced motion they are removed entirely, which the `*` clamp never reached. These are global rules, so they ship in `page/preflight.css` (part of `index.css`), not `base.css`.
- No component transitions every property any more: Switch, Accordion, Select, ArticleCard and HeroCosmic name the properties they animate.

Components: button, toggle, dialog, alert-dialog, sheet, popover, tooltip, dropdown-menu, context-menu, switch, accordion, select, article-card, hero-cosmic
Kind: Feature
