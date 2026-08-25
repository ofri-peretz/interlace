import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeroStrand } from '@interlace/ui/effects/hero-strand';
import { expect, waitFor, within } from 'storybook/test';

const meta: Meta<typeof HeroStrand> = {
  title: 'Effects/HeroStrand',
  component: HeroStrand,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The thread at page scale: one strand-a ribbon drawn across a hero section, optionally " +
          "crossed by the strand-b counter — the fourth and final scale of \"One thread, every " +
          "scale\". A server component with zero client JS: the draw is the `strand-draw` CSS " +
          "keyframe (600ms, the doctrine's motion ceiling), so the preflight reduced-motion clamp " +
          "reaches it and reduced-motion users see the strand instantly drawn. Paths normalize " +
          "with `pathLength=100` — one keyframe serves any geometry, and `vector-effect` is " +
          "deliberately absent (Chromium's screen-space dashes discard pathLength; the first " +
          "production weave shipped that bug).",
      },
    },
  },
  argTypes: {
    counter: {
      control: 'boolean',
      description: 'Draw the strand-b counter-crossing, 200ms behind the lead.',
      table: { category: 'Appearance', defaultValue: { summary: 'false' } },
    },
    'data-testid': {
      control: 'text',
      description: 'Stable E2E selector; consumer provides — no default.',
      table: { category: 'Contract', type: { summary: 'string' } },
    },
  },
};
export default meta;

type Story = StoryObj<typeof HeroStrand>;

const renderHero = (args: React.ComponentProps<typeof HeroStrand>) => (
  <section className="relative overflow-hidden bg-background px-8 py-24">
    <HeroStrand {...args} />
    <div className="relative mx-auto max-w-prose">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        One thread, every scale
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">
        Tools that let you move at scale, at velocity — peacefully.
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        The strand draws itself behind the words: the brand&apos;s only
        motion verb, at section scale, with zero client JavaScript.
      </p>
    </div>
  </section>
);

export const Default: Story = {
  args: { 'data-testid': 'hero-strand' },
  render: renderHero,
  play: async ({ canvasElement }) => {
    const svg = within(canvasElement).getByTestId('hero-strand');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths[0].getAttribute('pathLength')).toBe('100');
    // The draw completes: computed dashoffset lands at 0 (or is clamped
    // there instantly under prefers-reduced-motion).
    await waitFor(
      () =>
        expect(
          parseFloat(getComputedStyle(paths[0]).strokeDashoffset),
        ).toBe(0),
      { timeout: 2000 },
    );
  },
};

export const WovenCrossing: Story = {
  args: { 'data-testid': 'hero-strand', counter: true },
  render: renderHero,
  play: async ({ canvasElement }) => {
    const svg = within(canvasElement).getByTestId('hero-strand');
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    // Both strands finish drawn; the counter trails by 200ms.
    await waitFor(
      () => {
        for (const p of paths)
          expect(parseFloat(getComputedStyle(p).strokeDashoffset)).toBe(0);
      },
      { timeout: 3000 },
    );
  },
};
