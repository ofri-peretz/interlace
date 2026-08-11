import type { Meta, StoryObj } from '@storybook/react-vite';
import { TagTemplate } from '@interlace/ui/templates/tag-template';
import { ArticleListGrid } from '@interlace/ui/patterns/article-list-grid';
import { TagList } from '@interlace/ui/tag';
import { withRtl } from '@/decorators';

const meta: Meta<typeof TagTemplate> = {
  title: 'Templates/TagTemplate',
  component: TagTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Tag-filtered article index for `/tags/[slug]` routes — a 'Tagged: #x' header over an ArticleListGrid of matching posts, plus a related-tags rail. Use `BlogHomeTemplate` for the unfiltered index and `AuthorTemplate` when filtering by person.",
      },
    },
  },
  argTypes: {
    topbar: { control: 'object', description: 'Props forwarded to Topbar.', table: { category: 'Data' } },
    tagName: { control: 'text', description: 'The tag being filtered on, without the leading #.', table: { category: 'Content' } },
    tagHref: { control: 'text', description: 'Canonical URL for this tag.', table: { category: 'Content' } },
    lead: { control: 'text', description: 'Optional description of the topic.', table: { category: 'Content' } },
    articles: { control: false, description: 'Required. The rendered list of matching posts — normally an ArticleListGrid.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
    relatedTags: { control: false, description: 'Sibling tags to cross-link.', table: { category: 'Slots', type: { summary: 'ReactNode' } } },
    footer: { control: 'object', description: 'Props forwarded to Footer.', table: { category: 'Data' } },
  },
};

export default meta;
type Story = StoryObj<typeof TagTemplate>;

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
  title: 'TypeScript-first DS',
  description: 'Why we lean on TS unions everywhere.',
  href: '/articles/ts-first',
  tags: ['typescript'],
  'data-testid': 'tag-article-card',
};

export const Default: Story = {
  args: {
    topbar: { logo },
    tagName: 'typescript',
    tagHref: '/tags/typescript',
    lead: 'All articles tagged with #typescript.',
    articles: (
      <ArticleListGrid posts={[samplePost, samplePost, samplePost, samplePost]} />
    ),
    relatedTags: (
      <TagList
        items={[
          { label: 'react', href: '/tags/react' },
          { label: 'ds', href: '/tags/ds' },
          { label: 'a11y', href: '/tags/a11y' },
        ]}
      />
    ),
    footer: { copyright: '© 2026 Ofri Peretz.' },
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
  render: () => <TagTemplate.Skeleton />,
};
