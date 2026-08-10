import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataState } from '@interlace/ui/data-state';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof DataState> = {
  title: 'Primitives/DataState',
  component: DataState,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The one place a fetch site decides what to render. Put it around anything whose content arrives asynchronously, instead of hand-writing the `isLoading ? … : error ? … : !data.length ? … : …` ladder again. It is a switch, not a fetcher: you own the request and pass in the three gate flags. Precedence is fixed — **loading → error → empty → idle** — and error deliberately beats empty, because a failed request is not "no results". The `children` render-prop only runs when every gate is clear, so `data` needs no null-check inside it. Toggle the three gates below to walk the machine.',
      },
    },
  },
  argTypes: {
    loading: {
      control: 'boolean',
      description:
        'First gate. Truthy → render `skeleton` and set `aria-busy` on the wrapper. Wins over every other gate.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    error: {
      control: 'boolean',
      description:
        'Second gate. Typed `unknown` — any non-nullish value (an `Error`, a string, `true`) fires it. The value is never rendered; put the message in `errorState`.',
      table: { type: { summary: 'unknown' }, category: 'State' },
    },
    empty: {
      control: 'boolean',
      description:
        'Third gate. Truthy → render `emptyState`. Compute it yourself (`!data?.length`) — the component never inspects `data` to decide.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    data: {
      control: 'object',
      description:
        'The resolved value, passed straight through to `children(data)`. It does not drive any gate — narrowing the render-prop parameter is its only job.',
      table: { type: { summary: 'T' }, category: 'Data' },
    },
    skeletonVariant: {
      control: 'select',
      options: [
        'rect',
        'circle',
        'text',
        'paragraph',
        'card',
        'article-card',
        'code-block',
        'form',
        'menu',
        'chart',
        'metric-table',
      ],
      description:
        'Shortcut for the common case: pick a `<Skeleton variant>` instead of building a `skeleton` node. Ignored when `skeleton` is supplied. The options here are the frequently-used slice of the union — the full list is `SKELETON_VARIANTS` in `skeleton-variants.ts`.',
      table: { type: { summary: 'SkeletonVariant' }, defaultValue: { summary: 'rect' }, category: 'State' },
    },
    skeleton: {
      control: false,
      description:
        'Loading UI. Defaults to a single full-width `<Skeleton variant="rect">`. Match its silhouette to the real content or you trade a spinner for a layout shift.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    errorState: {
      control: false,
      description:
        'Error UI. Defaults to a minimal `role="alert"` line. Override it to add a retry affordance — the default has none.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    emptyState: {
      control: false,
      description:
        'Empty UI. Defaults to a muted "No results." line. Override it to explain *why* it is empty and what to do next.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    children: {
      control: false,
      description:
        'Render-prop for the idle state. Runs only when no gate fires, so `data` is safe to use without a guard.',
      table: { type: { summary: '(data: T) => ReactNode' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the wrapper `<div>` that also carries `data-state` (loading / error / empty / idle) and `aria-busy`.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataState>;

type Item = { id: string; title: string };
const sample: Item[] = [
  { id: '1', title: 'First article' },
  { id: '2', title: 'Second article' },
  { id: '3', title: 'Third article' },
];

function List({ items }: { items: Item[] }) {
  return (
    <ul className="border-border flex flex-col gap-xs rounded-md border p-md">
      {items.map((item) => (
        <li key={item.id} className="text-foreground text-ui">
          {item.title}
        </li>
      ))}
    </ul>
  );
}

/**
 * The idle branch, wired to the controls. Flip `loading`, `error` and `empty`
 * in the Controls panel to walk the whole machine from one story — and note
 * that turning on more than one shows the precedence, not a merge.
 */
export const Idle: Story = {
  args: {
    loading: false,
    error: false,
    empty: false,
    data: sample,
    skeletonVariant: 'article-card',
    className: 'w-[360px] max-w-full',
  },
  render: (args) => (
    <DataState {...args}>
      {(items) => <List items={(items as Item[] | undefined) ?? []} />}
    </DataState>
  ),
};

/**
 * All four branches side by side, plus the precedence case. The last cell has
 * `loading`, `error` and `empty` all set — loading wins, because the gates are
 * checked in order and the first truthy one short-circuits. That ordering is
 * the whole contract: a request that is both in flight and previously failed
 * must read as "in flight", and a request that failed must never read as
 * "there is nothing here".
 */
export const AllStates: Story = {
  render: () => (
    <div className="grid w-[880px] max-w-full grid-cols-1 gap-lg sm:grid-cols-2">
      {(
        [
          ['idle', { data: sample }],
          ['loading', { loading: true }],
          ['error', { error: new Error('Network unreachable') }],
          ['empty', { empty: true, data: [] as Item[] }],
          [
            'loading + error + empty → loading',
            { loading: true, error: new Error('stale'), empty: true },
          ],
        ] as const
      ).map(([label, gates]) => (
        <section key={label} className="flex flex-col gap-xs">
          <div className="text-ui-sm font-mono uppercase text-muted-foreground">
            {label}
          </div>
          <DataState<Item[]> skeletonVariant="article-card" {...gates}>
            {(items) => <List items={items ?? []} />}
          </DataState>
        </section>
      ))}
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="w-[360px] max-w-full">
      <DataState<Item[]>
        loading
        error={null}
        empty={false}
        data={undefined}
        skeletonVariant="article-card"
      >
        {(items) => <List items={items} />}
      </DataState>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="w-[360px] max-w-full">
      <DataState<Item[]>
        loading={false}
        error={null}
        empty
        data={[]}
      >
        {(items) => <List items={items} />}
      </DataState>
    </div>
  ),
};

export const ErrorState: Story = {
  render: () => (
    <div className="w-[360px] max-w-full">
      <DataState<Item[]>
        loading={false}
        error={new Error('Network unreachable')}
        empty={false}
        data={undefined}
      >
        {(items) => <List items={items} />}
      </DataState>
    </div>
  ),
};

/**
 * Custom UI for each state — `skeleton`, `emptyState`, `errorState` accept
 * any ReactNode. Use this when the defaults aren't enough (e.g. a tone-d
 * error card, a CTA in the empty state, a domain-specific skeleton).
 */
export const CustomStates: Story = {
  render: () => (
    <div className="flex w-[360px] max-w-full flex-col gap-md">
      <DataState<Item[]>
        loading
        skeleton={
          <div className="bg-muted h-24 w-full animate-pulse rounded-md" />
        }
      >
        {(items) => <List items={items} />}
      </DataState>
      <DataState<Item[]>
        empty
        data={[]}
        emptyState={
          <div className="border-border text-muted-foreground rounded-md border border-dashed p-md text-center">
            No articles yet. Publish your first one to get started.
          </div>
        }
      >
        {(items) => <List items={items} />}
      </DataState>
    </div>
  ),
};

export const Dark: Story = {
  ...Loading,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Loading,
  decorators: [withRtl],
};
