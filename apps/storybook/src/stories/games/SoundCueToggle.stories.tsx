import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SoundCueToggle } from '@interlace/ui/games/sound-cue-toggle';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Games/SoundCueToggle',
  component: SoundCueToggle,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The switch for a room’s sound cues, and the words for them. Sound is off until a person turns it on. Every cue that plays is also written as a plain phrase beside the switch ("Answer revealed") in a polite live region, so a person who cannot hear it still knows it happened.\n\n' +
          '**What plays, and when.** `useSoundCues(room)` plays a short cue for a change it watched happen (someone joined, the countdown, the question, the reveal, the podium), once, and never for the state it loaded into. The notes are quiet sine tones made in the browser: no audio files, no dependencies.',
      },
    },
  },
  args: { enabled: false, onChange: fn() },
  render: (args) => (
    <div className="max-w-prose">
      <SoundCueToggle {...args} />
    </div>
  ),
} satisfies Meta<typeof SoundCueToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off, as every room starts. */
export const Default: Story = {};

/** On, with the last cue in words. */
export const On: Story = { args: { enabled: true, caption: 'Answer revealed' } };

/** Turned on with the keyboard. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('switch', { name: 'Sound cues' })).toBe(document.activeElement);
    await userEvent.keyboard(' ');
    await expect(args.onChange).toHaveBeenCalledWith(true);
  },
};

/** A browser with no audio. */
export const Unsupported: Story = { args: { supported: false } };

/** Right to left. */
export const RightToLeft: Story = { decorators: [withRtl], args: { enabled: true, caption: 'Question open' } };
