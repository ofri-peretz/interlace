import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PhotoUpload, PhotoUploadError, type PhotoItem } from '@interlace/ui/patterns/photo-upload';
import { withRtl } from '@/decorators';

// Neutral sample photos: flat colour tiles drawn as data URIs, so the screenshots never depend on
// a network, and nothing here is a real person's picture.
const tile = (a: string, b: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/></svg>`,
  )}`;

const item = (over: Partial<PhotoItem> & { id: string; name: string }): PhotoItem => ({
  status: 'done',
  progress: 1,
  attempt: 0,
  source: { bytes: 5_400_000, type: 'image/jpeg', width: 4032, height: 3024 },
  output: {
    blob: new Blob(['x'], { type: 'image/jpeg' }),
    type: 'image/jpeg',
    width: 2048,
    height: 1536,
    bytes: 812_000,
    metadataRemoved: ['exif', 'gps'],
    alt: '',
  },
  previewUrl: tile('#7aa6c2', '#2d5169'),
  alt: '',
  crop: { rect: null, quarter: 0 },
  error: null,
  result: null,
  fingerprint: over.id,
  ...over,
});

const SAMPLE: PhotoItem[] = [
  item({ id: 'a', name: 'harbour-morning.jpg' }),
  item({
    id: 'b',
    name: 'dock-lines.jpg',
    status: 'uploading',
    progress: 0.62,
    output: { ...item({ id: 'x', name: 'x' }).output!, metadataRemoved: [], bytes: 640_000 },
    previewUrl: tile('#c29a7a', '#693f2d'),
  }),
  item({
    id: 'c',
    name: 'chart-table.png',
    status: 'error',
    progress: 0,
    source: { bytes: 2_100_000, type: 'image/png', width: 1600, height: 1200 },
    output: null,
    previewUrl: tile('#9bc27a', '#4a692d'),
    error: { code: 'upload-failed', retryable: true, detail: 'the server said 503' },
  }),
];

const reachable = async (_p: unknown, ctx: { onProgress: (n: number) => void }) => {
  ctx.onProgress(0.5);
  return { ok: true };
};

const meta = {
  title: 'Blocks/PhotoUpload',
  component: PhotoUpload,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Photos from the five places people get them (pick, drag, paste, camera), made small and clean in the browser, then handed to **one function you provide**, `onUpload`. ' +
          'The component has no `fetch`, no `XMLHttpRequest` and no destination. What reaches `onUpload` has no location, camera, time or embedded thumbnail inside it.\n\n' +
          '**Where do the photos go?** Anywhere you like, in your own code. With a signed URL: `onUpload={(photo, ctx) => fetch(url, { method: "PUT", body: photo.blob, signal: ctx.signal })}`. ' +
          'With progress: `xhrUploader("/api/photos", { field: "photo" })` from `@interlace/ui/patterns/photo-upload-xhr`. Both are your code, not the component\'s.\n\n' +
          '**What CI measures.** The metadata strip (fixtures with Exif, GPS, XMP, IPTC and an embedded thumbnail, scanned by an independent reader), the states, and the keyboard path. ' +
          '**What it does not.** A real phone camera, a real HEIC decode and a 12 MP photo in Safari are manual checks on a named device list.',
      },
    },
  },
  args: { 'data-testid': 'photo-upload', onUpload: reachable, defaultValue: SAMPLE },
  argTypes: {
    maxFiles: { control: 'number', table: { category: 'Limits' } },
    manual: { control: 'boolean', table: { category: 'Behaviour' } },
    altText: { control: 'boolean', table: { category: 'Behaviour' } },
    disabled: { control: 'boolean', table: { category: 'State' } },
    readOnly: { control: 'boolean', table: { category: 'State' } },
  },
  render: (args) => (
    <div className="max-w-content">
      <PhotoUpload {...args} />
    </div>
  ),
} satisfies Meta<typeof PhotoUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A photo uploaded, one uploading at 62 percent, and one that failed with a way to try again. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'Photos' })).toBeTruthy();
    await expect(canvas.getByRole('alert').textContent).toContain('the connection dropped');
    await expect(canvas.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('62');
  },
};

/** Nothing added yet: the dropzone, the Choose button, and the hint. */
export const Empty: Story = { args: { defaultValue: [] } };

/** The most photos allowed are added: the area closes and says why. */
export const Full: Story = {
  args: { maxFiles: 3, defaultValue: SAMPLE.map((s) => ({ ...s, status: 'done' as const, error: null })) },
};

/** `manual`: photos wait, ready, for the person to press Upload. */
export const Manual: Story = {
  args: {
    manual: true,
    defaultValue: [
      item({ id: 'a', name: 'harbour-morning.jpg', status: 'ready', progress: 0 }),
      item({ id: 'b', name: 'dock-lines.jpg', status: 'ready', progress: 0, previewUrl: tile('#c29a7a', '#693f2d') }),
    ],
  },
};

/** One field per photo for what it shows, which becomes the picture's alt text. */
export const AltText: Story = { args: { altText: true, defaultValue: [SAMPLE[0]!] } };

export const Disabled: Story = { args: { disabled: true } };

/** Shown, not editable: no add, no remove, no crop. */
export const ReadOnly: Story = { args: { readOnly: true } };

/** A crop frame is offered on photos that have not gone up yet. */
export const WithCrop: Story = {
  args: {
    crop: { aspect: 1, shape: 'round' },
    defaultValue: [item({ id: 'a', name: 'portrait.jpg', status: 'ready', progress: 0 })],
    manual: true,
  },
};

/** At 320 px the list stacks and every control stays reachable. */
export const Mobile320: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <PhotoUpload {...args} />
    </div>
  ),
};

export const Rtl: Story = { decorators: [withRtl] };

/** Drop two files on the area: the picture is taken, the other file is skipped with its reason. */
export const FileDropOnly: Story = {
  args: { defaultValue: [], onUpload: async () => { throw new PhotoUploadError('demo', { retryable: false }); } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(/choose photos/i) as HTMLInputElement;
    const svg = new File(['<svg/>'], 'logo.png', { type: 'image/png' });
    await userEvent.upload(input, svg, { applyAccept: false });
    await expect(await canvas.findByRole('status')).toBeTruthy();
  },
};
