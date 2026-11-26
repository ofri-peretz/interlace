import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RankChoices, RankResults } from '@interlace/ui/games/ranking';
import { tallyRankings } from '@interlace/ui/games/ranking-model';
import { withRtl } from '@/decorators';

// Neutral options, so the demo makes no claim about anyone.
const OPTIONS = [
  { id: 'market', label: 'A food market' },
  { id: 'beach', label: 'The beach' },
  { id: 'museum', label: 'A museum' },
  { id: 'hike', label: 'A desert hike' },
  { id: 'concert', label: 'A live concert' },
];
const IDS = OPTIONS.map((o) => o.id);
const ROOM: Record<string, string[]> = {
  a: ['market', 'beach', 'concert', 'museum', 'hike'],
  b: ['beach', 'market', 'hike', 'concert', 'museum'],
  c: ['hike', 'market', 'museum', 'beach', 'concert'],
  d: ['market', 'concert', 'beach', 'hike', 'museum'],
  e: ['museum', 'market', 'beach', 'concert', 'hike'],
};

const meta = {
  title: 'Games/Ranking',
  component: RankChoices,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A room ranks the same items by preference. `RankChoices` is the phone: a seeded starting order, rows moved with up and down buttons or the arrow keys on each handle, each move announced. `RankResults` is the screen: the room’s order with each item’s average place.\n\n' +
          '**The model.** `games/ranking-model` tallies everyone’s order into the room’s (`tallyRankings`) and says how much people agree (`roomAgreement`). For a round with a right order, use `OrderGame`.\n\n' +
          '**Motion.** Moved rows glide (250ms); the room’s rows glide as answers arrive. Under reduced motion they jump.',
      },
    },
  },
  args: {
    question: 'On a first visit, what would you want to do first?',
    options: OPTIONS,
    seed: 'demo',
    onSend: fn(),
  },
  render: (args) => (
    <div className="max-w-sm">
      <RankChoices {...args} />
    </div>
  ),
} satisfies Meta<typeof RankChoices>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A phone, ready to rank. */
export const Default: Story = {};

/** Move by keyboard, then send. */
export const Keyboard: Story = {
  args: { defaultOrder: IDS },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: /^A desert hike, 4 of 5/ }).focus();
    await userEvent.keyboard('{Home}');
    await userEvent.click(canvas.getByRole('button', { name: 'Send my order' }));
    await expect(args.onSend).toHaveBeenCalledWith(['hike', 'market', 'beach', 'museum', 'concert']);
  },
};

/** The room's order on a shared screen; add a person to watch it change. */
export const RoomResults: Story = {
  render: () => {
    const [room, setRoom] = React.useState(ROOM);
    const { items } = tallyRankings(room, IDS);
    return (
      <div className="grid max-w-md gap-4">
        <button
          type="button"
          className="justify-self-start text-sm underline"
          onClick={() =>
            setRoom((r) => ({ ...r, [`n${Object.keys(r).length}`]: ['concert', 'hike', 'museum', 'beach', 'market'] }))
          }
        >
          Someone puts the concert first
        </button>
        <RankResults items={items} options={OPTIONS} size="stage" locale="en-US" />
      </div>
    );
  },
};

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
