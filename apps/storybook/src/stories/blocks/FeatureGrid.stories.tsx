import type { Meta, StoryObj } from '@storybook/react-vite';
import { FeatureGrid } from '@interlace/ui/patterns/feature-grid';
import { Shield, Zap, Heart, Lock, Sparkles, Code } from 'lucide-react';
import { withRtl } from '@/decorators';

const meta: Meta<typeof FeatureGrid> = {
  title: 'Blocks/FeatureGrid',
  component: FeatureGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "what we do" board: 3–6 small cards, each an optional icon plus a heading and ' +
          'a line or two of copy, under a centred section title. Reach for it on a landing ' +
          'or product page where the items are peers and none needs more than a sentence. ' +
          'If one item needs an image, a longer body or its own CTA hierarchy, it has ' +
          'outgrown this block.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Centred section heading, rendered as a balanced `h2` above the grid.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    lead: {
      control: 'text',
      description: 'One-line muted intro under the title, clamped to `max-w-prose`.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    features: {
      control: 'object',
      description:
        'The cells. Each is `{ icon?, title, description?, action? }`; the card title renders as an `h3` and the icon is `aria-hidden`, so the icon must never be the only thing carrying the meaning. `icon` and `action` are ReactNode — editing them in this JSON control clears them rather than replacing them.',
      table: {
        category: 'Data',
        type: {
          summary:
            'Array<{ icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode }>',
        },
        defaultValue: { summary: '[]' },
      },
    },
    cols: {
      control: 'select',
      options: [2, 3, 4],
      description:
        'Desktop track count. Mobile is always 1 column and `sm` is 2, so this is the lg-and-up ceiling — a `cols={3}` board would give each card ~98px at 375px if it were taken literally.',
      table: {
        category: 'Appearance',
        type: { summary: '2 | 3 | 4' },
        defaultValue: { summary: '3' },
      },
    },
    loading: {
      control: 'boolean',
      description: 'Render a grid of card skeletons instead of the features.',
      table: { category: 'State', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    loadingCount: {
      control: { type: 'range', min: 1, max: 12, step: 1 },
      description: 'How many skeleton cards to paint while loading. Defaults to `cols`.',
      table: { category: 'State', type: { summary: 'number' }, defaultValue: { summary: 'cols' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<section>` — the seam for section padding or a tinted band.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FeatureGrid>;

const sampleFeatures = [
  {
    icon: <Shield className="size-6" />,
    title: 'Production-grade',
    description: 'R1–R26 enforced via ESLint preset. No raw token literals.',
  },
  {
    icon: <Zap className="size-6" />,
    title: 'Fast',
    description: 'Server-first primitives. RSC-friendly. Streams per section.',
  },
  {
    icon: <Heart className="size-6" />,
    title: 'A11y first',
    description: 'WCAG 2.2 AA hard gate in CI. axe runs every story.',
  },
  {
    icon: <Lock className="size-6" />,
    title: 'Secure',
    description: 'CSP-friendly. No inline scripts. CodeQL scans every PR.',
  },
  {
    icon: <Sparkles className="size-6" />,
    title: 'Themable',
    description: 'CSS cascade-layered. Override the brand in one block.',
  },
  {
    icon: <Code className="size-6" />,
    title: 'Open',
    description: 'MIT licensed. Stories double as docs.',
  },
];

export const Default: Story = {
  args: {
    title: 'Why Interlace',
    lead: 'Six contracts every primitive ships under.',
    features: sampleFeatures,
    cols: 3,
    loading: false,
  },
};

export const TwoColumns: Story = {
  args: { ...Default.args, cols: 2, features: sampleFeatures.slice(0, 4) },
};

export const Loading: Story = { args: { loading: true } };

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
export const RTL: Story = { ...Default, decorators: [withRtl] };
