import { AvatarUpload } from '@interlace/ui/patterns/avatar-upload';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

const meta: Meta<typeof AvatarUpload> = {
  title: 'Blocks/AvatarUpload',
  component: AvatarUpload,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A profile photo the reader can set, change or take away: the photo as it will appear, Choose photo, and Remove once there is one. Dropping an image on the photo works too.\n\n' +
          '**Value.** `src` is the photo the reader already has. The value is what they did here: `undefined` for unchanged, a `File` once they chose one (a preview shows), `null` once they removed it (the fallback shows). A save can tell the three apart.\n\n' +
          '**Accessible.** Choose photo is a real file field in its label, described by the hint. A file that isn’t an image, or is too large, is turned away with the reason said in a polite live region. Remove hands focus back to Choose photo.\n\n' +
          '**Tokens.** `--avatar-upload-size` (default `4.5rem`) sizes the photo.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AvatarUpload>;

/** No photo yet: initials show, and only Choose photo is offered. */
export const Default: Story = {
  render: () => (
    <AvatarUpload fallback="RL" alt="Rina Levi" hint="JPG or PNG, up to 2 MB" maxSize={2_000_000} name="photo" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Choose photo')).toHaveAttribute('type', 'file');
    await expect(canvas.queryByRole('button', { name: 'Remove' })).toBeNull();
    await expect(canvas.getByText('RL')).toBeInTheDocument();
  },
};

/** Larger, with its own words. */
export const Large: Story = {
  render: () => (
    <AvatarUpload
      className="[--avatar-upload-size:6rem]"
      fallback="DK"
      chooseLabel="Upload a picture"
      hint="Square photos look best"
    />
  ),
};
