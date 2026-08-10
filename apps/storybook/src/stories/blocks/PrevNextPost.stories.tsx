import type { Meta, StoryObj } from '@storybook/react-vite';
// Canonical path. `@interlace/ui/blocks/prev-next-post` is a deprecated
// re-export scheduled for removal in 2.0.0.
import { PrevNextPost } from '@interlace/ui/patterns/prev-next-post';
import { withDark, withRtl } from '@/decorators';

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

const meta = {
  title: 'Blocks/PrevNextPost',
  component: PrevNextPost,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The sibling-navigation pair at the foot of an article, inside a ' +
          '`<nav aria-label="Article navigation">` landmark so AT users can reach it ' +
          'from the rotor. Either side is optional — pass only `next` at the start of ' +
          'a series, only `prev` at the end — and the surviving card keeps its edge ' +
          'alignment. Use it for ordered reading (a series, docs chapters); for ' +
          '"you might also like" use RelatedPosts instead.',
      },
    },
  },
  args: {
    'data-testid': 'story-prev-next-post',
  },
  argTypes: {
    prev: {
      control: 'object',
      description:
        'Left card: `{ href, title, kicker? }`. Omit for the first post in a series — the cell collapses and `next` stays right-aligned.',
      table: { type: { summary: 'PrevNextPostLink' }, category: 'Data' },
    },
    next: {
      control: 'object',
      description: 'Right card: `{ href, title, kicker? }`. Omit for the last post in a series.',
      table: { type: { summary: 'PrevNextPostLink' }, category: 'Data' },
    },
    loading: {
      control: 'boolean',
      description:
        'Paint a `<Skeleton variant="prev-next-post" />` pair instead of the links, and mark the nav `aria-busy`. The sibling titles usually arrive on the same async query as the article body.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    'aria-label': {
      control: 'text',
      description:
        'Landmark label. Override when a page holds more than one of these (e.g. chapter nav plus series nav) so the rotor entries stay distinguishable.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: "'Article navigation'" },
        category: 'Accessibility',
      },
    },
    'data-testid': {
      control: 'text',
      description:
        'Required selector hook (R5). Each side derives `{value}-prev` / `{value}-next`.',
      table: { type: { summary: 'string' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<nav>` grid — the spacing / width seam.',
      table: { category: 'Appearance' },
    },
  },
} satisfies Meta<typeof PrevNextPost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { prev, next, loading: false, 'aria-label': 'Article navigation' },
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
          data-testid="story-prev-next-both"
        />
      </div>
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">
          only next (first post in series)
        </div>
        <PrevNextPost
          next={next}
          aria-label="Article navigation — only next"
          data-testid="story-prev-next-only-next"
        />
      </div>
      <div>
        <div className="mb-2 text-xs font-mono uppercase text-muted-foreground">
          only prev (last post in series)
        </div>
        <PrevNextPost
          prev={prev}
          aria-label="Article navigation — only prev"
          data-testid="story-prev-next-only-prev"
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
          data-testid="story-prev-next-kickers"
        />
      </div>
    </div>
  ),
};

/**
 * The footer of a long article is the exact moment a reader arrives, so a
 * late-resolving sibling query must not grow the page under the cursor.
 */
export const Loading: Story = {
  args: { loading: true },
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
      // overflow-x-auto: the 400px frame is deliberately below MIN_VIEWPORT, so
      // without an inner scroller it pushes the whole page sideways at 375px.
      <div className="overflow-x-auto">
        <div style={{ width: 400 }}>
          <Story />
        </div>
      </div>
    ),
  ],
};
