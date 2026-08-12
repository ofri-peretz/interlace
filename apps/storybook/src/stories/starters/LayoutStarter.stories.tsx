'use client';

import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Container } from '@interlace/ui/container';
import { Section } from '@interlace/ui/section';
import { Stack } from '@interlace/ui/stack';
import { Grid, GridItem } from '@interlace/ui/grid';
import { Box } from '@interlace/ui/box';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `layout-starter` — the six primitives, composed into a page.
 *
 * ```sh
 * npx shadcn add @interlace/layout-starter
 * ```
 *
 * `Container` · `Section` · `Stack` · `Grid` · `Box` · `Typography`, plus
 * the `theme` CSS baseline they all read their scales from. The bundle
 * exists because these six are not six decisions — they are one: every page
 * in the system is a Section stack inside a Container, gapped by Stack and
 * Grid, with Box as the only thing that paints a surface and Typography as
 * the only thing that sets a size.
 *
 * ─── Why a composed page and not a props table ────────────────────
 *
 * Each primitive already has its own story with its own controls. What none
 * of them can show is the ONE THING the bundle is for: which primitive owns
 * which box. That is a question about nesting, and it is only answerable by
 * looking at a real page with the boundaries drawn.
 *
 * So the page below is a real assembly, and every wrapper is labelled with
 * the primitive that owns it. Toggle `outline` off in Controls to see it as
 * a reader would.
 *
 * ─── The rule the labels make visible ─────────────────────────────
 *
 * Vertical rhythm belongs to `Section` (three spacing tiers, all responsive);
 * horizontal measure belongs to `Container` (four width tiers — prose,
 * content, wide, full); the gap between siblings belongs to `Stack` or
 * `Grid` (one six-step scale, shared). Nothing else sets margins. A page
 * that fights its own spacing is almost always a page where one of those
 * three jobs was done twice.
 */

// ── A labelled wrapper ──────────────────────────────────────────────────────
//
// The label is `absolute`, so it never affects the geometry it is describing
// — an annotation that changes the layout it annotates is worse than none.

function Marker({
  name,
  outline,
  children,
}: {
  name: string;
  outline: boolean;
  children: ReactNode;
}) {
  if (!outline) return <>{children}</>;
  return (
    <div
      className="relative rounded-md outline outline-1 outline-dashed outline-primary/40"
      data-slot="layout-marker"
      data-primitive={name}
    >
      <span className="absolute -top-2 left-2 rounded-full bg-background px-1 font-mono text-caption text-primary">
        {name}
      </span>
      {children}
    </div>
  );
}

// ── The composed page ───────────────────────────────────────────────────────

const CARDS = [
  {
    title: 'Container',
    body: 'Four width tiers — prose (65ch), content (1024), wide (1280), full. Owns the measure, and nothing else does.',
  },
  {
    title: 'Section',
    body: 'Vertical-rhythm slabs: tight / comfortable / spacious, each responsive. Owns page rhythm, and nothing else does.',
  },
  {
    title: 'Stack + Grid',
    body: 'One six-step gap scale between siblings — xs 8 · sm 16 · md 24 · lg 40 · xl 64 · 2xl 96.',
  },
  {
    title: 'Box',
    body: 'The only primitive that paints a surface: background, padding, radius, border, all from tokens.',
  },
  {
    title: 'Typography',
    body: 'The only primitive that sets a size: h1–h6, body, long, ui, ui-sm, caption, code.',
  },
  {
    title: 'theme',
    body: 'The CSS baseline every scale above resolves through. Installed with the bundle.',
  },
];

type LayoutStarterArgs = {
  outline: boolean;
  containerSize: 'prose' | 'content' | 'wide' | 'full';
  sectionSpacing: 'tight' | 'comfortable' | 'spacious';
  columns: 1 | 2 | 3;
};

