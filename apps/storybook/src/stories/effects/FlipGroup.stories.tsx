import { Button } from '@interlace/ui/button';
import { FlipGroup } from '@interlace/ui/effects/flip-group';
import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

const meta: Meta<typeof FlipGroup> = {
  title: 'Effects/FlipGroup',
  component: FlipGroup,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Items glide to their new place when a list is sorted, filtered or reordered. Give each item a stable `data-flip-id`; render the new order as usual. DOM order is the new order at once, so a screen reader and Tab follow the real list. Under reduced motion items simply take their place.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FlipGroup>;

const TEAMS = [
  { id: 'north', name: 'North bank', score: 42 },
  { id: 'harbour', name: 'Harbour', score: 37 },
  { id: 'old-town', name: 'Old town', score: 51 },
  { id: 'hill', name: 'The hill', score: 29 },
  { id: 'market', name: 'Market', score: 46 },
];

function Leaderboard() {
  const [by, setBy] = React.useState<'name' | 'score'>('name');
  const rows = [...TEAMS].sort((a, b) => (by === 'name' ? a.name.localeCompare(b.name) : b.score - a.score));
  return (
    <div className="flex max-w-prose flex-col gap-4">
      <div className="flex gap-2">
        <Button variant={by === 'name' ? 'default' : 'outline'} onClick={() => setBy('name')} aria-pressed={by === 'name'}>
          By name
        </Button>
        <Button variant={by === 'score' ? 'default' : 'outline'} onClick={() => setBy('score')} aria-pressed={by === 'score'}>
          By score
        </Button>
      </div>
      <FlipGroup render={<ol />} className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            data-flip-id={row.id}
            className="bg-card text-card-foreground border-border flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <span className="font-medium">{row.name}</span>
            <span className="text-muted-foreground tabular-nums">{row.score}</span>
          </li>
        ))}
      </FlipGroup>
    </div>
  );
}

/** Sort the list and watch each row glide to its new rank. */
export const Default: Story = {
  render: () => <Leaderboard />,
};
