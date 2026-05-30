import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrevNextPost } from '../../../../../packages/ui/src/blocks/prev-next-post.js';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/PrevNextPost',
  component: PrevNextPost,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Paired previous / next link cards rendered at the foot of an article. Wrapped in a `<nav aria-label="Article navigation">` landmark; either side is optional.',
      },
    },
  },
} satisfies Meta<typeof PrevNextPost>;

export default meta;
type Story = StoryObj<typeof meta>;

const prev = {
  href: '/articles/the-eslint-rule-quality-bar',
  kicker: 'Previous',
  title: 'The ESLint rule quality bar',
};

const next = {
  href: '/articles/shipping-strict-a11y',
  kicker: 'Next',
  title: 'Shipping strict accessibility in our docs site',
};

export const Default: Story = {
  args: { prev, next },
};

export const Variants: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="flex flex-col gap-xl p-lg">
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">
          both
        </div>
        <PrevNextPost
          prev={prev}
          next={next}
          aria-label="Article navigation — both"
        />
      </div>
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">
          only next (first post in series)
        </div>
        <PrevNextPost
          next={next}
          aria-label="Article navigation — only next"
        />
      </div>
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">
          only prev (last post in series)
        </div>
        <PrevNextPost
          prev={prev}
          aria-label="Article navigation — only prev"
        />
      </div>
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">
          custom kickers (series chapter labels)
        </div>
        <PrevNextPost
          prev={{ ...prev, kicker: 'Chapter 2' }}
          next={{ ...next, kicker: 'Chapter 4' }}
          aria-label="Article navigation — custom kickers"
        />
      </div>
    </div>
  ),
};

export const Dark: Story = {
  args: { prev, next },
  decorators: [withDark],
};

export const RTL: Story = {
  args: { prev, next },
  decorators: [withRtl],
};

export const BelowMinViewport: Story = {
  args: { prev, next },
  parameters: {
    docs: {
      description: {
        story:
          'Rendered at 400 CSS px — below MIN_VIEWPORT (480). The two-card grid collapses to a single column; arrows + titles remain legible. The preflight dev outline flags this as out-of-spec while the block stays usable.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
};
