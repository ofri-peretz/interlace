# Intent — a wordmark in several scripts has an accessible name that contains the words on it

**Status:** review · written 2026-11-27 from a gap found the same day in the WhyLikeDIs site
(`whylikedis` `origin/main` 8577271, `apps/site/app/nav.tsx`). Not accepted: a human accepts at
Design→Build. Lives at `docs/intents/wordmark-label-in-name/intent.md` with `spec.md` beside it.
This is the small one: a documentation note, one prop and one test. It is drafted with the larger
three so the owner can accept or drop it on its own.

## What is wanted

A person who builds a `Topbar` with a multilingual `Wordmark` in its `logo` slot, as the docs
and the stories show, ends up with a link that fails WCAG 2.5.3 (Label in Name): its accessible
name is `label`, and the words printed on it are the `Wordmark.Line`s, which are not in the name.
They should not have to find that out from axe and then rebuild the component's name by hand.

1. **The docs say it.** The `Wordmark` "Name" section and the `Topbar` `logo` slot both carry a short
   note: the link's name must contain every visible line; two ways to do it; one that is wrong.
2. **The right way is one prop, not a workaround.** With `href`, `label` becomes optional. When
   it is absent the link is named by its lines, each read in its own language, and an optional
   `hint` (", home") is appended as visually hidden text.
3. **A check would have caught it.** An axe test with `label-content-name-mismatch` switched on
   fails on the three-script wordmark with a `label` that does not contain its lines, and passes
   on the two documented forms.

## Why now

- The Interlace story `SeveralScripts` and the unit test both use the failing pattern: visible lines
  "ACME", "アクメ", "أكمي" under `label="Acme, home"` (story) or `label="Hello, home"` (test).
  The name has the first line at most, and none of the other two.
- The WhyLikeDIs site hit it as an axe failure (axe-core 4.14) and worked around it in `nav.tsx`:
  `label` still passed (the type requires it), then `aria-label={undefined}` to cancel it, then a
  hidden `<span className="sr-only">, home</span>` inside the link, so the name is built from
  the three lines plus "home". That works, and every app with a multilingual wordmark will
  rediscover it.
- Principle 5: a voice-control user says what they see ("click アクメ"), and today that does not
  match anything. Principle 4: the story and the test are the claim; they currently show the
  failing form as the example.

## Constraints

- **No breaking change.** `label` with `href` still works as today (it is just no longer required);
  a lockup that already passes keeps passing.
- **Without `href`, `label` stays required** (`role="img"` needs a name).
- **The name is built from the page, not from a string the developer must keep in sync.** Adding
  or editing a line changes the name.
- **Each line keeps its `lang`**, so the screen reader switches voice per line.
- **The docs name the rule** (WCAG 2.5.3, Label in Name) and give the one test to run.

## Decisions already taken

| Decision | Why |
| --- | --- |
| `hint` is a string rendered visually hidden after the lines | It is the one thing the site had to add by hand ("home"); a prop keeps the markup the same everywhere. |
| Do not try to compute a conformant `label` from the children | Children are a ReactNode; the lines' text is only known after render. The name from content is what browsers already compute. |
| A development warning, not a runtime throw, when `label` is given with `href` and contains none of the lines' text | Catches the mistake in a story or an app at the moment it is written. Silent in production. |

## Left out

- Other components' names (the avatar initials are decoration by design; `Citation` and
  `ReadingSettings` already follow the rule).
- A general axe rule set for the whole registry (the `page-checks` intent covers apps; the
  storybook job already runs axe on stories).
- Changing the visual lockup.

## Success criteria

- The `SeveralScripts` story and the Topbar story pass axe with `label-content-name-mismatch` on.
- WhyLikeDIs deletes the `aria-label={undefined}` and the hand-written `sr-only` span in
  `apps/site/app/nav.tsx` and its axe check stays green.
