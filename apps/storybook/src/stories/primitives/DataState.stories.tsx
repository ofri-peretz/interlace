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
          'Single conditional swap point for the four-state UX (loading / error / empty / idle). Replaces the ad-hoc ladder consumers otherwise write at every fetch site. State precedence: loading > error > empty > idle. The children render-prop runs only when no gate fires, so consumers can use `data` without a null guard.',
      },
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

export const Idle: Story = {
  render: () => (
    <div className="w-[360px]">
      <DataState<Item[]>
        loading={false}
        error={null}
        empty={false}
        data={sample}
        skeletonVariant="article-card"
      >
        {(items) => <List items={items} />}
      </DataState>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="w-[360px]">
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
    <div className="w-[360px]">
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
    <div className="w-[360px]">
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
    <div className="flex w-[360px] flex-col gap-md">
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
