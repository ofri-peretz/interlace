import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PointsSplit, PointsTotals } from '@interlace/ui/games/points-split';
import { totalPoints, type Split } from '@interlace/ui/games/points-model';
import { withRtl } from '@/decorators';

// Neutral topics, so the demo makes no claim about anyone.
const OPTIONS = [
  { id: 'food', label: 'Food and cooking' },
  { id: 'music', label: 'Music' },
  { id: 'tech', label: 'Technology' },
  { id: 'nature', label: 'Nature and hiking' },
];
const IDS = OPTIONS.map((o) => o.id);
const ROOM: Record<string, Split> = {
  a: { food: 40, music: 20, tech: 40 },
  b: { tech: 70, nature: 30 },
  c: { food: 50, nature: 50 },
  d: { music: 60, food: 40 },
  e: { tech: 50, food: 30, nature: 20 },
};

const meta = {
  title: 'Games/PointsSplit',
  component: PointsSplit,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Spend a budget of points across options. It shows how strongly people feel, which a one-choice poll hides, and nobody can vote for everything. `PointsSplit` is the phone; `PointsTotals` is the screen.\n\n' +
          '**The model.** `games/points-model` checks a split (`checkSplit`) and adds up the room (`totalPoints`), leaving out splits that break the rules.\n\n' +
          '**Motion.** Bars move with each tap; on the screen, rows glide to their new rank. Under reduced motion they just change.',
      },
    },
  },
  args: {
    question: 'You have 100 points. Where should we spend more time?',
    options: OPTIONS,
    defaultValue: { food: 30, tech: 40 },
    onSend: fn(),
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-96">
      <PointsSplit {...args} />
    </div>
  ),
} satisfies Meta<typeof PointsSplit>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Partway: 70 of 100 placed. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('30 points left')).toBeTruthy();
  },
};

/** Spend the rest, then send. */
export const Spending: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    for (let i = 0; i < 3; i++) await userEvent.click(canvas.getByRole('button', { name: 'Add 10 points to Music' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await expect(args.onSend).toHaveBeenCalledWith({ food: 30, tech: 40, music: 30 });
  },
};

/** The room's totals; add a person to watch the order change. */
export const RoomTotals: Story = {
  render: () => {
    const [room, setRoom] = React.useState(ROOM);
    const { totals } = totalPoints(room, IDS);
    return (
      <div className="grid max-w-112 gap-4">
        <button
          type="button"
          className="justify-self-start text-sm underline"
          onClick={() => setRoom((r) => ({ ...r, [`n${Object.keys(r).length}`]: { music: 100 } }))}
        >
          Someone puts 100 on Music
        </button>
        <PointsTotals totals={totals} options={OPTIONS} size="stage" locale="en-US" />
      </div>
    );
  },
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
