import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRight } from 'lucide-react';
import { Button } from '@interlace/ui/button';
import { Hero } from '@interlace/ui/patterns/hero';

const meta: Meta<typeof Hero> = {
  title: 'Blocks/Hero',
  component: Hero,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The above-the-fold landing section: eyebrow, headline, body, CTA cluster, and ' +
          'an optional media slot that flips the layout from one centred column to a ' +
          'two-column grid. It is the plain-surface hero — it inherits the page ' +
          'background and paints no decoration; reach for HeroCosmic when the section ' +
          'should own its own dark starfield surface.',
      },
    },
  },
  argTypes: {
    eyebrow: {
      control: 'text',
      description:
        'Small accent line above the headline — version, date, or a category. Not a heading, so keep it short.',
      table: { type: { summary: 'ReactNode' } },
    },
    headline: {
      control: 'text',
      description: 'Display headline. The only required prop.',
      table: { type: { summary: 'ReactNode' } },
    },
    body: {
      control: 'text',
      description: 'Supporting paragraph, capped at prose width under the headline.',
      table: { type: { summary: 'ReactNode' } },
    },
    actions: {
      control: false,
      description:
        'CTA cluster — typically a primary Button and a secondary one. Elements only; see the Default story source.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    media: {
      control: false,
      description:
        'Right-column visual: image, video, CodeWindow, decorative SVG. Supplying it is what switches the hero to the two-column layout — there is no `layout` prop.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<section>` — the padding / background seam.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    eyebrow: '',
    headline: 'Production-grade React primitives for shadcn.',
    body: 'Drop in @interlace/ui — brand tokens, theme bridge, animation keyframes, and a portable 26-rule component-modeling floor — installed alongside.',
    actions: (
      <>
        <Button>
          Get started
          <ArrowRight className="ml-1 size-4" aria-hidden />
        </Button>
        <Button variant="ghost">View on GitHub</Button>
      </>
    ),
  },
};

export const WithEyebrow: Story = {
  args: {
    eyebrow: 'v2.0 · February 2026',
    headline: 'A design system that scales with the brand.',
    body: 'One token layer, every surface — docs, storybook, registry, blog, future apps. Brand-fork seam at the --interlace-* primitive layer.',
    actions: (
      <>
        <Button>Read the changelog</Button>
        <Button variant="outline">See the release</Button>
      </>
    ),
  },
};

export const TwoColumn: Story = {
  args: {
    eyebrow: 'Designed for engineers',
    headline: 'See the source, copy the source.',
    body: 'Every primitive ships with its full TSX inline — no bundled black boxes. Install via the shadcn CLI; the file lands in your repo.',
    actions: (
      <>
        <Button>Install a primitive</Button>
        <Button variant="ghost">Browse the catalog</Button>
      </>
    ),
    media: (
      <div className="bg-card text-card-foreground border-border rounded-lg border p-6 font-mono text-xs">
        <div className="text-muted-foreground">
          $ npx shadcn@latest add @interlace/button
        </div>
        <div className="mt-2 text-emerald-600 dark:text-emerald-400">
          ✓ Created src/components/ui/button.tsx
        </div>
        <div className="text-emerald-600 dark:text-emerald-400">
          ✓ Updated tailwind.config.ts
        </div>
        <div className="text-emerald-600 dark:text-emerald-400">
          ✓ Installed dependencies
        </div>
      </div>
    ),
  },
};
