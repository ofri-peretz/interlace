import type { Meta, StoryObj } from '@storybook/react-vite';
import { FeatureGrid } from '@interlace/ui/patterns/feature-grid';
import { Shield, Zap, Heart, Lock, Sparkles, Code } from 'lucide-react';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof FeatureGrid> = {
  title: 'Blocks/FeatureGrid',
  component: FeatureGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Grid of feature cards (icon + title + description). 3 columns by default, 2 or 4 also supported. Mobile collapses to 1 column.',
      },
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
  },
};

export const TwoColumns: Story = {
  args: { ...Default.args, cols: 2, features: sampleFeatures.slice(0, 4) },
};

export const Loading: Story = { args: { loading: true } };

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
