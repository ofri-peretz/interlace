import type { Meta, StoryObj } from '@storybook/react-vite';
import { Footer } from '@interlace/ui/patterns/footer';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Footer> = {
  title: 'Blocks/Footer',
  component: Footer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Site footer: brand mark + grouped link columns + copyright/social tail. Stacks on mobile, grids on md+.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Footer>;

const sampleBrand = (
  <div>
    <div className="flex items-center gap-2 font-semibold">
      <span
        aria-hidden
        className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
      />
      <span>Interlace</span>
    </div>
    <p className="text-muted-foreground mt-2 text-sm max-w-xs">
      Production-grade React primitives for the modern web.
    </p>
  </div>
);

const sampleGroups = [
  {
    title: 'Product',
    links: [
      { href: '/docs', label: 'Docs' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: 'https://github.com', label: 'GitHub', external: true },
      { href: 'https://twitter.com', label: 'X', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

export const Default: Story = {
  args: {
    brand: sampleBrand,
    groups: sampleGroups,
    copyright: '© 2026 Interlace. All rights reserved.',
  },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