function Specimen({
  outline,
  containerSize,
  sectionSpacing,
  columns,
}: LayoutStarterArgs) {
  return (
    <Stack gap="lg" className="w-full" data-slot="layout-starter-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          layout-starter — the composed result
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          One install, six primitives, one page. Every wrapper below is
          labelled with the primitive that owns it, so the nesting — the only
          thing the individual stories cannot show — is readable at a glance.
        </Typography>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
          <code className="font-mono text-code">
            npx shadcn add @interlace/layout-starter
          </code>
        </pre>
      </Stack>

      <Box
        border
        radius="md"
        className="overflow-hidden bg-background"
        data-slot="layout-starter-page"
      >
        <Marker name={`Section spacing="${sectionSpacing}"`} outline={outline}>
          <Section spacing={sectionSpacing} tone="muted" divider="bottom">
            <Marker name={`Container size="${containerSize}"`} outline={outline}>
              <Container size={containerSize}>
                <Marker name="Stack gap=&quot;md&quot;" outline={outline}>
                  <Stack gap="md">
                    <Marker name="Typography variant=&quot;h2&quot;" outline={outline}>
                      <Typography variant="h2" as="h3">
                        A page, assembled
                      </Typography>
                    </Marker>
                    <Typography variant="long" tone="muted">
                      Vertical rhythm from Section, measure from Container,
                      sibling gaps from Stack. Nothing here sets a margin.
                    </Typography>
                  </Stack>
                </Marker>
              </Container>
            </Marker>
          </Section>
        </Marker>

        <Marker name="Section spacing=&quot;tight&quot;" outline={outline}>
          <Section spacing="tight">
            <Container size={containerSize}>
              <Stack gap="md">
                <Typography variant="h4" as="h3">
                  What the bundle installs
                </Typography>
                {/* 12 tracks with a per-breakpoint span, not `cols={3}`.
                    `cols` is the same at every width, so a 3-track grid is
                    three columns on a phone too; the span pair is what makes
                    it one column below `md` and `columns` above it. */}
                <Marker
                  name={`Grid cols={12} · GridItem mdSpan={${12 / columns}}`}
                  outline={outline}
                >
                  <Grid cols={12} gap="md">
                    {CARDS.map((card) => (
                      <GridItem
                        key={card.title}
                        span={12}
                        mdSpan={(12 / columns) as 4 | 6 | 12}
                      >
                        <Marker name="Box" outline={outline}>
                          <Box
                            border
                            radius="md"
                            padding="sm"
                            surface="card"
                            className="h-full"
                            data-slot="layout-card"
                          >
                            <Stack gap="xs">
                              <Typography variant="ui" className="font-semibold">
                                {card.title}
                              </Typography>
                              <Typography variant="ui-sm" tone="muted">
                                {card.body}
                              </Typography>
                            </Stack>
                          </Box>
                        </Marker>
                      </GridItem>
                    ))}
                  </Grid>
                </Marker>
              </Stack>
            </Container>
          </Section>
        </Marker>
      </Box>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="layout-starter-rule"
      >
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            One job each
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            Vertical rhythm belongs to <code className="font-mono">Section</code>
            , horizontal measure to <code className="font-mono">Container</code>
            , the gap between siblings to{' '}
            <code className="font-mono">Stack</code> /{' '}
            <code className="font-mono">Grid</code>. A page that fights its own
            spacing is almost always a page where one of those three jobs got
            done twice — which is why none of these primitives accepts a
            margin.
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Starters/Layout Starter',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'What `npx shadcn add @interlace/layout-starter` composes into: a real page with every wrapper labelled by the primitive that owns it. Each of the six already has its own story with its own controls; what none of them can show is the nesting, which is the only question the bundle actually answers. The controls drive the real layout decisions — container width, section rhythm, grid tracks — so the labels stay attached to a page that is genuinely re-laying itself out. Toggle `outline` off to read it as a visitor would.',
      },
    },
  },
  argTypes: {
    outline: {
      control: 'boolean',
      description:
        'Draw the annotation outlines. They are `absolute`-positioned labels on an `outline` (not a border), so turning them on cannot change the geometry they describe.',
      table: { category: 'Annotation', defaultValue: { summary: 'true' } },
    },
    containerSize: {
      control: 'inline-radio',
      options: ['prose', 'content', 'wide', 'full'],
      description:
        'Measure. `prose` is 65ch — the reading measure; `content` 1024px; `wide` 1280px for card-grid-heavy sections; `full` opts out entirely.',
      table: { category: 'Layout', defaultValue: { summary: 'content' } },
    },
    sectionSpacing: {
      control: 'inline-radio',
      options: ['tight', 'comfortable', 'spacious'],
      description:
        'Vertical rhythm, responsive at every tier. This is the page’s only source of vertical space.',
      table: { category: 'Layout', defaultValue: { summary: 'comfortable' } },
    },
    columns: {
      control: 'inline-radio',
      options: [1, 2, 3],
      description:
        'Desktop track count, expressed as a `GridItem mdSpan` against 12 tracks. `Grid cols` alone is the same at every width — a `cols={3}` grid is three columns on a phone too — so the responsive decision lives on the item, not the container.',
      table: { category: 'Layout', defaultValue: { summary: '3' } },
    },
  },
  args: {
    outline: true,
    containerSize: 'content',
    sectionSpacing: 'comfortable',
    columns: 3,
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    // The composed page must actually be laid out — a card grid that
    // collapsed to zero width is the exact failure the padded-root
    // assertion exists for, and it looks like a design choice in a
    // screenshot.
    const cards = canvasElement.querySelectorAll('[data-slot="layout-card"]');
    await expect(cards.length).toBe(6);
    for (const card of cards) {
      await expect(card.getBoundingClientRect().width).toBeGreaterThan(120);
    }

    // Section owns the vertical rhythm: the outer slab must be taller than
    // the content it wraps by a real, token-sized amount.
    const page = canvasElement.querySelector(
      '[data-slot="layout-starter-page"]',
    ) as HTMLElement;
    await expect(page.getBoundingClientRect().height).toBeGreaterThan(400);
  },
};

/** As a visitor sees it — no annotation layer. */
export const Plain: Story = {
  args: { outline: false },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
