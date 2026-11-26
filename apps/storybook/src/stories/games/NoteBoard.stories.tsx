import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BoardMove, BoardNote } from '@interlace/ui/games/note-board-model';
import { NoteBoard } from '@interlace/ui/games/note-board';
import { withRtl } from '@/decorators';

// A neutral retrospective about the session itself, so the demo makes no claim about anyone.
const COLUMNS = [
  { id: 'keep', title: 'Keep' },
  { id: 'change', title: 'Change' },
  { id: 'try', title: 'Try' },
];
const NOTES: BoardNote[] = [
  { id: 'n1', column: 'keep', text: 'Short breaks every half hour', at: 1 },
  { id: 'n2', column: 'keep', text: 'Working in small groups', at: 2 },
  { id: 'n3', column: 'change', text: 'Start on time, even if people are missing', at: 3 },
  { id: 'n4', column: 'keep', text: 'The live questions at the end', at: 4 },
  { id: 'n5', column: 'try', text: 'A quick game to open the session', at: 5 },
  { id: 'n6', column: 'change', text: 'Fewer slides, more talking', at: 6 },
  { id: 'n7', column: 'try', text: 'Pairs that change every round', at: 7 },
];

const meta = {
  title: 'Games/NoteBoard',
  component: NoteBoard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A shared board of sticky notes in columns: a retrospective, an affinity sort, a "before / during / after" map. People post into a column; the room sorts notes with move buttons named for the column they lead to, and each note glides to its new place.\n\n' +
          '**The model.** `games/note-board-model` folds posts and moves (`foldBoard`), so every screen agrees whatever order events arrive in.',
      },
    },
  },
  args: {
    columns: COLUMNS,
    notes: NOTES,
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-wide">
      <NoteBoard {...args} />
    </div>
  ),
} satisfies Meta<typeof NoteBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The board with moving and adding on, wide enough for its columns side by side. */
export const Default: Story = { args: { onMove: () => {}, onAdd: () => {} } };

/** Read only: no moving or adding. */
export const ReadOnly: Story = {};

/** The room sorts and adds: move a note with its arrows, or add one to any column. */
export const Live: Story = {
  render: function Render(args) {
    const [notes, setNotes] = React.useState(NOTES);
    const [moves, setMoves] = React.useState<BoardMove[]>([]);
    return (
      <div className="max-w-wide">
        <NoteBoard
          {...args}
          notes={notes}
          moves={moves}
          onMove={(m) => setMoves((list) => [...list, m])}
          onAdd={(column, text) =>
            setNotes((list) => [...list, { id: `new-${list.length}`, column, text, at: Date.now() }])
          }
        />
      </div>
    );
  },
};

/** On a shared screen. */
export const Stage: Story = { args: { size: 'stage' } };

export const RightToLeft: Story = {
  decorators: [withRtl],
  args: { onMove: () => {} },
};
