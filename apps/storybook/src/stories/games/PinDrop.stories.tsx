import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PinDrop, PinMap } from '@interlace/ui/games/pin-drop';
import { withRtl } from '@/decorators';

// A made-up island, inline so the story needs no network and names no real place.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<rect width="400" height="300" fill="#cfe1ec"/>
<path d="M60 170 C40 100 120 40 210 50 C300 58 360 110 340 180 C322 245 230 270 150 255 C90 244 72 215 60 170Z" fill="#e8dfc6" stroke="#8a7f62" stroke-width="3"/>
<path d="M250 70 L285 125 L215 125Z" fill="#b9ae8e" stroke="#6f664e" stroke-width="3"/>
<g fill="#8fb08a" stroke="#56704f" stroke-width="2"><circle cx="130" cy="120" r="14"/><circle cx="150" cy="105" r="12"/><circle cx="112" cy="140" r="12"/><circle cx="150" cy="135" r="11"/></g>
<path d="M90 230 Q120 215 150 236" fill="none" stroke="#6b8fa8" stroke-width="4"/>
<rect x="104" y="238" width="38" height="8" fill="#8a7f62"/>
<path d="M200 200 C220 180 260 190 285 175" fill="none" stroke="#a5946a" stroke-width="3" stroke-dasharray="6 5"/>
</svg>`;
const SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;
const ASPECT = 4 / 3;

const REGIONS = [
  { label: 'the harbour', box: [18, 70, 42, 90] as const },
  { label: 'the forest', box: [24, 30, 42, 52] as const },
  { label: 'the hill', box: [52, 20, 73, 44] as const },
  { label: 'the middle of the island', box: [45, 48, 80, 70] as const },
  { label: 'the sea', box: [0, 0, 100, 14] as const },
];
const ANSWER = { x: 64, y: 60 };
const PINS = [
  { x: 62, y: 58 },
  { x: 66, y: 63 },
  { x: 58, y: 55 },
  { x: 70, y: 66 },
  { x: 40, y: 40 },
  { x: 63, y: 61 },
  { x: 30, y: 75 },
  { x: 55, y: 64 },
  { x: 75, y: 52 },
  { x: 65, y: 58 },
];

const meta = {
  title: 'Games/PinDrop',
  component: PinDrop,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A pin on a picture: a map, a floor plan, a diagram. With an `answer` it is "Where is it?" and a pin scores by how close it lands; without one it is "Where are you?" and the room’s pins are the result. A pin is moved by tap, drag or arrow keys and said in words, by the picture’s named `regions` when given.\n\n' +
          '**The screen** uses `PinMap`. **The model.** `games/pin-drop-model` measures distance in widths of the picture (`pinDistance`), scores it (`pinPoints`), names a region (`regionOf`) and sums up the room (`pinSpread`).',
      },
    },
  },
  args: {
    prompt: 'Where is the old well?',
    src: SRC,
    alt: 'A map of a small island: a harbour in the south-west, a forest in the west, a hill in the north-east, and a path between them.',
    aspect: ASPECT,
    regions: REGIONS,
    answer: ANSWER,
    pins: PINS,
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-128">
      <PinDrop {...args} />
    </div>
  ),
} satisfies Meta<typeof PinDrop>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Revealed: the answer, the line to the viewer's pin, and the room's pins. */
export const Default: Story = {
  args: { value: { x: 60, y: 54 }, pinsIncludeOwn: false, revealed: true },
};

/** Placing: tap, drag, or use the arrow keys. */
export const Placing: Story = {};

/** The whole round: place, then the host reveals. */
export const Live: Story = {
  render: (args) => {
    const [revealed, setRevealed] = React.useState(false);
    return (
      <div className="grid max-w-128 gap-4">
        <PinDrop {...args} revealed={revealed} />
        <button type="button" className="justify-self-start text-sm underline" onClick={() => setRevealed((r) => !r)}>
          {revealed ? 'Hide the answer' : 'Host reveals the answer'}
        </button>
      </div>
    );
  },
};

/** "Where are you?": no answer, the room's pins are the result. */
export const NoAnswer: Story = {
  args: { prompt: 'Where on the island would you spend a free afternoon?', answer: null, value: { x: 30, y: 42 } },
};

/** The shared screen. */
export const Screen: Story = {
  render: (args) => (
    <div className="max-w-192">
      <PinMap src={args.src} aspect={ASPECT} pins={PINS} answer={ANSWER} revealed size="stage" locale="en-US" />
    </div>
  ),
};

export const RightToLeft: Story = {
  decorators: [withRtl],
  args: { value: { x: 60, y: 54 }, revealed: true },
};
