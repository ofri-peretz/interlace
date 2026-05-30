import type { Meta, StoryObj } from '@storybook/react-vite';
import { RelatedPosts, type RelatedPost } from '@interlace/ui/blocks/related-posts';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/RelatedPosts',
  component: RelatedPosts,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '"Keep reading" surface at the foot of an article. An h3 heading + a responsive grid of ArticleCards (1 / md:2 / lg:3, gap-md). Server-first; composes Typography + Grid + ArticleCard. MIN_VIEWPORT 480.',
      },
    },
  },
} satisfies Meta<typeof RelatedPosts>;

export default meta;
type Story = StoryObj<typeof meta>;

const samplePosts: RelatedPost[] = [
  {
    href: 'https://example.com/posts/eslint-flat-config',
    title: 'Migrating to ESLint flat config without breaking your team',
    summary:
      'A step-by-step playbook for moving a real codebase to flat config — what survives, what to rewrite, and which plugins still need a shim.',
    publishedDateIso: '2026-05-10',
    kicker: 'Tutorial',
  },
  {
    href: 'https://example.com/posts/oxlint-vs-eslint',
    title: 'Oxlint vs ESLint: when speed buys you a different bug surface',
    summary:
      'Two engines, one rule library. We benchmark a 250-rule preset under both and dig into the failure modes only the slower engine catches.',
    publishedDateIso: '2026-04-22',
    kicker: 'Benchmark',
  },
  {
    href: 'https://example.com/posts/type-aware-rules',
    title: 'Why most rules should stay type-unaware',
    summary:
      'Type information is expensive. We map every rule in the floor to a decision: stay fast and lossless, or go type-aware and pay the build-time cost.',
    publishedDateIso: '2026-03-15',
    kicker: 'Architecture',
  },
];

export const Default: Story = {
  args: { posts: samplePosts },
  decorators: [
    (Story) => (
      <div className="bg-background mx-auto max-w-6xl p-lg">
        <Story />
      </div>
    ),
  ],
};

/**
 * Three permutations of the block:
 *   1. Default heading + 3 posts (the canonical case).
 *   2. Custom title ("More from Interlace").
 *   3. Two posts only — the grid drops the third column at lg, exercising
 *      the "fewer items than columns" path.
 */
export const Variants: Story = {
  render: () => (
    <div className="bg-background mx-auto flex max-w-6xl flex-col gap-2xl p-lg">
      <RelatedPosts posts={samplePosts} />

      <RelatedPosts title="More from Interlace" posts={samplePosts} />

      <RelatedPosts
        title="Two related posts"
        posts={samplePosts.slice(0, 2)}
      />
    </div>
  ),
};

export const Dark: Story = {
  args: { posts: samplePosts },
  decorators: [
    withDark,
    (Story) => (
      <div className="bg-background mx-auto max-w-6xl p-lg">
        <Story />
      </div>
    ),
  ],
};

export const RTL: Story = {
  args: { posts: samplePosts },
  decorators: [
    withRtl,
    (Story) => (
      <div className="bg-background mx-auto max-w-6xl p-lg">
        <Story />
      </div>
    ),
  ],
};

/**
 * Renders the block inside a 400px-wide frame — below MIN_VIEWPORT (480).
 * The grid collapses to a single column (already the `cols=1` base), so the
 * layout itself stays usable; the dev-mode preflight outline flags that the
 * block is being asked to render below its declared floor.
 */
export const BelowMinViewport: Story = {
  args: { posts: samplePosts },
  render: (args) => (
    <div className="w-[400px] border border-dashed border-fd-border p-sm">
      <RelatedPosts {...args} />
    </div>
  ),
};
