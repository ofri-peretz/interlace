import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { OrderGame } from '@interlace/ui/games/order-game';
import { scoreOrder } from '@interlace/ui/games/order-model';
import { withRtl } from '@/decorators';

// Sample content with checkable values, so the demo makes no claim about the world.
const ITEMS = [
  { id: 'cm', label: 'A centimetre', value: '0.01 m' },
  { id: 'ft', label: 'A foot', value: '0.3048 m' },
  { id: 'm', label: 'A metre', value: '1 m' },
  { id: 'mi', label: 'A mile', value: '1,609 m' },
  { id: 'mar', label: 'A marathon', value: '42,195 m' },
];

const meta = {
  title: 'Games/OrderGame',
  component: OrderGame,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Put a handful of items in order. Drag a row by its handle, or move it with the arrow keys or its up and down buttons (dragging is never the only way), then lock in: the rows glide into the right order, each showing its value and whether you had it in the right place.\n\n' +
          '**Dealing and scoring are pure.** `games/order-model` exports `dealOrder` (seeded, never already solved), `scoreOrder` (places right, and the share of pairs in the right relative order, which points follow) and `moveItem`.\n\n' +
          '**Restore.** `result` / `defaultResult` render a stored round revealed. `onSubmit` fires once.\n\n' +
          '**Motion.** Rows make room as you drag (150ms) and travel to their right places on the reveal (400ms), measured before and after so layout never jumps. Under reduced motion rows simply land in place.',
      },
    },
  },
  args: {
    question: 'Shortest to longest',
    items: ITEMS,
    seed: 'sample',
    ends: ['Shortest', 'Longest'],
    explanation: 'Sample content. A real round would say where each value comes from here.',
  },
  render: (args) => (
    <div className="max-w-prose">
      <OrderGame {...args} />
    </div>
  ),
} satisfies Meta<typeof OrderGame>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drag, or use the arrow keys and buttons, then lock in. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('list', { name: 'Shortest to longest' })).toBeTruthy();
  },
};

/** After the reveal: values, and where each row was. */
export const Revealed: Story = {
  args: { defaultResult: scoreOrder(['ft', 'cm', 'm', 'mar', 'mi'], ITEMS.map((i) => i.id)) },
};

/** Move with the keyboard, then lock in. */
export const KeyboardMoves: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'Reorder A centimetre' }).focus();
    await userEvent.keyboard('{Home}');
    await userEvent.click(canvas.getByRole('button', { name: 'Lock in' }));
    await expect(canvas.getByText(/in the right place/)).toBeTruthy();
  },
};

export const RightToLeft: Story = {
  decorators: [withRtl],
};
