---
"@interlace/ui": patch
---

ShareCard: `results` typechecks as the array of result keys. The props took a `div`'s own attributes too, and React types a `div`'s `results` as a number, so passing `results={['right']}` failed to compile in a consumer's app. The div's `results` is now left out.

Components: share-card
Kind: Fix
