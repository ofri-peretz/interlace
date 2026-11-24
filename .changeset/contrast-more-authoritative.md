---
"@interlace/ui": patch
---

More contrast now wins over a branded app. Brands declare their tokens unlayered on `:root`, as the guide says, and an unlayered rule beats any layered one, so on a branded site the mode quietly did nothing: grey secondary text and the brand's own primary stayed. Every token the mode sets is now `!important` inside `@layer interlace.semantics`, which beats unlayered rules, so a reader who asks for more contrast always gets it. A brand that wants to keep its accent in the mode sets `--contrast-primary` and `--contrast-primary-foreground` to a pair it measured at 7:1, and checks the tinted surfaces built from it (`text-primary` on `bg-primary/10`). contrast-more-lock now also checks that every mode declaration is important. The craft skill covers More contrast, density, and the focus ring's room.

Components: interlace-base
Kind: Fix
