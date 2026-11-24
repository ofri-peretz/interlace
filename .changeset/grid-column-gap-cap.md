---
"@interlace/ui": patch
---

`Grid`'s column gap never takes more than one track's share of the width (100% / cols). Gaps are in rem and grow with a reader's text size; at 150% on a 390px phone, eleven 36px gaps in a 12-column grid came to 396px in a 342px column and pushed every section sideways. The row gap and every step's value are unchanged, and on a phone at 100% the cap never bites. On wider screens it trims `xl` and `2xl` only where eleven of their gaps would overflow. A `gap-*` className still replaces it.

Components: grid
