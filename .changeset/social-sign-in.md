---
"@interlace/ui": minor
---

SocialSignIn: "Continue with Google / Apple / Facebook / X / TikTok / Microsoft / LinkedIn / GitHub", or any provider you describe, plus an optional email link, in one form. The first providers get full-width buttons and the rest a row of 44px icon buttons; the one used last time moves first with a tag. Without JavaScript it submits `provider=<id>` to your action; with callbacks, the pressed button spins until its promise settles. Once the email link is sent it becomes a "check your inbox" note. It knows nothing about any auth library.

Components: social-sign-in
Kind: Feature
