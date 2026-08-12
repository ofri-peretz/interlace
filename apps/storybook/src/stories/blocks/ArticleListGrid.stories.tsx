import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArticleListGrid } from '@interlace/ui/patterns/article-list-grid';
import { DataState } from '@interlace/ui/data-state';
// Aliased — `EmptyState` is taken by a story export name in this file's family.
import { EmptyState as EmptyPanel } from '@interlace/ui/patterns/empty-state';
import { withRtl } from '@/decorators';

const meta: Meta<typeof ArticleListGrid> = {
  title: 'Blocks/ArticleListGrid',
  component: ArticleListGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Whole blog-index section: an optional featured hero card above a responsive grid ' +
          'of ArticleCards, wrapped in the content Container with its own heading, loading ' +
          'and empty states. Reach for it when you are rendering a list of posts as a page ' +
          'section; drop to bare `ArticleCard`s when you need a different heading, filter ' +
          'chrome or pagination around the grid.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Section heading, rendered as an `h2` above the grid.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    lead: {
      control: 'text',
      description: 'One-line muted intro under the title.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    featured: {
      control: 'object',
      description:
        'Optional hero article. Rendered as the full-bleed overlay card above the grid, always with `priority` set — it is the LCP element of a blog index.',
      table: { category: 'Data', type: { summary: 'ArticleCardProps' } },
    },
    posts: {
      control: 'object',
      description: 'The grid tiles. Each entry is passed straight through to an `ArticleCard`.',
      table: {
        category: 'Data',
        type: { summary: 'ArticleCardProps[]' },
        defaultValue: { summary: '[]' },
      },
    },
    cols: {
      control: 'select',
      options: [2, 3, 4],
      description:
        'Desktop track count. Always 1 column on mobile and 2 from `sm`, so this is the lg-and-up ceiling rather than a fixed count.',
      table: {
        category: 'Appearance',
        type: { summary: '2 | 3 | 4' },
        defaultValue: { summary: '3' },
      },
    },
    loading: {
      control: 'boolean',
      description: 'Render a featured-sized skeleton plus a grid of card skeletons instead of the posts.',
      table: { category: 'State', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    loadingCount: {
      control: { type: 'range', min: 1, max: 12, step: 1 },
      description: 'How many grid skeletons to paint while loading. Defaults to `cols`.',
      table: { category: 'State', type: { summary: 'number' }, defaultValue: { summary: 'cols' } },
    },
    emptyState: {
      control: false,
      description:
        'Replaces the default "No articles yet." line when there is no featured card and no posts. Not editable from Controls — pass a node in code.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<section>` — the seam for section padding or a tinted band.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ArticleListGrid>;

const samplePost = {
  title: 'Templates are the distribution surface',
  description: 'Why we ship full pages, not just primitives.',
  href: '/articles/templates-distribution',
  imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=400&fit=crop',
  tags: ['ds', 'arch'],
  author: { name: 'Ofri Peretz' },
  publishedAt: '2026-05-30',
  // Required by ArticleCard — every sub-part id derives from it, so each tile
  // below gets its own root rather than four cards sharing one selector.
  'data-testid': 'article-featured',
};

const samplePosts = [
  { ...samplePost, 'data-testid': 'article-tile-0' },
  { ...samplePost, title: 'Lock tests as documentation', 'data-testid': 'article-tile-1' },
  { ...samplePost, title: 'Why React 19 changed our refs', 'data-testid': 'article-tile-2' },
  { ...samplePost, title: 'The 5-layer DS architecture', 'data-testid': 'article-tile-3' },
];

export const Default: Story = {
  args: {
    title: 'Latest articles',
    lead: 'Recent posts from the team.',
    featured: samplePost,
    posts: samplePosts,
  },
};

export const NoFeatured: Story = {
  args: { ...Default.args, featured: undefined },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { posts: [] } };

/**
 * The built-in empty state, replaced with the `EmptyState` pattern.
 *
 * `Empty` above renders the component's own default — "No articles yet.",
 * which is the right sentence for an index that has genuinely never had a
 * post. It is the WRONG sentence for a filtered index, where the reader made
 * the list empty and needs a way back. Same absence, different cause,
 * different copy — which is what the `emptyState` slot exists for.
 */
export const EmptyFiltered: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '"No articles yet." is right for an index that never had a post and wrong for one the reader just filtered to nothing. The `emptyState` slot takes the `EmptyState` pattern so the panel can carry the way out.',
      },
    },
  },
  args: {
    posts: [],
    featured: undefined,
    emptyState: (
      <EmptyPanel
        title="No articles match these filters"
        description="Try a broader tag, or clear the date range."
      />
    ),
  },
};

/**
 * A failed fetch, which `ArticleListGrid` has no prop for — deliberately.
 *
 * The component owns `loading` and `emptyState` and stops there. Adding an
 * `error` prop to every list-shaped pattern in the package is how you end up
 * with five slightly different retry buttons and five spellings of the same
 * sentence. `DataState` is the one place that vocabulary lives.
 *
 * The distinction it preserves is not cosmetic: "there are no articles" and
 * "we could not find out whether there are articles" lead to different reader
 * actions, and only the second one is worth a retry.
 */
export const ErrorState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'No `error` prop, on purpose — `DataState` owns the failure vocabulary so every list does not grow its own. Announced through `role="alert"`, and visibly distinct from the empty case.',
      },
    },
  },
  render: () => (
    <DataState<typeof samplePosts>
      error={new Error('content API unreachable')}
      data={undefined}
      announce={{ noun: 'articles' }}
      className="p-lg"
    >
      {(posts) => <ArticleListGrid title="Latest articles" posts={posts} />}
    </DataState>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
export const EmptyFilteredDark: Story = { ...EmptyFiltered, globals: { theme: 'dark' } };
export const ErrorStateDark: Story = { ...ErrorState, globals: { theme: 'dark' } };
export const RTL: Story = { ...Default, decorators: [withRtl] };
