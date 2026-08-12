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
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Grid tile for one article link — cover, byline, headline, excerpt, tags and an ' +
          'engagement meta row, with the whole tile acting as a single anchor. Reach for it ' +
          'in "from the blog" grids, external-content lists and feed aggregations. For the ' +
          'full-bleed hero tile that usually sits above such a grid, render ' +
          '`FeaturedArticleCard` instead: the two are separate components because the ' +
          'rendered tree differs entirely, which is why `variant` is deprecated.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description:
        'Article headline. Clamped to two lines, and reused as the gradient fallback when there is no cover. Optional only while `loading`.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    description: {
      control: 'text',
      description: 'Short excerpt under the headline. Clamped to two lines; omit it for a denser tile.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    href: {
      control: 'text',
      description: 'Destination URL. The entire card becomes the link to it.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    sourceLabel: {
      control: 'text',
      description:
        'Small uppercase attribution chip floated over the cover (e.g. "Dev.to"). Omit for first-party content.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    imageUrl: {
      control: 'text',
      description:
        'Cover image URL. When omitted the card paints a brand gradient with the title centred on it, so a missing cover is still a designed state.',
      table: { category: 'Media', type: { summary: 'string' } },
    },
    tags: {
      control: 'object',
      description:
        'Topic tags. The first three render as filled badges; anything beyond collapses into a single "+N" overflow chip.',
      table: { category: 'Data', type: { summary: 'string[]' } },
    },
    author: {
      control: 'object',
      description: 'Author block — `name` is shown next to an optional round `imageUrl` avatar.',
      table: {
        category: 'Data',
        type: { summary: '{ name: string; imageUrl?: string }' },
      },
    },
    publishedAt: {
      control: 'text',
      description:
        'Publication date — any value the `Date` constructor accepts. Rendered short-form (`Mar 5, 2026`).',
      table: { category: 'Data', type: { summary: 'string | number | Date' } },
    },
    meta: {
      control: 'object',
      description:
        'Footer engagement chips. Every field is optional and an absent field renders no chip; `views` abbreviates at ≥ 1000 (`1240` → `1.2k`).',
      table: {
        category: 'Data',
        type: {
          summary:
            '{ reactions?: number; comments?: number; readingTimeMinutes?: number; views?: number }',
        },
      },
    },
    external: {
      control: 'boolean',
      description: 'Open the link in a new tab (`target="_blank"` + `rel="noopener noreferrer"`).',
      table: { category: 'Behavior', type: { summary: 'boolean' }, defaultValue: { summary: 'true' } },
    },
    priority: {
      control: 'boolean',
      description:
        'Declare the cover as the route LCP element — eager-loads it with `fetchpriority="high"`. Set it on the single card above the fold, never on a whole grid.',
      table: { category: 'Behavior', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    loading: {
      control: 'boolean',
      description:
        'Swap the card for a shape-matched skeleton (cover + title lines + meta silhouette) so a grid does not shift when data arrives.',
      table: { category: 'State', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    variant: {
      control: 'select',
      options: [undefined, 'stack', 'overlay'],
      description:
        'DEPRECATED. `overlay` still forwards to `FeaturedArticleCard` for one minor and warns in dev; pass no variant for the stacked tile.',
      table: {
        category: 'Deprecated',
        type: { summary: "'stack' | 'overlay'" },
        defaultValue: { summary: 'undefined' },
      },
    },
    'data-testid': {
      control: 'text',
      description:
        'Required root selector hook. Every sub-part derives from it (`{value}-title`, `{value}-tags`, `{value}-meta-views`, …) — there is no runtime default, so an omission surfaces at the call site.',
      table: { category: 'Testing', type: { summary: 'string' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the outer anchor — this is where a grid sets the tile width.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
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

/**
 * The skeleton the registry embeds as this component's loading demo — the
 * shape the card reserves before the article resolves, at the same 380px the
 * real card occupies, so the swap costs no layout shift.
 */
export const Loading: Story = {
  ...Default,
  args: { loading: true },
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
    <div className="space-y-6 p-6 bg-background">
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

/**
 * `renderImage` — the framework seam, and why it exists.
 *
 * The DS ships a plain `<img>` and cannot import `next/image` without giving
 * up being framework-agnostic. So every Next.js consumer replaced that one
 * element by hand — a fork of the whole component to change its cover. The
 * slot hands a render prop the exact bag of props the card would have spread
 * onto the element, and defaults to spreading them onto an `<img>`, so not
 * passing it is byte-identical to the old behaviour.
 *
 * The adapter below stands in for `next/image`: it forwards `className`, which
 * is where the `object-cover` fit and the `motion-safe:group-hover:scale-105`
 * reduced-motion gate live. An adapter that drops it opts out of both — hover
 * the two tiles and only the left one zooms.
 */
export const RenderImageSlot: Story = {
  name: 'renderImage — a framework-specific cover',
  args: { ...lockArgs },
  decorators: [(Story) => <div className="w-[380px] max-w-full"><Story /></div>],
  render: (args) => (
    <div className="flex flex-wrap gap-md">
      <div className="w-[380px] max-w-full">
        <ArticleCard
          {...args}
          data-testid="slot-card"
          renderImage={({ src, alt, width, height, className, ...rest }) => (
            // Stand-in for `next/image`: a different element, the same bag.
            <img
              data-slot="custom-cover"
              src={src}
              alt={alt}
              width={width}
              height={height}
              className={className}
              {...rest}
            />
          )}
        />
      </div>
      <div className="w-[380px] max-w-full">
        <ArticleCard {...args} data-testid="default-card" />
      </div>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('The slot output REPLACES the default img, it does not join it', async () => {
      const slotCard = canvasElement.querySelector('[data-testid="slot-card"]')!;
      const covers = slotCard.querySelectorAll('img[width="1000"]');
      // One cover, and it is the adapter's element — two would mean the card
      // renders both and the consumer downloads the image twice.
      expect(covers.length).toBe(1);
      expect(covers[0]).toHaveAttribute('data-slot', 'custom-cover');
    });

    await step('The bag carries the fit and the reduced-motion gate', async () => {
      const cover = canvasElement.querySelector('[data-slot="custom-cover"]')!;
      expect(cover.className).toContain('object-cover');
      expect(cover.className).toContain('motion-safe:group-hover:scale-105');
    });

    await step('Omitting the slot still renders a plain img', async () => {
      const defaultCard = canvasElement.querySelector('[data-testid="default-card"]')!;
      const cover = defaultCard.querySelector('img[width="1000"]')!;
      expect(cover.tagName).toBe('IMG');
      expect(cover).not.toHaveAttribute('data-slot', 'custom-cover');
    });
  },
};

/**
 * The cover box reserves the cover's own ratio.
 *
 * It used to reserve `h-44` — a fixed 176px height, which fixes nothing about
 * the RATIO, because the ratio then floats with the card's width. At the 320px
 * viewport floor a tile is ~302px wide: a 1.72:1 box holding a 2.38:1 cover, so
 * `object-cover` scaled the image to 419px to cover 176px of height and the box
 * threw away 117 of them — 28% of the cover, and a different figure at every
 * breakpoint. `aspect-[1000/420]` is the ratio of the `width`/`height` the card
 * already declares on the image, so the crop is zero at every width below.
 *
 * The three tiles are the same card at the 320px floor, a typical grid column
 * and a wide column. Watch the right edge of the cover: it is the same picture
 * in all three.
 */
export const CoverRatioAcrossWidths: Story = {
  name: 'Cover box — same crop at 302 / 380 / 560px',
  args: { ...lockArgs },
  render: (args) => (
    <div className="flex flex-wrap items-start gap-md">
      {[302, 380, 560].map((w) => (
        <div key={w} style={{ width: w, maxWidth: '100%' }}>
          <ArticleCard {...args} data-testid={`ratio-card-${w}`} />
          <p className="mt-2 text-xs text-muted-foreground">{w}px column</p>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('Every cover box is the image’s own ratio, not a fixed height', async () => {
      for (const w of [302, 380, 560]) {
        const card = canvasElement.querySelector(`[data-testid="ratio-card-${w}"]`)!;
        const img = card.querySelector('img[width="1000"]') as HTMLImageElement;
        const box = img.parentElement!;
        // Real layout, not jsdom: the rendered box must match 1000/420 to
        // within a pixel of rounding.
        const rect = box.getBoundingClientRect();
        const ratio = rect.width / rect.height;
        expect(Math.abs(ratio - 1000 / 420)).toBeLessThan(0.02);
      }
    });
  },
};
