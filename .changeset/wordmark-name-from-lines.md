---
'@interlace/ui': minor
---

`Wordmark` with an `href` can now be named by its lines. `label` is optional on a link: leave it out and the link's accessible name is the `Wordmark.Line`s in order, each read in its own `lang`, with an optional visually hidden `hint` (", home") after them. A multi-script wordmark whose `label` did not contain its lines failed WCAG 2.5.3 (Label in Name; axe `label-content-name-mismatch`), and the `SeveralScripts` story and unit test used exactly that form. A `label` that does not contain every line now logs one development warning. Without `href` nothing changes: `label` is required and names the `role="img"`. The `Wordmark` "Name" section and the `Topbar` `logo` note state the rule.

Components: wordmark, topbar
