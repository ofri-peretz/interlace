import type { Meta, StoryObj } from '@storybook/react-vite';
import { TagTemplate } from '@interlace/ui/templates/tag-template';
import { ArticleListGrid } from '@interlace/ui/patterns/article-list-grid';
import { Tag, TagList } from '@interlace/ui/tag';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof TagTemplate> = {
  title: 'Templates/TagTemplate',
  component: TagTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof TagTemplate>;

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
  title: 'TypeScript-first DS',
  description: 'Why we lean on TS unions everywhere.',
  href: '/articles/ts-first',
  tags: ['typescript'],
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

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
