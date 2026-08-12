'use client';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Callout } from '@interlace/ui/callout';
import { Prose } from '@interlace/ui/prose';
import { CodeBlock } from '@interlace/ui/code-block';
import { TagList } from '@interlace/ui/tag';
import { Figure } from '@interlace/ui/patterns/figure';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `mdx-starter` — the article the bundle renders.
 *
 * ```sh
 * npx shadcn add @interlace/mdx-starter
 * ```
 *
 * `Callout` · `Prose` · `CodeBlock` · `Tag` / `TagList` · `Figure`, plus the
 * `theme` CSS baseline. These are the components an MDX pipeline needs
 * before it can render anything more interesting than paragraphs — and the
 * reason they ship as one item is that an article uses all of them in the
 * same scroll, where the only thing that matters is whether they look like
 * one document.
 *
 * ─── Why this story is an article and not a component gallery ─────
 *
 * A gallery answers "what does a Callout look like". Nobody installs this
 * bundle to find that out; each part already has its own story. What a
 * gallery cannot answer is the question the bundle is actually for: do a
 * callout, a fenced code block, a figure and a tag row share a vertical
 * rhythm when they are stacked in prose, or does each one bring its own?
 *
 * So the specimen is a page of article body, in reading order, at the prose
 * measure. `Prose` bounds the measure and styles the raw elements through
 * the cascade — the `h2`, `p`, `ul`, `blockquote` and inline `code` below
 * carry no classes at all, which is exactly the shape MDX emits.
 *
 * ─── Wiring it up ─────────────────────────────────────────────────
 *
 * The bundle ships a README, not an `mdx-components.tsx` — the mapping is
 * one object and every pipeline spells its entry point differently. The
 * "Wiring" panel is that object, copyable.
 */

const SAMPLE_SRC =
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80&auto=format&fit=crop';

const MDX_COMPONENTS_SNIPPET = `// mdx-components.tsx
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { Figure } from '@/components/ui/patterns/figure';
import { Prose } from '@/components/ui/prose';
import { Tag, TagList } from '@/components/ui/tag';

export function useMDXComponents(components) {
  return {
    // Fenced code -> the DS block, with the copy button and Shiki
    // highlighting. MDX hands you <pre><code>, so unwrap it once here
    // rather than in every article.
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    Callout,
    Figure,
    Tag,
    TagList,
    ...components,
  };
}`;

const ESLINT_SNIPPET = `import interlace from '@interlace/eslint-plugin';

export default [
  interlace.configs.recommended,
  { rules: { 'interlace/no-raw-hex': 'error' } },
];`;

const TAGS = [
  { label: 'design-systems', href: '#mdx-starter' },
  { label: 'mdx', href: '#mdx-starter' },
  { label: 'accessibility', href: '#mdx-starter' },
  { label: 'tailwind', href: '#mdx-starter' },
];

// ── The article ─────────────────────────────────────────────────────────────

