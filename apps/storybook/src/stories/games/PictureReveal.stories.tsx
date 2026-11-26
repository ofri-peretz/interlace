import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PictureReveal } from '@interlace/ui/games/picture-reveal';
import { withRtl } from '@/decorators';

// A neutral line drawing, inline so the story needs no network.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<rect width="400" height="300" fill="#dbe7f0"/><circle cx="320" cy="70" r="28" fill="#f2d27a"/>
<path d="M0 230 Q100 200 200 230 T400 230 V300 H0Z" fill="#7fa7c4"/>
<path d="M170 230 L182 90 H218 L230 230Z" fill="#f4f1ea" stroke="#33363a" stroke-width="4"/>
<path d="M176 160 H224 M179 125 H221" stroke="#c0453a" stroke-width="14"/>
<rect x="184" y="62" width="32" height="28" fill="#f2d27a" stroke="#33363a" stroke-width="4"/>
<path d="M178 62 L200 40 L222 62Z" fill="#33363a"/></svg>`;
const SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;
const CLUES = [
  'It stands near water.',
  'It is tall and narrow.',
  'It has a light at the top.',
  'Ships look for it at night.',
];

const meta = {
  title: 'Games/PictureReveal',
  component: PictureReveal,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A picture under tiles that come away a few at a time while the room guesses. The presenter moves `step`; every screen uncovers the same tiles in the same seeded order. Each step can carry a clue in words, shown and announced, so a screen reader user plays the same round; the image has no text alternative until the reveal.\n\n' +
          '**Phones** guess with `TypeAnswer`; `guessPoints` pays an early right guess more.\n\n' +
          '**Motion.** Tiles leaving together fade and shrink, staggered over 150ms. Under reduced motion they are simply gone.',
      },
    },
  },
  args: {
    src: SRC,
    alt: 'A lighthouse by the sea',
    seed: 'demo-round',
    step: 2,
    steps: 4,
    cols: 4,
    rows: 3,
    clues: CLUES,
  },
  render: (args) => (
    <div className="max-w-144">
      <PictureReveal {...args} />
    </div>
  ),
} satisfies Meta<typeof PictureReveal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Halfway: some tiles off, two clues in. */
export const Default: Story = {};

/** The presenter's controls: one step at a time, then the reveal. */
export const Presenter: Story = {
  args: { size: 'stage' },
  render: (args) => {
    const [step, setStep] = React.useState(0);
    const [revealed, setRevealed] = React.useState(false);
    return (
      <div className="grid max-w-168 gap-4">
        <div className="flex gap-4 text-sm">
          <button type="button" className="underline" onClick={() => setStep((s) => Math.min(s + 1, args.steps ?? 8))}>
            Next step
          </button>
          <button type="button" className="underline" onClick={() => setRevealed(true)}>
            Reveal
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => {
              setStep(0);
              setRevealed(false);
            }}
          >
            Start again
          </button>
        </div>
        <PictureReveal {...args} step={step} revealed={revealed} />
      </div>
    );
  },
};

/** Revealed, with the answer. */
export const Revealed: Story = { args: { revealed: true } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl] };
