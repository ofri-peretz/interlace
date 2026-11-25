---
'@interlace/ui': minor
---

View transitions, made safe to reach for. `Morph` gives its one child a view-transition name (any string, cleaned into a valid identifier), so a card's image and the detail page's hero with the same name morph into each other: the card grows into its page. `useViewTransition()` runs a React state change inside a transition, flushed so the browser captures the new view, with optional `types`. `startViewTransition` does the same for code outside React. `PageTransitions` (once, in the root layout) is a server-safe `<style>`: the old page fades out, the new one rises in by half a rem, and `@view-transition` turns it on between documents; `pageTransitionsCss()` returns the same CSS. Where the browser has no View Transitions the update simply runs, and under reduced motion there is no transition at all. Opacity and transform only.

Components: view-transition
