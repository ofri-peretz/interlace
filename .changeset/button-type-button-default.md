---
'@interlace/ui': minor
---

feat(ui): Button no longer submits a form by default. A bare `<button>` is `type="submit"`, so a Cancel or "Show more" Button inside a `<form>` submitted it; the Settings template shipped exactly that bug. Button now defaults to `type="button"` (as MUI, Chakra and Primer do) and a submit action says so with `type="submit"`. A Button rendered through `render` (a link) gets no `type` unless you pass one.

Components: button

Kind: Breaking

Migration: in your copy of `button.tsx`, take `type` out of the props and pass `type: type ?? (render ? undefined : 'button')` to `useRender`. Then search your app for Buttons inside a `<form>` that submit it without a `type` and add `type="submit"` to each (e.g. `<Button>Save</Button>` → `<Button type="submit">Save</Button>`). Buttons that should not submit need no change.
