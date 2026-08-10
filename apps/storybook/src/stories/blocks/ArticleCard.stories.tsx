import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
  ArticleCard,
  FeaturedArticleCard,
} from '@interlace/ui/patterns/article-card';
import { articleFixtures } from '@/fixtures/articles';

const meta: Meta<typeof ArticleCard> = {
  title: 'Blocks/ArticleCard',
  component: ArticleCard,
  // NOT `centered`: an article card is a width-filling block. Centered sizes the
  // story root to content, so `w-full` inside resolves against an indefinite
  // container and the 380px card frame outgrows a 375px phone viewport.
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof ArticleCard>;

export const Default: Story = {
  args: articleFixtures[0],
  decorators: [
    (Story) => (
      <div className="w-[380px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const WithoutImage: Story = {
  args: articleFixtures[1],
  decorators: [
    (Story) => (
      <div className="w-[380px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const ManyTags: Story = {
  args: {
    ...articleFixtures[0],
    tags: ['security', 'eslint', 'nodejs', 'static-analysis', 'taint', 'cwe'],
  },
  decorators: [
    (Story) => (
      <div className="w-[380px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const Dark: Story = {
  args: articleFixtures[2],
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="w-[380px] max-w-full dark">
        <Story />
      </div>
    ),
  ],
};

export const Grid: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="grid grid-cols-1 gap-6 p-8 md:grid-cols-2 lg:grid-cols-3">
      {articleFixtures.map((a) => (
        <ArticleCard key={a.href} {...a} />
      ))}
    </div>
  ),
};

// ─── LCP priority lock ────────────────────────────────────────────────────────
// The `/articles` page renders one featured overlay above the fold; that
// cover image is the LCP element and must opt into eager loading +
// fetchpriority="high". These stories lock that contract and are scanned by
// axe via the storybook a11y workflow.

/** Cover image eager-loaded + high priority — the featured slot. */
export const FeaturedPriority: Story = {
  render: (args) => <FeaturedArticleCard {...args} />,
  args: { ...articleFixtures[0], priority: true },
  decorators: [
    (Story) => (
      <div className="w-[760px] max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link');
    const img = link.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  },
};

/** Featured card without the priority hint — cover stays lazy + auto-priority. */
export const FeaturedLazy: Story = {
  render: (args) => <FeaturedArticleCard {...args} />,
  args: { ...articleFixtures[0] },
  decorators: [
    (Story) => (
      <div className="w-[760px] max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link');
    const img = link.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('fetchpriority', 'auto');
  },
};

/** Stack variant honouring the priority hint — useful for above-the-fold grid tiles. */
export const StackPriority: Story = {
  args: { ...articleFixtures[0], priority: true },
  decorators: [
    (Story) => (
      <div className="w-[380px] max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link');
    const img = link.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  },
};

// ─── Contract locks (play functions assert testids + DOM contract) ───────────
// These lock the component's contract — testid surface, link semantics, tag
// overflow math, FEATURED chip semantics, Parity diff. They sit on inline
// baseArgs (independent of articleFixtures) so they can't be invalidated by a
// fixture refactor.

const lockArgs = {
  title: 'How we shipped strict accessibility in our docs site',
  description:
    'A walkthrough of axe-core, color contrast, reduced motion, and the layered self-test model.',
  href: 'https://example.com/post',
  imageUrl:
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80&auto=format&fit=crop',
  tags: ['accessibility', 'tailwind', 'fumadocs'],
  author: {
    name: 'Ofri Peretz',
    imageUrl:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=64&q=80&auto=format&fit=crop',
  },
  publishedAt: '2026-05-10',
  meta: { reactions: 42, comments: 8, readingTimeMinutes: 7, views: 1240 },
  sourceLabel: 'Dev.to',
  // Every part id below derives from this root — that derivation IS the
  // contract these locks assert (R5).
  'data-testid': 'lock-card',
};

export const StackContract: Story = {
  args: { ...lockArgs },
  decorators: [(Story) => <div className="w-[360px] max-w-full"><Story /></div>],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Rendered as a single link wrapping the whole card', async () => {
      const link = canvas.getByRole('link');
      expect(link).toHaveAttribute('href', lockArgs.href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('data-slot', 'article-card');
      expect(link).toHaveAttribute('data-testid', 'lock-card');
    });

    await step('Shows title, description, and tags', async () => {
      expect(canvas.getByTestId('lock-card-title')).toHaveTextContent(lockArgs.title);
      expect(canvas.getByTestId('lock-card-description')).toHaveTextContent(
        lockArgs.description,
      );
      const tagBlock = canvas.getByTestId('lock-card-tags');
      for (const tag of lockArgs.tags) {
        expect(tagBlock).toHaveTextContent(`#${tag}`);
      }
    });

    await step('Renders all four meta chips with stable text', async () => {
      expect(canvas.getByTestId('lock-card-meta-reactions')).toHaveTextContent('42');
      expect(canvas.getByTestId('lock-card-meta-comments')).toHaveTextContent('8');
      expect(canvas.getByTestId('lock-card-meta-reading-time')).toHaveTextContent('7 min');
      // 1240 views renders abbreviated.
      expect(canvas.getByTestId('lock-card-meta-views')).toHaveTextContent('1.2k');
    });

    await step('Shows source label, no FEATURED chip in stack mode', async () => {
      expect(canvas.getByTestId('lock-card-source')).toHaveTextContent('Dev.to');
      expect(canvas.queryByTestId('lock-card-featured-chip')).toBeNull();
    });
  },
};

export const StackTagOverflow: Story = {
  args: {
    ...lockArgs,
    tags: ['accessibility', 'tailwind', 'fumadocs', 'mdx', 'next', 'react'],
  },
  decorators: [(Story) => <div className="w-[360px] max-w-full"><Story /></div>],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('First 3 tags shown verbatim', async () => {
      const tags = canvas.getByTestId('lock-card-tags');
      expect(tags).toHaveTextContent('#accessibility');
      expect(tags).toHaveTextContent('#tailwind');
      expect(tags).toHaveTextContent('#fumadocs');
    });
    await step('Remaining tags collapse into +N chip (6 total → +3)', async () => {
      const tags = canvas.getByTestId('lock-card-tags');
      expect(tags).toHaveTextContent('+3');
      expect(tags).not.toHaveTextContent('#mdx');
      expect(tags).not.toHaveTextContent('#next');
      expect(tags).not.toHaveTextContent('#react');
    });
  },
};

export const StackMinimal: Story = {
  args: {
    title: 'Minimal card: only title + href',
    href: 'https://example.com',
    'data-testid': 'lock-card',
  },
  decorators: [(Story) => <div className="w-[360px] max-w-full"><Story /></div>],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('link')).toBeInTheDocument();
    expect(canvas.getByTestId('lock-card-title')).toBeInTheDocument();
    expect(canvas.queryByTestId('lock-card-meta-reactions')).toBeNull();
    expect(canvas.queryByTestId('lock-card-meta-comments')).toBeNull();
    expect(canvas.queryByTestId('lock-card-meta-reading-time')).toBeNull();
    expect(canvas.queryByTestId('lock-card-meta-views')).toBeNull();
    expect(canvas.queryByTestId('lock-card-featured-chip')).toBeNull();
  },
};

export const FeaturedContract: Story = {
  render: (args) => <FeaturedArticleCard {...args} />,
  args: { ...lockArgs },
  decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Whole card is one link, carrying the root test id', async () => {
      const link = canvas.getByRole('link');
      expect(link).toHaveAttribute('href', lockArgs.href);
      expect(link).toHaveAttribute('data-slot', 'article-card');
      expect(link).toHaveAttribute('data-testid', 'lock-card');
    });

    await step('FEATURED chip shown (top-left)', async () => {
      expect(canvas.getByTestId('lock-card-featured-chip')).toHaveTextContent(/featured/i);
    });

    await step('Title, description, tags, source, meta all present', async () => {
      expect(canvas.getByTestId('lock-card-title')).toHaveTextContent(lockArgs.title);
      expect(canvas.getByTestId('lock-card-description')).toHaveTextContent(lockArgs.description);
      expect(canvas.getByTestId('lock-card-tags')).toHaveTextContent('#accessibility');
      expect(canvas.getByTestId('lock-card-source')).toHaveTextContent('Dev.to');
      expect(canvas.getByTestId('lock-card-meta-reactions')).toHaveTextContent('42');
      expect(canvas.getByTestId('lock-card-meta-views')).toHaveTextContent('1.2k');
    });
  },
};

