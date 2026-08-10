# Follow-up: three entry animations exceed the 200ms entry budget

**Type:** code bug (the rule is right, the shipped CSS isn't)
**Found:** while reconciling `docs/philosophies/*` against source, 2026-08-10

## The contract

`docs/philosophies/MOTION_PHILOSOPHY.md`, under "What's forbidden":

> **Long-form entry animations on first paint.** A 600ms fade-in on the
> hero blocks comprehension for the duration. First paint belongs to
> content, not theatre. **Max 200ms on entry**, or no entry animation
> at all.

## What ships

`packages/ui/styles/theme.css:342-351`:

| Class | Duration | Delay | Total to fully visible |
| --- | --- | --- | --- |
| `.animate-fade-in-up` | 0.5s | — | 500ms |
| `.animate-slide-in-left` | 0.5s | 0.3s | 800ms |
| `.animate-scale-in` | 0.4s | 0.2s | 600ms |

All three are entry animations (`both` fill mode, from
`opacity: 0`), so the budget applies squarely. `.animate-slide-in-left`
is 4× over.

These are correctly registered in the `tokens.css` reduced-motion
allowlist, so the `reduce` path is fine — this is purely a duration
budget breach on the default path.

## Why this is a code bug, not a doc bug

The 200ms number is a deliberate first-paint-comprehension rule with a
stated rationale, and the rest of the DS honors it
(`--animate-accordion-down` / `-up` are 0.2s). Relaxing the doc to
0.5s to match three outlier classes would bless the regression the rule
exists to prevent, and would silently raise the ceiling for every
future entry animation.

## Options

1. **Bring the three classes to budget** — drop to ~0.2s and remove the
   0.2s/0.3s delays. The delays are the worse half: they stall
   comprehension before any motion even starts.
2. **Retire them.** Check the usage first; if nothing consumes
   `.animate-slide-in-left`, deleting is cheaper than tuning.
3. **Carve out a documented exception** with a named justification, if
   some surface genuinely needs the longer curve. Least preferred — the
   rule's value is that it has no exceptions to argue about.

MOTION_PHILOSOPHY.md now names this violation explicitly under
"Known violation — the three entry classes", so the docs no longer
claim conformance. Delete that section when this is resolved.
