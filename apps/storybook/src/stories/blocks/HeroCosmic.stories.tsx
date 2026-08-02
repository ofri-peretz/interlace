import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeroCosmic } from '@interlace/ui/patterns/hero-cosmic';

const meta: Meta<typeof HeroCosmic> = {
  title: 'Blocks/HeroCosmic',
  component: HeroCosmic,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The full-bleed landing hero: starfield, shooting stars, and meteors over a ' +
          'deep gradient.\n\n' +
          'It owns its surface in BOTH colour schemes. That is deliberate — a ' +
          'starfield only reads as a starfield on near-black — and it is why the ' +
          'copy here uses `--hero-foreground` rather than `--foreground`, which ' +
          'would render black text on a black hero in light mode.\n\n' +
          'The effect colours resolve from the `--hero-*` brand tokens at runtime ' +
          'rather than being passed in as props. Canvas ignores the cascade, and the ' +
          'effect components concatenate an alpha suffix onto the value, so a ' +
          '`var()` reference cannot reach them. The decorative layer therefore ' +
          'mounts one frame after the copy, which is also why nothing shifts: it is ' +
          'absolutely positioned behind content that never moves.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    'data-testid': 'story-hero-cosmic',
    eyebrow: (
      <span className="rounded-full border border-hero-foreground/20 bg-hero-foreground/10 px-3 py-1 text-caption font-medium text-hero-foreground">
        Interlace design system
      </span>
    ),
    headline: 'Build the site, not the buttons',
    tagline:
      'Composable blocks with skeletons, responsive ladders, and AA contrast already settled — so a new branded site takes hours, not weeks.',
    primaryCta: { label: 'Browse components', href: '#' },
    secondaryCta: { label: 'Read the docs', href: '#' },
  },
};

export const HeadlineOnly: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Everything except `headline` is optional. With no CTAs the copy column ' +
          'collapses to a single centred block and the hero still holds full height.',
      },
    },
  },
  args: {
    'data-testid': 'story-hero-cosmic-minimal',
    headline: 'One system, every site',
  },
};

export const WithFooter: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `footer` slot sits under the CTAs — the conventional home for trust ' +
          'signals. It is a ReactNode, so the hero never learns what a download count is.',
      },
    },
  },
  args: {
    'data-testid': 'story-hero-cosmic-footer',
    headline: 'Ship the boring parts faster',
    tagline: 'Nineteen ESLint plugins and a design system, on one set of tokens.',
    primaryCta: { label: 'Get started', href: '#' },
    footer: (
      <p className="text-caption text-hero-foreground/70">
        MIT licensed · No telemetry · Works with any React framework
      </p>
    ),
  },
};

export const QuietEffects: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `effects` bag tunes density and timing — but not colour, which stays ' +
          'with the tokens so the hero cannot drift off-brand one prop at a time.',
      },
    },
  },
  args: {
    'data-testid': 'story-hero-cosmic-quiet',
    headline: 'Calmer sky',
    tagline: 'Fewer meteors, slower twinkle — for a hero that sits above dense copy.',
    effects: {
      starDensity: 0.0001,
      twinkleProbability: 0.3,
      meteorCount: 1,
      shootingMinDelay: 3000,
      shootingMaxDelay: 8000,
    },
  },
};
