import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  Toc,
  TocPopover,
  MIN_VIEWPORT,
  type TocItem,
  type TocProps,
} from '@interlace/ui/toc';
import { Skeleton } from '@interlace/ui/skeleton';
import { withRtl } from '@/decorators';

const ITEMS: TocItem[] = [
  { id: 'intro', label: 'Introduction', level: 2 },
  { id: 'install', label: 'Install', level: 2 },
  { id: 'install-npm', label: 'npm', level: 3 },
  { id: 'install-pnpm', label: 'pnpm', level: 3 },
  { id: 'install-pnpm-monorepo', label: 'In a monorepo', level: 4 },
  { id: 'config', label: 'Configure', level: 2 },
  { id: 'config-flat', label: 'Flat config', level: 3 },
  { id: 'config-rules', label: 'Recommended rules', level: 3 },
  { id: 'roadmap', label: 'Roadmap', level: 2 },
];

const ArticleMock = ({ items }: { items: TocItem[] }) => (
  <article className="prose prose-sm max-w-prose px-md py-lg text-foreground">
    {items.map((item) => {
      const Tag = (`h${item.level}` as 'h2' | 'h3' | 'h4');
      return (
        <section key={item.id} className="mb-xl">
          <Tag
            id={item.id}
            tabIndex={-1}
            className="scroll-mt-md font-semibold"
          >
            {item.label}
          </Tag>
          <p className="text-muted-foreground">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
            enim ad minim veniam, quis nostrud exercitation ullamco laboris
            nisi ut aliquip ex ea commodo consequat.
          </p>
          <p className="text-muted-foreground">
            Duis aute irure dolor in reprehenderit in voluptate velit esse
            cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
            cupidatat non proident.
          </p>
        </section>
      );
    })}
  </article>
);

const PageMock = ({ items = ITEMS, ...tocProps }: Partial<TocProps>) => (
  <div className="grid min-h-[80vh] grid-cols-1 gap-lg bg-background px-md py-lg text-foreground lg:grid-cols-[1fr_220px]">
    <ArticleMock items={items} />
    <aside className="sticky top-md self-start">
      <div className="mb-sm text-xs font-medium uppercase tracking-wide text-muted-foreground">
        On this page
      </div>
      <Toc items={items} {...tocProps} />
    </aside>
  </div>
);

const meta = {
  title: 'Primitives/Toc',
  component: Toc,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "where am I" rail for a page long enough that the reader loses the thread — docs, MDX articles, rule reference. It is a mirror of the heading outline, so it earns its place only when the outline is real: a page with three h2s does not need one. Active tracking is an `IntersectionObserver` over the heading ids you pass (no scroll math), and the click scroll drops to `instant` under `prefers-reduced-motion`. Below the 480px floor hide it entirely rather than shrink it; `TocPopover` is the narrow-but-not-tiny companion.',
      },
    },
  },
  argTypes: {
    items: {
      control: 'object',
      description:
        'The heading outline, in document order. Each `id` must match an `id` on a real heading element — that is the anchor the link points at AND the node the observer watches. `level` is 2–4; h1 is the page title and never appears.',
      table: {
        category: 'Data',
        type: { summary: '{ id: string; label: ReactNode; level: 2 | 3 | 4 }[]' },
      },
    },
    label: {
      control: 'text',
      description:
        'Accessible name of the `<nav>` landmark. Override it when a page carries more than one navigation region, so screen-reader users can tell them apart.',
      table: {
        category: 'A11y',
        type: { summary: 'string' },
        defaultValue: { summary: "'Table of contents'" },
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<nav>`. Indentation is not configurable — level 3 is `pl-md`, level 4 is `pl-lg`, per LAYOUT_PHILOSOPHY.md.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    items: ITEMS,
    label: 'Table of contents',
  },
} satisfies Meta<typeof Toc>;

export default meta;
// `StoryObj<typeof Toc>` rather than `<typeof meta>`: `items` is a required
// prop, and binding the story type to the meta makes `args` mandatory on every
// render-only story below.
type Story = StoryObj<typeof Toc>;

export const Default: Story = {
  render: (args) => <PageMock {...args} />,
};

export const Variants: Story = {
  render: () => (
    <div className="flex min-h-[60vh] flex-col gap-xl bg-background px-md py-lg text-foreground">
      <section>
        <div className="mb-sm text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rail variant — sidebar
        </div>
        <div className="rounded-md border border-border bg-card/40 p-md">
          <Toc items={ITEMS} />
        </div>
      </section>
      <section>
        <div className="mb-sm text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Popover variant — narrow viewport
        </div>
        <TocPopover items={ITEMS} />
      </section>
      <section>
        <div className="mb-sm text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Custom landmark label
        </div>
        <Toc items={ITEMS.slice(0, 4)} label="In this article" />
      </section>
    </div>
  ),
};

/**
 * Keyboard-only flow: the rail is a named landmark whose entries are real
 * links, so Tab reaches every heading without a pointer.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <div className="bg-background text-foreground p-md">
      <Toc items={ITEMS.slice(0, 4)} />
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('The rail is a named navigation landmark', async () => {
      expect(canvas.getByRole('navigation')).toBeTruthy();
    });

    await step('Every heading is a focusable link', async () => {
      const links = canvas.getAllByRole('link');
      expect(links).toHaveLength(4);
      links[0].focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(links[1]);
    });

    await step('Each link targets a real heading anchor', async () => {
      for (const link of canvas.getAllByRole('link')) {
        expect(link.getAttribute('href')?.startsWith('#')).toBe(true);
      }
    });
  },
};

/**
 * Async headings — reserve the indented rail so the sidebar doesn't reflow
 * once the article's heading tree resolves.
 */
export const Loading: Story = {
  render: () => (
    <div className="bg-background p-md">
      <Skeleton variant="toc" className="w-56" />
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

export const BelowMinViewport: Story = {
  render: () => (
    <div className="overflow-x-auto">
      {/* overflow-x-auto: the frame below is pinned to 479px to trip the
        min-viewport contract; without an inner scroller it drags the whole
        page sideways on a 375px phone. */}
      <div
        data-interlace-dev
        style={{ width: MIN_VIEWPORT - 1 }}
        className="border-2 border-dashed border-muted bg-background p-md text-foreground"
      >
        <div className="mb-sm text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Below {MIN_VIEWPORT}px — consumer should hide the TOC entirely.
        </div>
        <Toc items={ITEMS} />
      </div>
    </div>
  ),
};