export const FeaturedWithoutCover: Story = {
  render: (args) => <FeaturedArticleCard {...args} />,
  args: { ...lockArgs, imageUrl: undefined },
  decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('lock-card-featured-chip')).toBeInTheDocument();
    // Title appears in both the gradient fallback and the body.
    const titleMatches = canvas.getAllByText(lockArgs.title);
    expect(titleMatches.length).toBeGreaterThanOrEqual(2);
  },
};

/**
 * Visual diff guard: one featured card over a grid of three. The two shapes
 * are separate components now, so this is where you see whether they still
 * read as the same family — same chip styling, same hover, same focus ring.
 */
export const Parity: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="space-y-6 p-6 bg-fd-background">
      <FeaturedArticleCard {...lockArgs} data-testid="parity-featured" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ArticleCard {...lockArgs} data-testid="parity-tile-0" />
        <ArticleCard {...lockArgs} data-testid="parity-tile-1" title="Another grid card with a longer headline that wraps to two lines" />
        <ArticleCard {...lockArgs} data-testid="parity-tile-2" imageUrl={undefined} title="Third tile uses the gradient title fallback" />
      </div>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('1 featured + 3 grid tiles render', async () => {
      const links = canvasElement.querySelectorAll('a[data-slot="article-card"]');
      expect(links.length).toBe(4);

      // Which component rendered is now readable from the test id the
      // consumer chose, rather than from a data-variant the DS invented.
      expect(canvas.getByTestId('parity-featured')).toBeInTheDocument();
      for (const i of [0, 1, 2]) {
        expect(canvas.getByTestId(`parity-tile-${i}`)).toBeInTheDocument();
      }
    });

    await step('Only the featured card carries the FEATURED chip', async () => {
      const featuredChips = canvas.queryAllByTestId(/-featured-chip$/);
      expect(featuredChips.length).toBe(1);
    });
  },
};

/**
 * The deprecation path, locked.
 *
 * `variant="overlay"` still renders the featured card for one more minor —
 * consumers upgrade on their own schedule, not ours (R25). This story exists
 * so the forwarding can't quietly rot before the prop is actually removed;
 * delete it in the same change that deletes the prop.
 */
export const DeprecatedVariantStillWorks: Story = {
  args: { ...lockArgs, variant: 'overlay', 'data-testid': 'deprecated-card' },
  decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Forwards to the featured shape', async () => {
      expect(canvas.getByTestId('deprecated-card')).toBeInTheDocument();
      // The FEATURED chip is the featured card's tell — a stacked tile
      // never renders one.
      expect(canvas.getByTestId('deprecated-card-featured-chip')).toHaveTextContent(
        /featured/i,
      );
    });
  },
};
