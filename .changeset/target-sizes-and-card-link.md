---
"@interlace/ui": minor
---

Comfortable density reaches the small links, and Card gets a whole-card link. Under `data-density="comfortable"`, Tag and Breadcrumb links keep their size but take the tap through an invisible pad of `--spacing-target` (44px), the ClaimCard section summary and Footer links grow to 44px rows, and the default density stays at the same rhythm. New `CardLink`: wrap the card's title text in it and the whole card becomes the target through a stretched `::after`, with one accessible name, the focus ring on the card and a quiet border lift on hover. `asChild` takes a router link.

Components: card, tag, breadcrumb, footer, claim-card
Kind: Feature
