import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthorTemplate } from '@interlace/ui/templates/author-template';
import { AuthorByline } from '@interlace/ui/patterns/author-byline';
import { ArticleListGrid } from '@interlace/ui/patterns/article-list-grid';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof AuthorTemplate> = {
  title: 'Templates/AuthorTemplate',
  component: AuthorTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof AuthorTemplate>;

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
  title: 'Lock tests as documentation',
  description: 'Why lock tests are the best docs.',
  href: '/articles/lock-tests',
  tags: ['ts', 'arch'],
};

export const Default: Story = {
  args: {
    topbar: { logo, links: [{ href: '/', label: 'Home' }] },
    bio: (
      <AuthorByline
        authorName="Ofri Peretz"
        authorAvatar="https://github.com/shadcn.png"
        authorBio="Engineer · Building the Interlace DS."
        publishedDateIso="2026-05-30"
      />
    ),
    articles: (
      <ArticleListGrid
        title="By Ofri"
        posts={[samplePost, samplePost, samplePost, samplePost]}
      />
    ),
    footer: { copyright: '© 2026 Ofri Peretz.' },
  },
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };

/**
 * PageSkeleton — the page-level loading state a consumer renders from
 * `loading.tsx` while the whole route is in flight. Shapes mirror the
 * real layout so the swap costs no layout shift (R23).
 */
export const PageSkeleton: Story = {
  render: () => <AuthorTemplate.Skeleton />,
};
