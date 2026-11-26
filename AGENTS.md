# Interlace: agent guide

Interlace is an open-source shadcn registry (ds.interlace.tools): React components on Base UI and
Tailwind CSS v4, copied into the consumer's tree, so every change is judged in someone else's app.
The `interlace-craft` skill holds the design rules and ships to consumers' agents too. Where every
other rule lives: [CONTRIBUTING.md](CONTRIBUTING.md#where-the-rules-live).

- Match the care of the best teams (Linear, Vercel, Stripe, Radix, shadcn); never copy a look.
- A consumer who needs a class for a reasonable case has found a gap: add a prop or variant.
- Motion explains a change. Aim for AAA contrast on body text; the locks hold AA.

How we work with Claude: [AI-SDLC](docs/ai-sdlc/AI-SDLC.md).

The rest is a lock test or hook whose failure names the fix.
