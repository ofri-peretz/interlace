# Spec: Wordmark name from its lines (Label in Name)

Status: review, for acceptance at Design→Build. Intent: [intent.md](./intent.md).
Read against `interlace` `origin/main` d51ab18d and `whylikedis` `origin/main` 8577271 on 2026-11-27.

## 1. Local code this replaces (whylikedis)

`apps/site/app/nav.tsx`, the `Wordmark` element inside the `logo` prop: the `label` string
(`"WhyLikeDIs, home"`), the `aria-label={undefined}` that cancels it, and the hand-written
`<span className="sr-only">, home</span>`. About six lines and a four-line comment. They become
`<Wordmark href="/" hint=", home">` with the three lines unchanged.

## 2. Files

| File | Change |
| --- | --- |
| `packages/ui/src/patterns/wordmark.tsx` | `label` becomes optional when `href` is given (type: a union on `href`); new `hint?: string`; docs "Name" section rewritten; one dev-only warning. |
| `packages/ui/src/patterns/topbar.tsx` | One paragraph in the header comment under "Logo height": a `logo` that is a multi-script `Wordmark` must follow the Wordmark's "Name" section. |
| `packages/ui/__tests__/wordmark.test.tsx` | New cases (§5). The existing cases are kept; the two that use `label="Hello, home"` over unrelated lines are changed to use a label that contains their lines or no label, with the reason in the commit. |
| `apps/storybook/src/stories/blocks/Wordmark.stories.tsx` | `SeveralScripts` and `InTheTopbar` use the new form; one new story `LabelThatDoesNotMatch` documents the wrong form (it is excluded from the axe job by tag and says why). |
| `apps/registry` docs page for `wordmark` | Regenerated from the component comment. |

Registry item `wordmark`; a changeset (minor) and its `versions:derive` entry. No new dependency.

## 3. API

```ts
type WordmarkProps =
  | (LinkProps & { href: string; label?: string; hint?: string })    // a link
  | (SpanProps & { href?: undefined; label: string; hint?: never }); // an image of text
```

Behaviour with `href`:

| `label` | `hint` | Link's accessible name |
| --- | --- | --- |
| absent | absent | Its lines in order, as content: "ACME アクメ أكمي" |
| absent | `", home"` | Its lines, then the hidden hint: "ACME アクメ أكمي, home" |
| given | any | `label` through `aria-label`, as today (the hint is ignored, with the dev warning below if the label does not contain the lines) |

The hint is `<span data-slot="wordmark-hint" className="sr-only">`, last child of the link; it is
not rendered without `href`.

Without `href`: unchanged. `role="img"`, `aria-label={label}`, and `hint` is a type error.

## 4. The note (text for the docs, in the component comment and the Topbar comment)

> **Name.** A link's name must contain the words printed on it (WCAG 2.5.3, Label in Name), or a
> person who speaks the words to a voice control finds nothing. A wordmark prints every `Wordmark.Line`,
> so:
>
> - **One language or a tagline:** `label` must contain the lines, for example "Acme Field notes, home".
> - **Several scripts:** leave `label` out. The link is then named by its lines, each in its own
>   `lang`, and `hint=", home"` says where it goes. Do not write one translated name in `label`: it
>   will not contain the other lines.
> - **Check it:** run axe with `label-content-name-mismatch` enabled on the page that holds the logo.

## 5. Test plan

Rule: **the check was shown failing on the broken state.**

- `wordmark.test.tsx` (component): with `href` and no `label`, the link's computed name equals the
  lines joined by a space; with `hint`, it ends with the hint; with `label` equal to the lines
  joined, it passes; each line keeps `lang`; the hint is last and `sr-only`; without `href`, `label`
  still names the `role="img"`; with `href`, `label` and a mismatching lines set, the dev warning
  fires once (spy on `console.warn`), and does not fire in production mode (`NODE_ENV`).
- Type test (`expectTypeOf`): `<Wordmark label="x">` without `href` compiles; `<Wordmark href="/">`
  without `label` compiles; `<Wordmark hint="x" label="y">` without `href` does not.
- axe (`wordmark.a11y.test.tsx`, `jest-axe`, with `label-content-name-mismatch` enabled): the
  three-script wordmark with no label passes; with a label that contains all lines passes; with
  `label="Acme, home"` over "ACME アクメ أكمي" **fails**, and the test asserts the failure
  (so a future axe change that stops catching it turns the test red).
- Storybook: `SeveralScripts` and `InTheTopbar` pass the storybook axe job; `LabelThatDoesNotMatch`
  is tagged `!a11y` with the reason in its description.

### Deliberate-break proofs

| Break | Test that must fail |
| --- | --- |
| `hint` rendered before the lines | the name-order case |
| `hint` rendered without `sr-only` | the `sr-only` case and the visual baseline for `Wordmark` |
| `aria-label` still set from `label ?? ''` when `label` is absent | the "named by its lines" case (the name would be empty) |
| `lang` dropped from a line | the lang case |
| Warning fires on a matching label | the no-warning case |
| `role="img"` branch makes `label` optional | the type test |

## 6. Accessibility and motion

The only change to what a person perceives is the link's name (above). No visual change, no motion;
the existing visual baselines for `Wordmark` stay byte-identical (a test asserts the six
baselines are unchanged), which is the static projection.

## Out of scope

A generic Label-in-Name linter for the registry; changing other components' names; computing a name
from children; translating the hint (the app passes it in its language); the lockup's visuals.

## 7. Open questions, each with the default the build agent takes

| Question | Default |
| --- | --- |
| Make `hint` an array for per-language hints? | No; one string, the app's language. |
| Warn when `label` is given and `hint` too? | No; the type says the hint is ignored, the docs say it once. |
| Should `Topbar` check its `logo` for a name? | No; it cannot know what the slot holds. The note is the fix. |
