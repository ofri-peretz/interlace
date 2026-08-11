import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArticleListGrid } from '@interlace/ui/patterns/article-list-grid';
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

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
export const RTL: Story = { ...Default, decorators: [withRtl] };
