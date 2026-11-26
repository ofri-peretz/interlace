import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoomGoal } from '@interlace/ui/games/room-goal';
import { withRtl } from '@/decorators';

// Neutral milestone names, so the demo makes no claim about anyone.
const MILESTONES = [
  { at: 2000, label: 'Bonus round' },
  { at: 5000, label: 'Music break' },
  { at: 8000, label: 'Group photo' },
];

const meta = {
  title: 'Games/RoomGoal',
  component: RoomGoal,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One meter for the whole room: a shared target, named milestones on the way, and how many rounds in a row most of the room got right. A passed milestone lifts and is announced once.\n\n' +
          '**The model.** `games/room-goal-model` counts each person once per round, in any order, with an optional cap per person (`tallyRoomGoal`), and counts rounds in a row above a bar (`roomStreak`).',
      },
    },
  },
  args: {
    label: 'Our goal: 8,000 points together',
    value: 5600,
    target: 8000,
    milestones: MILESTONES,
    streak: 3,
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-2xl">
      <RoomGoal {...args} />
    </div>
  ),
} satisfies Meta<typeof RoomGoal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Past two milestones, three rounds in a row. */
export const Default: Story = {};

/** On a shared screen: add a round's points to watch it move. */
export const Live: Story = {
  args: { size: 'stage', value: 1200, streak: 0 },
  render: (args) => {
    const [value, setValue] = React.useState(args.value);
    return (
      <div className="grid max-w-3xl gap-4">
        <button type="button" className="justify-self-start text-sm underline" onClick={() => setValue((v) => v + 900)}>
          A round ends: +900
        </button>
        <RoomGoal {...args} value={value} />
      </div>
    );
  },
};

/** Done. */
export const Done: Story = { args: { value: 8000 } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
