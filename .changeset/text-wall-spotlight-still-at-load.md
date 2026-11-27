---
'@interlace/ui': patch
---

TextWall: a spotlight that is on the wall at load no longer fades in from opacity 0; only a later spotlight scales in, as the posts already did. The fade at load was what Storybook's axe run caught mid-way (2.33:1 contrast on the RightToLeft story).

Components: text-wall

Kind: Fixed
