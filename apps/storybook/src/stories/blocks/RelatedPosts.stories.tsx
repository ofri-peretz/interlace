import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { RelatedPosts, type RelatedPost } from '@interlace/ui/patterns/related-posts';
import { DataState } from '@interlace/ui/data-state';
import { withRtl } from '@/decorators';

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

const meta = {
  title: 'Blocks/RelatedPosts',
  component: RelatedPosts,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "keep reading" grid at the foot of an article: an h3 plus one ArticleCard ' +
          'per entry, 1 / md:2 / lg:3 columns. Feed it whatever your recommender returns — ' +
          'it renders `null` on an empty array, so callers never guard the call site. ' +
          'It is not a general card grid: the shape is editorial (`summary`, ' +
          '`publishedDateIso`, `kicker`); use ArticleListGrid for a full index page.',
      },
    },
  },
  args: {
    'data-testid': 'story-related-posts',
    posts: samplePosts,
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Section heading rendered as an h3.',
      table: {
        type: { summary: 'ReactNode' },
        defaultValue: { summary: "'Related posts'" },
      },
    },
    posts: {
      control: 'object',
      description:
        'One ArticleCard per entry, in order. `{ href, title, summary, publishedDateIso, kicker? }`. An empty array renders nothing at all.',
      table: { type: { summary: 'RelatedPost[]' }, category: 'Data' },
    },
    loading: {
      control: 'boolean',
      description:
        'Render `loadingCount` ArticleCard skeletons instead of posts, so the page reserves the grid footprint while the query resolves.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    loadingCount: {
      control: { type: 'range', min: 1, max: 6, step: 1 },
      description: 'How many skeleton cards to paint while `loading`.',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '3' },
        category: 'State',
      },
    },
    'data-testid': {
      control: 'text',
      description:
        'Required selector hook (R5). Each card derives `{value}-card-0`, `{value}-card-1`, …',
      table: { type: { summary: 'string' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<section>` — the outer spacing seam.',
      table: { category: 'Appearance' },
    },
  },
} satisfies Meta<typeof RelatedPosts>;

export default meta;
type Story = StoryObj<typeof meta>;

const framed: Decorator[] = [
  (Story) => (
    <div className="bg-background mx-auto max-w-wide p-lg">
      <Story />
    </div>
  ),
];

export const Default: Story = {
  args: {
    title: 'Related posts',
    posts: samplePosts,
    loading: false,
    loadingCount: 3,
  },
  decorators: framed,
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
    <div className="bg-background mx-auto flex max-w-wide flex-col gap-2xl p-lg">
      <RelatedPosts data-testid="story-related-posts-a" posts={samplePosts} />

      <RelatedPosts
        data-testid="story-related-posts-b"
        title="More from Interlace"
        posts={samplePosts}
      />

      <RelatedPosts
        data-testid="story-related-posts-c"
        title="Two related posts"
        posts={samplePosts.slice(0, 2)}
      />
    </div>
  ),
};

/**
 * Recommendations are usually a second query that resolves after the article
 * body, so without the skeleton the page grows by a full card row exactly as
 * the reader arrives at the footer.
 */
export const Loading: Story = {
  args: { loading: true, loadingCount: 3 },
  decorators: framed,
};

/**
 * No recommendations — and the block renders NOTHING.
 *
 * `RelatedPosts` returns `null` for an empty list, and that is the right call
 * for this block specifically: "here are some other articles" is an offer, and
 * an offer with nothing behind it is worse than no offer. A "no related posts"
 * panel at the foot of an article is noise the reader did not ask for.
 *
 * The story exists so that decision is VISIBLE and deliberate rather than
 * discovered later by someone debugging a missing section. The left column is
 * the component as it ships; the right shows what the same absence looks like
 * when it IS worth stating, via `DataState` — which is the choice a surface
 * with a filter (where the reader caused the emptiness) should make instead.
 */
export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'An empty `posts` array renders nothing at all — an unfulfillable offer is worse than no offer. Contrasted with the `DataState` treatment, which is what to reach for when the reader caused the emptiness and needs to know they did.',
      },
    },
  },
  render: () => (
    <div className="bg-background mx-auto flex max-w-wide flex-col gap-2xl p-lg">
      <section aria-label="Silent absence">
        <p className="text-muted-foreground font-body text-ui-sm mb-sm">
          As it ships — nothing renders below this line:
        </p>
        <RelatedPosts
          data-testid="story-related-posts-silent"
          title="Related posts"
          posts={[]}
        />
      </section>

      <section aria-label="Stated absence">
        <p className="text-muted-foreground font-body text-ui-sm mb-sm">
          The same absence, stated — for a filtered surface:
        </p>
        <DataState<RelatedPost[]> empty data={[]} announce={{ noun: 'related posts' }}>
          {(posts) => (
            <RelatedPosts
              data-testid="story-related-posts-stated"
              title="Related posts"
              posts={posts}
            />
          )}
        </DataState>
      </section>
    </div>
  ),
};

export const EmptyDark: Story = { ...Empty, globals: { theme: 'dark' } };

export const Dark: Story = {
  globals: { theme: 'dark' },
  decorators: [...framed],
};

export const RTL: Story = {
  decorators: [withRtl, ...framed],
};

/**
 * Renders the block inside a 400px-wide frame — below MIN_VIEWPORT (480).
 * The grid collapses to a single column (already the `cols=1` base), so the
 * layout itself stays usable; the dev-mode preflight outline flags that the
 * block is being asked to render below its declared floor.
 */
export const BelowMinViewport: Story = {
  render: (args) => (
    <div className="w-[400px] max-w-full border border-dashed border-border p-sm">
      <RelatedPosts {...args} />
    </div>
  ),
};
