---
'@interlace/ui': patch
---

Nothing scrolls sideways at 150% text on a phone any more for the hover card, OTP field, scorecard row and dashboard template. Widths set in rem grow with the reader's text size, so a `max-w-80` hover card reached 480px on a 390px screen. The hover card now caps at the space Base UI reports (`--available-width`), OTP boxes shrink to share the row, the scorecard header wraps its score under the name, and the dashboard template pads `px-4` on phones and `px-10` from `sm`.

Components: hover-card, otp-field, scorecard-row, dashboard-template
