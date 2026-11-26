import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Button } from '@interlace/ui/button';
import { GroupCard, GroupGrid } from '@interlace/ui/games/groups';
import { makeGroups, teamTotals } from '@interlace/ui/games/groups-model';
import { Leaderboard } from '@interlace/ui/games/leaderboard';
import { withRtl } from '@/decorators';

// Invented first names and a neutral prompt, so the demo is about no one.
const NAMES = ['Ada', 'Ben', 'Cy', 'Dana', 'Eli', 'Fay', 'Gil', 'Hana', 'Ira', 'Jo', 'Kai', 'Lia', 'Max', 'Noa'];
const TEAM = ['Team Sun', 'Team Sea', 'Team Hill', 'Team Leaf'];

const meta = {
  title: 'Games/Groups',
  component: GroupCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Pairs, small groups and teams. `GroupCard` is a phone’s view: the group, who you are with, what to talk about and for how long. `GroupGrid` is the shared screen, where a reshuffle glides each name to its new group.\n\n' +
          '**The model.** `games/groups-model` makes balanced groups (an odd pair becomes a trio), repeatable by seed, avoids repeat pairs, adds late joiners to the smallest group, and totals team scores for `Leaderboard` (`teamTotals`).\n\n' +
          '**Motion.** A new group rises in (200ms), names following within 150ms; a reshuffle on the screen glides names between groups (400ms). Under reduced motion everything is in place.',
      },
    },
  },
  args: {
    label: 'Your group',
    members: ['Dana', 'Eli'],
    prompt: 'Share one thing you learned today that surprised you.',
    deadline: null,
    seconds: 120,
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-sm">
      <GroupCard {...args} />
    </div>
  ),
} satisfies Meta<typeof GroupCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A phone in a group of three, with a prompt and a two-minute talk. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("You're with Dana and Eli.")).toBeTruthy();
  },
};

/** Alone so far: waiting for a late joiner. */
export const Waiting: Story = { args: { members: [], prompt: undefined, deadline: undefined } };

/** The shared screen: reshuffle and watch the names glide to their new groups. */
export const Screen: Story = {
  render: () => {
    const [round, setRound] = React.useState(1);
    const groups = makeGroups(NAMES, { count: 4, seed: `round-${round}` });
    return (
      <div className="grid gap-4">
        <Button className="justify-self-start" onClick={() => setRound((r) => r + 1)}>
          Reshuffle
        </Button>
        <GroupGrid
          size="stage"
          current="g0"
          groups={groups.map((g, i) => ({
            id: `g${i}`,
            label: TEAM[i],
            members: g.map((name) => ({ id: name, name })),
          }))}
        />
      </div>
    );
  },
};

/** Team standings: `teamTotals` into `Leaderboard`, by mean so team size is fair. */
export const TeamStandings: Story = {
  render: () => {
    const groups = makeGroups(NAMES, { count: 4, seed: 'teams' });
    const scores = Object.fromEntries(NAMES.map((n, i) => [n, (i * 37) % 100]));
    return (
      <div className="max-w-md">
        <Leaderboard
          caption="Team standings"
          showCaption
          entries={teamTotals(groups, scores, { mode: 'mean', name: (i) => TEAM[i] as string })}
        />
      </div>
    );
  },
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
