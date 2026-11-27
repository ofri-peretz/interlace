import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Spectrum } from '@interlace/ui/games/spectrum';
import { withRtl } from '@/decorators';

// Invented dots for a neutral statement, so the demo makes no claim about anyone.
const ROOM = [12, 18, 25, 31, 34, 38, 41, 44, 47, 52, 55, 56, 58, 61, 63, 66, 68, 72, 77, 85, 91];
const BEFORE = [8, 12, 15, 22, 25, 28, 33, 36, 40, 44, 47, 52, 55, 60, 64, 70, 75, 80];

const meta = {
  title: 'Games/Spectrum',
  component: Spectrum,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Where do you stand? A statement, two poles and a line between them. Each person places one dot, then sees the whole room spread along the same line: their own bin marked, the room’s middle drawn, and, when the statement was asked before, where the middle was then.\n\n' +
          '**The model.** `games/spectrum-model` bins the dots, finds the median, the middle half and the mean (`summarizeSpectrum`), and says how far the middle moved between two rounds (`spectrumShift`).\n\n' +
          '**Privacy.** `minResponses` keeps the room hidden until enough dots are in.\n\n' +
          '**Motion.** On placing, the bars grow from the line and the room marker slides from your dot to the room’s middle (400ms). Under reduced motion the picture is simply there.',
      },
    },
  },
  args: {
    statement: 'Mornings are the best time to get work done.',
    poles: ['Disagree', 'Agree'],
    values: ROOM,
    onPlace: fn(),
    locale: 'en-US',
  },
  render: (args) => (
    <div className="max-w-prose">
      <Spectrum {...args} />
    </div>
  ),
} satisfies Meta<typeof Spectrum>;

export default meta;
type Story = StoryObj<typeof meta>;

/** After placing, with an earlier round of the same statement. */
export const Default: Story = {
  args: { defaultValue: 30, before: BEFORE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/22 people placed a dot/)).toBeTruthy();
  },
};

/** Drag the dot (or use the arrow keys), then place it. */
export const Placing: Story = {};

/** Placing by keyboard. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const thumb = canvas.getByRole('slider');
    thumb.focus();
    await userEvent.keyboard('{End}');
    await userEvent.click(canvas.getByRole('button', { name: 'Place my dot' }));
    await expect(args.onPlace).toHaveBeenCalledWith(100);
  },
};

/** Too few dots yet. */
export const Private: Story = { args: { values: [40, 60], defaultValue: 50, minResponses: 10 } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl], args: { defaultValue: 70, before: BEFORE } };
