import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArticleTemplate } from '@interlace/ui/templates/article-template';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof ArticleTemplate> = {
  title: 'Templates/ArticleTemplate',
  component: ArticleTemplate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Full-page surface for long-form articles. Composes the header (title + AuthorByline), the body (Prose-wrapped), share buttons, prev/next, and related-posts grid — each in its own <SectionBoundary> so the page streams section-by-section instead of blocking on the slowest data source.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ArticleTemplate>;

const sampleByline = {
  name: 'Ofri Peretz',
  role: 'Author',
  publishedAt: '2026-05-30T08:00:00.000Z',
  readingTimeMinutes: 6,
};

const SampleBody = () => (
  <>
    <h2 id="why-this-matters">Why this matters</h2>
    <p>
      The Interlace DS ships in a public registry, which means every
      change is read by humans and agents alike. Templates close the
      loop: instead of duplicating the article surface across blog,
      docs, and partner sites, the consumer drops one component and
      inherits the streaming, error-boundary, and skeleton contract.
    </p>
    <h2 id="how-it-works">How it works</h2>
    <p>
      Each section is wrapped in <code>{`<SectionBoundary />`}</code> so
      the page paints incrementally — the header doesn&apos;t wait for
      related posts, related posts don&apos;t wait for share buttons.
    </p>
    <p>
      <em>One template, five sections, four skeletons, zero blocked
      paints.</em>
    </p>
  </>
);

const sampleRelated = {
  posts: [
    {
      href: '/articles/the-eslint-rule-quality-bar',
      title: 'The ESLint rule quality bar',
      description: 'How we score every rule before it ships.',
    },
    {
      href: '/articles/shipping-strict-a11y',
      title: 'Shipping strict accessibility in our docs site',
      description: 'WCAG 2.2 AA + ACT in CI, with no asterisks.',
    },
  ],
};

const samplePrevNext = {
  prev: {
    href: '/articles/the-eslint-rule-quality-bar',
    kicker: 'Previous',
    title: 'The ESLint rule quality bar',
  },
  next: {
    href: '/articles/shipping-strict-a11y',
    kicker: 'Next',
    title: 'Shipping strict accessibility in our docs site',
  },
};

const sampleShare = {
  url: 'https://example.com/articles/templates-are-the-distribution-surface',
  title: 'Templates are the distribution surface',
};

export const Default: Story = {
  render: () => (
    <ArticleTemplate
      title="Templates are the distribution surface"
      byline={sampleByline}
      body={<SampleBody />}
      share={sampleShare}
      prevNext={samplePrevNext}
      related={sampleRelated}
    />
  ),
};

/**
 * Loading — every SectionBoundary's child throws a forever-pending
 * promise so each boundary's skeleton fallback paints. Useful for
 * stress-testing the visual + a11y story of the loading layout.
 */
const ForeverPending = () => {
  throw new Promise(() => {});
};

export const Loading: Story = {
  render: () => (
    <ArticleTemplate
      title={<ForeverPending />}
      header={<ForeverPending />}
      body={<ForeverPending />}
      share={{ url: '#', title: 'loading' }}
      prevNext={{
        prev: { href: '#', kicker: 'Previous', title: 'loading' },
      }}
      related={{ posts: [] }}
    />
  ),
};

/**
 * Error — body section throws synchronously; the boundary catches and
 * renders the destructive fallback. Other sections render normally,
 * proving boundaries are independent.
 */
const Thrower = () => {
  throw new Error('demo: body failed to load');
};

export const ErrorState: Story = {
  render: () => (
    <ArticleTemplate
      title="Templates are the distribution surface"
      byline={sampleByline}
      body={<Thrower />}
      share={sampleShare}
      prevNext={samplePrevNext}
      related={sampleRelated}
    />
  ),
};

/**
 * Empty — `share={null}` suppresses the share section; `related` and
 * `prevNext` omitted entirely. Demonstrates the minimal surface for a
 * niche or unlinked post.
 */
export const Empty: Story = {
  render: () => (
    <ArticleTemplate
      title="A standalone post"
      byline={sampleByline}
      body={<SampleBody />}
      share={null}
    />
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
