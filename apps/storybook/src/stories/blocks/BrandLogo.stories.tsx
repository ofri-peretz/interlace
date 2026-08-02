import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandLogo, BrandMark } from '@interlace/ui/patterns/brand-logo';

const meta: Meta<typeof BrandLogo> = {
  title: 'Blocks/BrandLogo',
  component: BrandLogo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The Interlace lockup: the two-bar mark plus the wordmark. The bars read ' +
          'their fills from `--brand-mark-bar-o` / `--brand-mark-bar-g`, which is the ' +
          'cross-repo contract — a site outside this monorepo can define just those two ' +
          'custom properties and render an identical lockup. Both flip to a brighter ' +
          'pair in dark mode, so check this story in both themes.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MarkOnly: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The mark without the wordmark — what a favicon, an avatar slot, or a ' +
          'collapsed mobile nav gets.',
      },
    },
  },
  render: () => <BrandMark />,
};

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The mark is geometry, not a bitmap, so it holds its proportions at every ' +
          'size. 16px is the favicon floor; 48px is the marketing-header ceiling.',
      },
    },
  },
  render: () => (
    <div className="flex items-end gap-6">
      {[16, 24, 32, 48].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <BrandMark size={size} />
          <span className="text-caption text-muted-foreground tabular-nums">
            {size}px
          </span>
        </div>
      ))}
    </div>
  ),
};

export const InNavContext: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The lockup where it actually lives — left-aligned in a bordered top bar, ' +
          'sized against nav links.',
      },
    },
  },
  render: () => (
    <div className="flex w-full max-w-content items-center justify-between rounded-lg border border-border px-4 py-3">
      <BrandLogo />
      <nav aria-label="Example navigation" className="flex gap-4">
        {['Docs', 'Plugins', 'Blog'].map((item) => (
          <span key={item} className="text-ui text-muted-foreground">
            {item}
          </span>
        ))}
      </nav>
    </div>
  ),
};
