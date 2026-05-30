import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  MIN_VIEWPORT,
  ShareButtons,
} from '@interlace/ui/blocks/share-buttons';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/ShareButtons',
  component: ShareButtons,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compact share cluster. Three external-share anchors (Twitter, Bluesky, LinkedIn) plus a copy-link button that flips to a 1.5s "Copied!" confirmation. Client component — uses `navigator.clipboard.writeText` and `useState`.',
      },
    },
  },
  args: {
    url: 'https://interlace.tools/articles/the-397-rule-policy',
    title: 'The 397-rule policy: one floor, every engine',
  },
  argTypes: {
    url: { control: 'text' },
    title: { control: 'text' },
  },
} satisfies Meta<typeof ShareButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-col gap-md">
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-fd-muted-foreground">
          networks = all (default)
        </div>
        <ShareButtons {...args} />
      </div>
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-fd-muted-foreground">
          networks = ['twitter', 'copy']
        </div>
        <ShareButtons {...args} networks={['twitter', 'copy']} />
      </div>
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-fd-muted-foreground">
          networks = ['linkedin', 'bluesky']
        </div>
        <ShareButtons {...args} networks={['linkedin', 'bluesky']} />
      </div>
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-fd-muted-foreground">
          networks = ['copy']
        </div>
        <ShareButtons {...args} networks={['copy']} />
      </div>
    </div>
  ),
};

export const Dark: Story = {
  decorators: [withDark],
};

export const RTL: Story = {
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a (MIN_VIEWPORT - 1)px container with the
 * `data-interlace-dev` flag so preflight's dashed warning outline appears.
 * Storybook renders both the warning and the still-functional cluster.
 */
export const BelowMinViewport: Story = {
  render: (args) => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <ShareButtons {...args} />
    </div>
  ),
  decorators: [
    (Story) => (
      <div
        ref={(node) => {
          if (node && typeof document !== 'undefined') {
            document.body.setAttribute('data-interlace-dev', '');
          }
        }}
      >
        <Story />
      </div>
    ),
  ],
};
