import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import PhotoCropper from '@interlace/ui/patterns/photo-upload-crop';
import type { PhotoItem } from '@interlace/ui/patterns/photo-upload-model';

// The crop and turn dialog PhotoUpload opens, shown open on a neutral sample tile.
const TILE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7aa6c2"/><stop offset="1" stop-color="#2d5169"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><circle cx="110" cy="100" r="40" fill="#e8f0f5"/></svg>',
)}`;

const ITEM: PhotoItem = {
  id: 'a',
  name: 'harbour-morning.jpg',
  status: 'ready',
  progress: 0,
  attempt: 0,
  source: { bytes: 5_400_000, type: 'image/jpeg', width: 320, height: 240 },
  output: null,
  previewUrl: TILE,
  alt: '',
  crop: { rect: null, quarter: 0 },
  error: null,
  result: null,
  fingerprint: 'a',
};

const meta = {
  title: 'Blocks/PhotoUploadCrop',
  component: PhotoCropper,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The crop and turn dialog `PhotoUpload` opens for one photo; it loads only when a form asks for `crop`. ' +
          'Drag the frame or press the arrows (Shift moves ten times as far), zoom with the range or `+` and `-`, turn a quarter with `[` and `]` or the two buttons, Enter applies, Escape cancels. ' +
          'Arrow keys are physical: Left moves the frame left, in right-to-left layouts too. `shape="round"` masks the preview only; the saved crop is the whole rectangle.',
      },
    },
  },
  args: { item: ITEM, aspect: 1, shape: 'rect', onApply: () => {}, onCancel: () => {} },
  argTypes: {
    aspect: { control: 'number', table: { category: 'Shape' } },
    shape: { control: 'inline-radio', options: ['rect', 'round'], table: { category: 'Shape' } },
  },
} satisfies Meta<typeof PhotoCropper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A square frame on a landscape photo, with the frame focused for the keyboard. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('dialog')).toBeTruthy();
    await expect(body.getByRole('application')).toBeTruthy();
  },
};

/** A round mask for an avatar. */
export const Round: Story = { args: { shape: 'round' } };

/** Free: the whole picture to start from. */
export const FreeAspect: Story = { args: { aspect: null } };
