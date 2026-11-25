---
'@interlace/ui': minor
---

`MultiStepForm`, `DialogueStepper` and `SocialSignIn` are now flows under the flow standard: each file's header carries a flow map (every phase, the part that shows it, and what moves it on), each part's `displayName` is the name you write, and each has a `Journey` story that walks every phase. The standard now has two shapes, because React cannot read a property of a client module from a server component: a flow only a client component can compose ships a namespace (`LiveRoom.Lobby`), and a flow a server component can compose keeps flat parts (`MultiStepFormStep`, `DialogueStep`). Their names do not change.

Components: multi-step-form, social-sign-in

Kind: Changed
