---
'@interlace/ui': minor
---

New `ClaimCard` pattern: one claim, examined. A status row for badges, the claim quoted in serif, a short answer that can carry `Citation` markers, collapsible sections for the evidence (facts and sources, who says this, where it is contested, what it does not claim, what could not be verified, or any section you name), and a footer. Every part is a slot. Sections are native `<details>`, so the card renders on the server, opens without JavaScript, and its closed sections still show up in find-in-page.

Components: claim-card

Kind: Feature
