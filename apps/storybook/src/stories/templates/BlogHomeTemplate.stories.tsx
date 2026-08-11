import type { Meta, StoryObj } from '@storybook/react-vite';
import { BlogHomeTemplate } from '@interlace/ui/templates/blog-home-template';
import { ArticleListGrid } from '@interlace/ui/patterns/article-list-grid';
import { NewsletterForm } from '@interlace/ui/patterns/newsletter-form';
import { withRtl } from '@/decorators';

const meta: Meta<typeof BlogHomeTemplate> = {
  title: 'Templates/BlogHomeTemplate',
  component: BlogHomeTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Blog index surface: topbar, greeting hero, featured + recent article grid, optional newsletter capture, footer. The default shape for a personal or company blog home. For a filtered index use `TagTemplate`; for a single post use `ArticleTemplate`.",
      },
    },
  },
  argTypes: {
    topbar: { control: 'object', description: 'Props forwarded to Topbar.', table: { category: 'Data' } },
    hero: { control: false, description: 'Optional greeting / about block above the grid.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
    articles: { control: false, description: 'Required. The rendered post list — normally an ArticleListGrid.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
    newsletter: { control: false, description: 'Optional capture form. Omit to drop the section entirely.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
    footer: { control: 'object', description: 'Props forwarded to Footer.', table: { category: 'Data' } },
  },
};

export default meta;
type Story = StoryObj<typeof BlogHomeTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-primary to-chart-2"
    />
    <span>Ofri&apos;s Blog</span>
  </a>
);

const samplePost = {
  title: 'Templates are the distribution surface',
  description: 'Why we ship full pages, not just primitives.',
  href: '/articles/templates-distribution',
  tags: ['ds', 'arch'],
  'data-testid': 'blog-article-card',
};

export const Default: Story = {
  args: {
    topbar: {
      logo,
      links: [
        { href: '/blog', label: 'Articles' },
        { href: '/about', label: 'About' },
      ],
    },
    articles: (
      <ArticleListGrid
        title="Latest posts"
        featured={samplePost}
        posts={[
          samplePost,
          { ...samplePost, title: 'Lock tests as documentation' },
          { ...samplePost, title: 'The 5-layer DS architecture' },
        ]}
      />
    ),
    newsletter: (
      <div className="mx-auto max-w-prose px-md py-xl">
        <NewsletterForm
          title="Get new posts in your inbox"
          description="One email per published article. No spam."
        />
      </div>
    ),
    footer: {
      brand: logo,
      copyright: '© 2026 Ofri Peretz.',
    },
  },
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
export const RTL: Story = { ...Default, decorators: [withRtl] };

/**
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <BlogHomeTemplate.Skeleton />,
};
