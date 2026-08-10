import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  MIN_VIEWPORT,
  ShareButtons,
} from '@interlace/ui/patterns/share-buttons';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/ShareButtons',
  component: ShareButtons,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compact share cluster: prefilled intent links for Twitter, Bluesky and ' +
          'LinkedIn plus a copy-link button that flips to a 1.5s "Copied!" ' +
          'confirmation. Client component — `navigator.clipboard.writeText` + ' +
          '`useState`. Pick the networks per surface with `networks`; there is no ' +
          'share-count, no SDK and no third-party script, so it stays safe to render ' +
          'on every article without a consent gate.',
      },
    },
  },
  args: {
    url: 'https://interlace.tools/articles/the-397-rule-policy',
    title: 'The 397-rule policy: one floor, every engine',
    networks: ['twitter', 'bluesky', 'linkedin', 'copy'],
  },
  argTypes: {
    url: {
      control: 'text',
      description:
        'Canonical URL being shared. Encoded into every intent href and copied verbatim by the copy button.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    title: {
      control: 'text',
      description:
        'Post title, used as the prefilled share text on Twitter and Bluesky. LinkedIn ignores it — its intent endpoint takes the URL only.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    networks: {
      control: 'check',
      options: ['twitter', 'bluesky', 'linkedin', 'copy'],
      description:
        'Which buttons to render, in order. Drop networks your audience is not on rather than shipping all four everywhere.',
      table: {
        type: { summary: "ReadonlyArray<'twitter' | 'bluesky' | 'linkedin' | 'copy'>" },
        defaultValue: { summary: "['twitter', 'bluesky', 'linkedin', 'copy']" },
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the wrapping `<div>` — the alignment / gap seam.',
      table: { category: 'Appearance' },
    },
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
