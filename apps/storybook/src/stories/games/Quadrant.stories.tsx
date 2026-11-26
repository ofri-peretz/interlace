import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Quadrant, QuadrantMap } from '@interlace/ui/games/quadrant';
import { withRtl } from '@/decorators';

// Neutral axes, so the demo makes no claim about anyone.
const AXES = { x: ['Easy', 'Hard'], y: ['Less useful', 'More useful'] } as const;

/** A seeded room: a crowd in one corner and a spread elsewhere. */
function room(n: number, seed = 7) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 100;
  return Array.from({ length: n }, (_, i) =>
    i % 3 === 0 ? { x: r(), y: r() } : { x: 55 + r() * 0.4, y: 60 + r() * 0.35 },
  );
}
const ROOM = room(36);
const BEFORE = room(30, 3).map((p) => ({ x: p.x * 0.6, y: p.y * 0.7 }));

const meta = {
  title: 'Games/Quadrant',
  component: Quadrant,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A 2 x 2 grid: two questions at once. `Quadrant` is the phone: tap, drag or use the arrow keys to place one dot, its place said in words. Then the room appears on the same grid: where dots crowd, a count per quarter, the room’s middle, and an earlier round as a dashed ring. `QuadrantMap` is the same picture for a shared screen.\n\n' +
          '**The model.** `games/quadrant-model` bins the dots, finds the leading quarter and measures how far the middle moved.\n\n' +
          '**Motion.** The cells fade in (250ms) and the middle travels from your dot to the room’s (400ms). Under reduced motion the picture is simply there.',
      },
    },
  },
  args: {
    prompt: 'This skill is…',
    axes: AXES,
    points: ROOM,
    before: BEFORE,
    defaultValue: { x: 30, y: 70 },
    locale: 'en-US',
    onPlace: fn(),
  },
} satisfies Meta<typeof Quadrant>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Placed: the room, with an earlier round. */
export const Default: Story = {};

/** A phone, ready to place a dot. */
export const Placing: Story = { args: { defaultValue: null } };

/** Move by keyboard, then place. */
export const Keyboard: Story = {
  args: { defaultValue: null },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'In the middle' }).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{PageUp}');
    await userEvent.click(canvas.getByRole('button', { name: 'Place my dot' }));
    await expect(args.onPlace).toHaveBeenCalledWith({ x: 70, y: 100 });
  },
};

/** The room on a shared screen; add people to watch it fill. */
export const Screen: Story = {
  render: function Render() {
    const [n, setN] = React.useState(12);
    return (
      <div className="grid gap-4">
        <button type="button" className="justify-self-start text-sm underline" onClick={() => setN((v) => v + 6)}>
          Six more people answer
        </button>
        <QuadrantMap axes={AXES} points={room(n)} size="stage" locale="en-US" />
      </div>
    );
  },
};

/** Right to left: the start pole sits on the right. */
export const RightToLeft: Story = { decorators: [withRtl] };
