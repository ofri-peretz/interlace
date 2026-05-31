import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArticleListGrid } from '@interlace/ui/patterns/article-list-grid';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof ArticleListGrid> = {
  title: 'Blocks/ArticleListGrid',
  component: ArticleListGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Blog index pattern. Optional featured ArticleCard (overlay variant) above a 2-4 column grid of regular cards. Supports loading + empty.',
      },
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
};

const samplePosts = [
  samplePost,
  { ...samplePost, title: 'Lock tests as documentation' },
  { ...samplePost, title: 'Why React 19 changed our refs' },
  { ...samplePost, title: 'The 5-layer DS architecture' },
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

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
