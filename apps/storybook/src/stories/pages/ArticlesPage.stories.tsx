import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArticleCard } from '@interlace/ui/patterns/article-card';
import { Badge } from '@interlace/ui/badge';
import { Button } from '@interlace/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@interlace/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@interlace/ui/pagination';
import {
  ArrowUpDown,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
} from 'lucide-react';

import { articleFixtures } from '@/fixtures/articles';

/**
 * Static composition of the /articles page surface — this is the axe gate's
 * page-level coverage. It exercises the toolbar (search + sort + filter),
 * a featured card, the article grid, and pagination, all using only
 * @interlace/ui primitives + the ArticleCard block. No app-specific state,
 * no router — this is a render-only contract.
 */

/**
 * There is no `ArticlesPage` component — this file composes one out of DS
 * parts. So the controls below are the composition's own knobs, not a prop
 * table: they change how the page is assembled (how many cards, how many
 * tracks, which regions are present), which is exactly the set of decisions a
 * consumer makes when building this surface for real.
 */
interface ArticlesPageArgs {
  /** Cards rendered in the grid. */
  articleCount?: number;
  /** Desktop track count for the grid. */
  columns?: 1 | 2 | 3;
  /** Render the oversized featured card above the grid. */
  featured?: boolean;
  /** Render the pagination nav below the grid. */
  pagination?: boolean;
}

