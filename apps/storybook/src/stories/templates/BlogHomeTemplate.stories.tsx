import type { Meta, StoryObj } from '@storybook/react-vite';
import { BlogHomeTemplate } from '@interlace/ui/templates/blog-home-template';
import { ArticleListGrid } from '@interlace/ui/patterns/article-list-grid';
import { NewsletterForm } from '@interlace/ui/patterns/newsletter-form';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof BlogHomeTemplate> = {
  title: 'Templates/BlogHomeTemplate',
  component: BlogHomeTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof BlogHomeTemplate>;

const logo = (
  <a href="/" className="flex items-center gap-2 font-semibold">
    <span
      aria-hidden
      className="inline-block size-6 rounded-md bg-linear-to-br from-violet-500 to-violet-700"
    />
    <span>Ofri&apos;s Blog</span>
  </a>
);

const samplePost = {
  title: 'Templates are the distribution surface',
  description: 'Why we ship full pages, not just primitives.',
  href: '/articles/templates-distribution',
  tags: ['ds', 'arch'],
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

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
