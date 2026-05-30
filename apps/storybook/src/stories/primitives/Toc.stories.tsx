import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toc, TocPopover, MIN_VIEWPORT, type TocItem } from '@interlace/ui/toc';
import { withDark, withRtl } from '@/decorators';

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

const PageMock = ({ items = ITEMS }: { items?: TocItem[] }) => (
  <div className="grid min-h-[80vh] grid-cols-[1fr_220px] gap-lg bg-background px-md py-lg text-foreground">
    <ArticleMock items={items} />
    <aside className="sticky top-md self-start">
      <div className="mb-sm text-xs font-medium uppercase tracking-wide text-muted-foreground">
        On this page
      </div>
      <Toc items={items} />
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
          'In-page Table of Contents. Tracks the active heading via `IntersectionObserver`; smooth-scrolls on click (gated by `useReducedMotion`). Indent steps from LAYOUT_PHILOSOPHY.md — level 3 = `pl-md`, level 4 = `pl-lg`. `TocPopover` is the narrow-viewport companion.',
      },
    },
  },
} satisfies Meta<typeof Toc>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <PageMock />,
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

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

export const BelowMinViewport: Story = {
  render: () => (
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
  ),
};