const meta: Meta<ArticlesPageArgs> = {
  title: 'Pages/ArticlesPage',
  parameters: {
    layout: 'fullscreen',
    a11y: {
      // `context`, not `element`. Storybook 10's a11y addon dropped `element`
      // in favour of axe-core's own context spec; passing the removed key
      // leaves the panel stuck on "Preparing accessibility scan" and the story
      // silently unscanned. `.storybook/preview.ts` still sets `element`
      // globally — see the handover note; this file is already on the new API.
      context: '#storybook-root',
      // The page-level story renders three live regions, a toolbar with
      // labelled controls, a featured-article landmark, the grid, and a
      // navigation. axe asserts every label, landmark, and contrast pair.
    },
    docs: {
      description: {
        component:
          'A whole `/articles` surface assembled from DS parts only — Topbar-less on purpose, so what is under test is the *content* column: a page header, a search/sort/filter toolbar, an optional featured card, the ArticleCard grid, and pagination.\n\n' +
          'It exists for two reasons a single-component story cannot cover. First, it is the page-level axe gate: three live regions, a labelled `role="search"` toolbar, a featured landmark, the grid and a nav all in one accessibility tree, where the failures that only appear in composition (duplicate landmarks, an unlabelled second nav, contrast against a real page background) actually show up. Second, it is the reference assembly — the layout decisions (measure, gap scale, where the result count goes, what a filtered-to-nothing page says) that no component owns individually.\n\n' +
          'There is no `ArticlesPage` export to install. Read it as a recipe: every element here is `@interlace/ui` plus `ArticleCard`, with no app state and no router.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    articleCount: {
      control: { type: 'range', min: 0, max: 12, step: 1 },
      description:
        'Cards in the grid, and the number the toolbar reports as results. Drag it to 0 to see why the EmptyState story exists — a grid that simply vanishes reads as a broken page rather than a filtered one.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '9' }, category: 'Data' },
    },
    columns: {
      control: 'inline-radio',
      options: [1, 2, 3],
      description:
        'Desktop track count. Always one column below `md` — the card carries a title, description and tag row, and none of that survives a 160px track.',
      table: { type: { summary: '1 | 2 | 3' }, defaultValue: { summary: '3' }, category: 'Appearance' },
    },
    featured: {
      control: 'boolean',
      description:
        'The oversized promoted card above the grid. It is a real duplicate of a grid entry, so turning it off is the honest layout when nothing is actually being promoted.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Appearance' },
    },
    pagination: {
      control: 'boolean',
      description:
        'The page nav below the grid. Hide it when everything fits on one page — a pagination row with a single reachable page is furniture.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<ArticlesPageArgs>;

/**
 * Written out statically: Tailwind cannot scan a runtime-built
 * `lg:grid-cols-${n}`, so a template literal here silently produces an
 * unstyled single-column grid.
 */
const GRID_COLS: Record<1 | 2 | 3, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
};

const tags = [
  ['security', 12],
  ['eslint', 28],
  ['nodejs', 9],
  ['typescript', 14],
  ['jwt', 5],
  ['static-analysis', 6],
  ['cwe', 3],
] as const;

function PageHeader() {
  return (
    <header className="mx-auto max-w-prose space-y-4 text-center">
      <div className="bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium">
        <BookOpen className="size-4" aria-hidden="true" />
        <span>{articleFixtures.length * 7} Articles Published</span>
      </div>
      <h1 className="text-foreground text-4xl font-bold tracking-tight md:text-5xl">
        Technical Insights
      </h1>
      <p className="text-muted-foreground text-lg leading-relaxed">
        Deep dives into ESLint security, JavaScript performance, and modern
        development practices.
      </p>
    </header>
  );
}

function Toolbar({ resultCount = articleFixtures.length }: { resultCount?: number }) {
  return (
    <div
      role="search"
      aria-label="Filter articles"
      className="bg-card border-border rounded-xl border p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-112 flex-1">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="search">
            Search articles
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search articles…"
            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30 w-full rounded-lg border py-2.5 pr-3 pl-10 transition-colors focus:outline-none focus:ring-2"
          />
        </div>
        <Select defaultValue="date">
          <SelectTrigger className="w-[150px] max-w-full" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Latest</SelectItem>
            <SelectItem value="reactions">Popular</SelectItem>
            <SelectItem value="comments">Discussed</SelectItem>
            <SelectItem value="reading_time">Long Reads</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" aria-label="Toggle sort direction">
          <ArrowUpDown className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="outline">
          <Filter className="mr-2 size-4" aria-hidden="true" />
          Filters
        </Button>
        <p
          className="text-muted-foreground ml-auto text-sm"
          aria-live="polite"
          role="status"
        >
          {resultCount} results
        </p>
      </div>
      <div className="border-border mt-4 border-t pt-4">
        <p className="text-muted-foreground mb-3 text-xs uppercase tracking-wide">
          Filter by topic
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map(([tag, count]) => (
            <Badge
              key={tag}
              variant="outline"
              className="cursor-pointer text-xs font-medium"
            >
              #{tag}
              <span className="bg-muted text-muted-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px]">
                {count}
              </span>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeaturedCard() {
  const f = articleFixtures[2];
  return (
    <a
      href={f.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Featured: ${f.title}`}
      className="from-primary/10 via-primary/5 border-primary/30 hover:border-primary/60 focus-visible:ring-ring relative block overflow-hidden rounded-2xl border-2 bg-gradient-to-br to-transparent p-6 transition-all hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:p-10"
    >
      <span className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider">
        <Sparkles className="size-3" aria-hidden="true" />
        Featured
      </span>
      <h2 className="text-foreground mt-4 text-2xl font-bold leading-tight md:text-3xl">
        {f.title}
      </h2>
      {f.description ? (
        <p className="text-muted-foreground mt-3 max-w-prose text-base leading-relaxed">
          {f.description}
        </p>
      ) : null}
    </a>
  );
}

function PaginationDemo() {
  return (
    <Pagination className="pt-4" aria-label="Article pagination">
      <PaginationContent className="gap-2">
        <PaginationItem>
          <Button variant="outline" disabled>
            <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
            Previous
          </Button>
        </PaginationItem>
        {[1, 2, 3, 4, 5].map((n) => (
          <PaginationItem key={n}>
            <Button
              variant={n === 1 ? 'default' : 'ghost'}
              size="sm"
              className="size-10"
              aria-current={n === 1 ? 'page' : undefined}
            >
              {n}
            </Button>
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button variant="outline">
            Next
            <ChevronRight className="ml-1 size-4" aria-hidden="true" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

/** The whole surface, assembled from the args above. */
function ArticlesSurface({
  articleCount = 9,
  columns = 3,
  featured = true,
  pagination = true,
}: ArticlesPageArgs) {
  // The fixture set is small; repeat it so the control's full range is reachable.
  const pool = Array.from(
    { length: 12 },
    (_, i) => articleFixtures[i % articleFixtures.length],
  );
  const articles = pool.slice(0, articleCount);
  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-wide space-y-8 px-4 py-8">
        <PageHeader />
        <Toolbar resultCount={articles.length} />
        {featured ? <FeaturedCard /> : null}
        <section aria-label="Articles grid">
          <div className={`grid gap-6 ${GRID_COLS[columns]}`}>
            {articles.map((a, i) => (
              <ArticleCard key={`${a.href}-${i}`} {...a} />
            ))}
          </div>
        </section>
        {pagination ? <PaginationDemo /> : null}
        <p className="text-muted-foreground pt-8 text-center text-sm">
          Last synced: May 10, 2026, 3:21 PM
        </p>
      </div>
    </main>
  );
}

export const Default: Story = {
  args: { articleCount: 9, columns: 3, featured: true, pagination: true },
  render: (args) => <ArticlesSurface {...args} />,
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  args: { articleCount: 6, columns: 3, featured: true, pagination: true },
  render: (args) => (
    <div className="dark">
      <ArticlesSurface {...args} />
    </div>
  ),
};

export const EmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Filtered to nothing. The toolbar keeps its own result count honest (0, not the unfiltered total), and the panel is `role="status"` so the change is announced rather than only drawn — a filter that silently empties the page is indistinguishable from one that broke.',
      },
    },
  },
  render: () => (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto max-w-wide space-y-8 px-4 py-8">
        <PageHeader />
        <Toolbar resultCount={0} />
        <div
          className="bg-muted/50 border-border flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center"
          role="status"
        >
          <Search
            className="text-muted-foreground/50 mb-4 size-12"
            aria-hidden="true"
          />
          <h2 className="text-foreground mb-2 text-xl font-semibold">
            No articles found
          </h2>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search or filters
          </p>
          <Button>Clear all filters</Button>
        </div>
      </div>
    </main>
  ),
};
