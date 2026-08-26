---
"@interlace/ui": patch
---

CodeBlock — dead header conditional removed, docs match behavior

Components: code-block

`Boolean(title) || Boolean(language) || true` never evaluated its left
side and the file docs still described a header that could be omitted.
The header ALWAYS renders (the copy button needs a home); the code and
both doc blocks now say exactly that. No runtime change.
