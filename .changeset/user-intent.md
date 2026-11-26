---
'@interlace/ui': minor
---

User intent: typed events for what a person meant to do, sent to whichever analytics tool the app uses.

`IntentProvider` takes one `onIntent` adapter. Below it, `useActivateIntent` (every activation, with keyboard, mouse, touch or pen), `useViewIntent` (half the element visible for a second), `useDwellIntent` (a pointer or keyboard focus resting for half a second), `useCommitIntent` (a typed value settled, reported as its length), `useDisclosureIntent` (an overlay opened or closed, and why) and `useFormIntent` (started, submitted, or abandoned by cancel or page leave) all report to it. Any element with `data-intent="name"` reports its clicks with no hook, so server components can declare intent too. Given a `page`, the provider reports `page_view` and `page_leave` with visible time and read depth, and it reports rage clicks: three quick clicks on one spot.

Events carry names, numbers and enums only: never typed text, element text, or anything about who the person is. A failing adapter is caught, so analytics never breaks a page.

Components: intent

Kind: Feature