function Article() {
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="mdx-starter-article"
    >
      <Stack gap="md">
        <TagList items={TAGS} data-slot="mdx-starter-tags" />

        {/* Nothing inside `Prose` carries a class. That is the contract:
            MDX emits bare elements and the cascade styles them, so an
            article body needs no per-element wiring at all. */}
        <Prose as="div" data-slot="mdx-starter-prose">
          <h2>Absence is a vocabulary</h2>
          <p>
            A cell that is empty because nobody ran the job is a different
            fact from a cell that is empty because the job returned zero. Both
            render as blank space, and only one of them is a measurement — so
            a system that draws them identically is not being minimal, it is
            discarding the distinction its readers most need.
          </p>

          <Callout tone="warn" title="Never render a missing prior as 0">
            A truncated list must never become a denominator, and when
            coverage is partial every count is a floor rather than a total.
            Three rules, one cause: an invented number is indistinguishable
            from a measured one once it is on the page.
          </Callout>

          <p>
            The same discipline applies to the tooling that checks it. A lint
            rule that silently suppresses itself is worse than no rule, since
            the green run is now evidence of nothing:
          </p>

          <ul>
            <li>a hatch means no run happened;</li>
            <li>a dashed outline means planned, not yet approached;</li>
            <li>
              solid means real — and <code>null</code> is never zero.
            </li>
          </ul>

          <blockquote>
            A bar that draws a beautiful wrong length is worse than one that
            fails to render.
          </blockquote>
        </Prose>

        <CodeBlock
          title="eslint.config.mjs"
          language="js"
          data-slot="mdx-starter-code"
        >
          {ESLINT_SNIPPET}
        </CodeBlock>

        <Figure
          src={SAMPLE_SRC}
          alt="A workbench of hand tools arranged in rows, each in its own outlined slot."
          caption="Figure 1. The space is reserved before the image arrives — AspectRatio is what makes the swap CLS-free."
          ratio={16 / 9}
          data-slot="mdx-starter-figure"
        />

        <Prose as="div">
          <p>
            Every block above is one of the five components the bundle
            installs, in the order an article actually uses them. The measure,
            the vertical rhythm between blocks, and the type scale are the
            same for all of them because they read the same tokens — which is
            the whole argument for installing them together.
          </p>
        </Prose>
      </Stack>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

function Specimen() {
  return (
    <Stack
      gap="lg"
      className="w-full"
      id="mdx-starter"
      data-slot="mdx-starter-specimen"
    >
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          mdx-starter — the composed result
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          Not a gallery of the five components — each already has its own
          story. This is a page of article body in reading order, because the
          question the bundle answers is whether a callout, a code block, a
          figure and a tag row share one vertical rhythm when they are stacked
          in prose.
        </Typography>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
          <code className="font-mono text-code">
            npx shadcn add @interlace/mdx-starter
          </code>
        </pre>
      </Stack>

      <Article />

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="mdx-starter-wiring"
      >
        <Stack gap="sm">
          <Stack gap="xs">
            <Typography variant="h4" as="h3">
              Wiring
            </Typography>
            <Typography variant="ui-sm" tone="muted" className="max-w-prose">
              The bundle ships a README rather than an{' '}
              <code className="font-mono">mdx-components.tsx</code>, because
              the mapping is one object and every pipeline spells its entry
              point differently. The only line that is not a straight
              substitution is <code className="font-mono">pre</code>: MDX
              hands you <code className="font-mono">
                &lt;pre&gt;&lt;code&gt;
              </code>
              , so unwrap it once here instead of in every article.
            </Typography>
          </Stack>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
            <code className="font-mono text-code">
              {MDX_COMPONENTS_SNIPPET}
            </code>
          </pre>
        </Stack>
      </Box>
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Starters/MDX Starter',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The composed result of `npx shadcn add @interlace/mdx-starter`: a page of article body in reading order, not a gallery. Each of the five components already has its own story, so what is worth showing is the one thing they cannot — whether a callout, a fenced code block, a figure and a tag row share a vertical rhythm when stacked in prose. Nothing inside `Prose` carries a class: MDX emits bare `h2` / `p` / `ul` / `blockquote` / `code` and the cascade styles them, which is why an article body needs no per-element wiring. The Wiring panel is the one object a consumer still has to write.',
      },
    },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    // All five parts present…
    for (const slot of [
      'mdx-starter-tags',
      'mdx-starter-prose',
      'mdx-starter-code',
      'mdx-starter-figure',
    ]) {
      await expect(
        canvasElement.querySelector(`[data-slot="${slot}"]`),
      ).toBeTruthy();
    }
    await expect(
      canvasElement.querySelector('[data-slot="callout"]'),
    ).toBeTruthy();

    // …and the measure is bounded. An article body that runs the full width
    // of a 1280px canvas is unreadable, and it is the failure mode of every
    // "just drop MDX in a div" pipeline.
    const prose = canvasElement.querySelector(
      '[data-slot="mdx-starter-prose"]',
    ) as HTMLElement;
    const paragraph = prose.querySelector('p') as HTMLElement;
    await expect(paragraph.getBoundingClientRect().width).toBeGreaterThan(240);
    await expect(paragraph.getBoundingClientRect().width).toBeLessThan(900);
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
