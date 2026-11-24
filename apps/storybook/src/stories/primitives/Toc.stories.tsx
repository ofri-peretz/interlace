import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  Toc,
  TocBar,
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
  <article className="prose prose-sm max-w-prose px-6 py-10 text-foreground">
    {items.map((item) => {
      const Tag = (`h${item.level}` as 'h2' | 'h3' | 'h4');
      return (
        <section key={item.id} className="mb-16">
          <Tag
            id={item.id}
            tabIndex={-1}
            className="scroll-mt-6 font-semibold"
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
  <div className="grid min-h-[80vh] grid-cols-1 gap-10 bg-background px-6 py-10 text-foreground lg:grid-cols-[1fr_220px]">
    <ArticleMock items={items} />
    <div className="sticky top-6 self-start">
      <Toc items={items} title="On this page" {...tocProps} />
    </div>
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
          'The "where am I" map for a page long enough that the reader loses the thread. It mirrors the heading outline, so it earns its place only when the outline is real. A section is current from the moment its heading crosses the reading line until the next one does, so the rail never goes blank. A marker slides to the current entry and the track above it fills as you read. Long outlines (over 10 entries) show sub-headings only under the current section. A pick holds its entry while the page scrolls there, moves focus to the heading and puts it in the URL; under reduced motion everything lands at once. Below 480px use `TocBar`: a slim bar naming the current section that opens the list in a bottom sheet.',
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
    title: {
      control: 'text',
      description: 'A small visible heading above the list, such as "On this page". The landmark keeps `label` as its name.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    collapse: {
      control: 'inline-radio',
      options: ['auto', 'always', 'never'],
      description:
        'Fold sub-headings so only the current section shows its own. `auto` folds above 10 entries. Folded entries leave the tab order.',
      table: { category: 'Behaviour', type: { summary: "'auto' | 'always' | 'never'" }, defaultValue: { summary: "'auto'" } },
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
        'Merged onto the `<nav>`. Indentation is not configurable: level 3 is `ps-6`, level 4 is `ps-9`.',
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
    <div className="flex min-h-[60vh] flex-col gap-16 bg-background px-6 py-10 text-foreground">
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rail variant — sidebar
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-6">
          <Toc items={ITEMS} />
        </div>
      </section>
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bar variant — narrow layouts (opens a bottom sheet)
        </div>
        <div className="max-w-96 border-b border-border">
          <TocBar items={ITEMS} />
        </div>
      </section>
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Popover variant — a small button
        </div>
        <TocPopover items={ITEMS} />
      </section>
      <section>
        <div className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
    <div className="bg-background text-foreground p-6">
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
    <div className="bg-background p-6">
      <Skeleton variant="toc" className="w-56" />
    </div>
  ),
};

const LONG_ITEMS: TocItem[] = ['Overview', 'Install', 'Configure', 'Theming', 'Deploy'].flatMap((section, s) => [
  { id: `long-${s}`, label: section, level: 2 as const },
  { id: `long-${s}-a`, label: `${section}: the basics`, level: 3 as const },
  { id: `long-${s}-b`, label: `${section}: going further`, level: 3 as const },
]);

/** A long outline: sub-headings show only under the section being read. */
export const LongOutline: Story = {
  render: (args) => <PageMock {...args} items={LONG_ITEMS} />,
};

/** The narrow form: a slim sticky bar that names the current section. */
export const Bar: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <div className="bg-background text-foreground">
      <div className="sticky top-0 z-10 border-b border-border bg-background px-4">
        <TocBar items={ITEMS} />
      </div>
      <ArticleMock items={ITEMS} />
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
        className="border-2 border-dashed border-muted bg-background p-6 text-foreground"
      >
        <div className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Below {MIN_VIEWPORT}px — consumer should hide the TOC entirely.
        </div>
        <Toc items={ITEMS} />
      </div>
    </div>
  ),
};
