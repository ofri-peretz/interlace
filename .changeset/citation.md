---
'@interlace/ui': minor
---

New `Citation` pattern: an inline source marker for a sentence that makes a claim. A footnote number (or a dotted underline on the phrase itself) opens a popover listing every source behind the claim, with the publisher linked, the kind of source, and the quote as a blockquote. Several sources stack in one popover. Only `https:` URLs become links. Keyboard and touch work out of the box, Escape closes it, and the claim text is in the server HTML. An optional `status` shows "Enough sources" or a warning "Short of sources".

Components: citation

Kind: Feature
