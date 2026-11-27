---
'@interlace/ui': patch
---

`PhotoUpload` keeps its hint at full strength when it is disabled or full. The whole drop zone used to dim, which took the hint ("or drag photos here, or paste", "You have added the most photos allowed") below 4.5:1 and failed the axe check; now only the controls dim, as they already did.

Components: photo-upload
