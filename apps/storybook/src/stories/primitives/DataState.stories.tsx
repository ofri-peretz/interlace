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
          'The one place a fetch site decides what to render, and the place this design system says what an ABSENCE is.\n\nIt is a switch, not a fetcher: you own the request and pass the flags. Precedence is fixed and it is the `DATA_STATES` array itself — **loading → error → not-applicable → not-counted → empty → partial → truncated → first-measurement → idle**. Error deliberately beats empty, because a failed request is not "no results"; truncated is not empty at all, and does not replace the body.\n\nFour states was not enough, and the missing five are the interesting ones. **`not-counted`** = no run happened, drawn as a diagonal hatch, because a run that returned zero and a run that never happened must not look the same. **`not-applicable`** recedes — it was never going to have a value. **`partial`** means every count below is a floor. **`truncated`** means never a denominator. **`first-measurement`** is the only absence that gets the accent colour and a dashed outline, because it is the only one a reader can act on.\n\nStates co-occur, so the resolver returns the winner AND the qualifiers, and the announcement says both — `data-qualifiers` carries the facts `data-state` cannot. **Every state owes a sentence.** A hatch that exists only in pixels keeps the distinction for sighted readers and destroys it for everyone else, and axe scores all of it green.',
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
        'Truthy → render `emptyState`. Compute it yourself (`!data?.length`) — the component never inspects `data` to decide. A COMPLETE result with nothing in it; the only absence that is a real, observed zero-length.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    notApplicable: {
      control: 'boolean',
      description:
        'The metric has no meaning for this subject. Any number, `0` included, would be a category error. Recedes — it was never going to have a value.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    notCounted: {
      control: 'boolean',
      description:
        'No run happened. Measurable in principle, deliberately not tallied. This is the hatch, and `0` here invents a measurement nobody took.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    partial: {
      control: 'boolean',
      description:
        'Some sources did not report. Every count below is a FLOOR, not a total. Ranked above `truncated` because it is invisible: a reader can see a list stop, but cannot see a source that never replied. Does NOT replace the body.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    truncated: {
      control: 'boolean',
      description:
        'The list is cut. Must never become a denominator. Does NOT replace the body.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    firstMeasurement: {
      control: 'boolean',
      description:
        'A reading exists but no prior does. The one absence with an accent colour, because it is the one a reader can resolve — by measuring again tomorrow. Does NOT replace the body.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    notice: {
      control: 'boolean',
      description:
        'Show the badge row for qualifying states. The `sr-only` announcement is emitted either way — set this to `false` only when the surrounding surface already shows the same badge, never to make the caveat go away.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'State' },
    },
    announce: {
      control: 'object',
      description:
        'Context folded into every sentence this instance emits — `noun`, `shown`, `coverage`, `reason`.',
      table: { type: { summary: 'AnnouncementOptions' }, category: 'State' },
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

/**
 * The five states the four-state ladder never had. The first two REPLACE the
 * body (there is nothing to show); the last three QUALIFY a body that still
 * renders, which is why "truncated" is not a synonym for "empty".
 */
export const AbsenceVocabulary: Story = {
  render: () => (
    <div className="grid w-[880px] max-w-full grid-cols-1 gap-lg sm:grid-cols-2">
      {(
        [
          [
            'not-counted — no run happened (hatch)',
            { notCounted: true } as const,
            {},
          ],
          [
            'not-applicable — never going to have a value (recedes)',
            { notApplicable: true } as const,
            { reason: 'package has no test suite' },
          ],
          [
            'partial — every count below is a floor',
            { partial: true } as const,
            { coverage: '4 of 9 sources reported' },
          ],
          [
            'truncated — not a denominator',
            { truncated: true } as const,
            { shown: 3 },
          ],
          [
            'first-measurement — no prior to compare',
            { firstMeasurement: true } as const,
            {},
          ],
          [
            'partial + truncated — wrong twice, said twice',
            { partial: true, truncated: true } as const,
            { shown: 3, coverage: '4 of 9 sources reported' },
          ],
        ] as const
      ).map(([label, flags, announce]) => (
        <section key={label} className="flex flex-col gap-xs">
          <div className="text-ui-sm font-mono uppercase text-muted-foreground">
            {label}
          </div>
          <DataState<Item[]> data={sample} announce={announce} {...flags}>
            {(items) => <List items={items ?? []} />}
          </DataState>
        </section>
      ))}
    </div>
  ),
};

/**
 * Precedence, walked. Each row adds one higher-precedence flag to the row
 * above it, and `data-qualifiers` (inspect the DOM) keeps every loser rather
 * than throwing it away.
 */
export const Precedence: Story = {
  render: () => (
    <div className="flex w-[520px] max-w-full flex-col gap-md">
      {(
        [
          ['truncated', { truncated: true }],
          ['+ partial → partial wins', { truncated: true, partial: true }],
          [
            '+ empty → empty wins',
            { truncated: true, partial: true, empty: true },
          ],
          [
            '+ error → error wins, and it is not "no results"',
            { truncated: true, partial: true, empty: true, error: 'ECONNRESET' },
          ],
        ] as const
      ).map(([label, flags]) => (
        <section key={label} className="flex flex-col gap-xs">
          <div className="text-ui-sm font-mono uppercase text-muted-foreground">
            {label}
          </div>
          <DataState<Item[]> data={sample} {...flags}>
            {(items) => <List items={items ?? []} />}
          </DataState>
        </section>
      ))}
    </div>
  ),
};

export const Dark: Story = {
  ...AbsenceVocabulary,
  decorators: [withDark],
};

export const RTL: Story = {
  ...AbsenceVocabulary,
  decorators: [withRtl],
};
