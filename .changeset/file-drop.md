---
'@interlace/ui': minor
---

New FileDrop and AvatarUpload, for handing over files. `FileDrop` is a real file field drawn as a drop area: press it or drop files on it, see each file with its size, and take one back out. `accept`, `maxSize` and `maxFiles` are checked again on every pick and drop (the picker's filter only suggests, and a drop skips it), and a file that breaks a rule is turned away with the reason said in a polite live region, in words `messages` can replace. Removing a file moves focus to the next Remove button, or back to the field. `AvatarUpload` is a profile photo the reader can choose, change or remove, with a live preview; its value tells "new photo", "no photo" and "unchanged" apart for the save. The rules live in `file-model` (`acceptsFile`, `checkFiles`, `formatBytes`), pure, so a server can apply the same ones.

Components: file-model, file-drop, avatar-upload
Kind: Feature
