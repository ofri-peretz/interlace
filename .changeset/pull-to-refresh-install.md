---
'@interlace/ui': minor
---

Two more pieces for app-like pages. `PullToRefresh`: pull a list down from its top to load what is new. The pull is damped like a spring, arms at `threshold` (the arrow flips), and a spinner holds until `onRefresh` settles; "Refreshing", "Updated" or "Could not refresh" is said in a live region. It starts only at the top of the page, for one finger moving down more than across, and holds back the browser's own pull-to-refresh while it runs. The gesture always has a twin, a Refresh button, visible where the pointer is a mouse and reachable by keyboard and screen reader everywhere (`button="hidden"` when the page has its own). Under reduced motion nothing moves. `InstallPrompt` offers to add the site to the home screen only where it can work: Install opens the browser's dialog (`beforeinstallprompt`), Safari on iPhone and iPad gets the Share then Add to Home Screen steps, and nothing shows in an installed app, after an install, or for `dismissDays` after Not now. `useInstallPrompt()` gives the same state to a control of your own. Every word goes through `labels`.

Components: pull-to-refresh, install-prompt
