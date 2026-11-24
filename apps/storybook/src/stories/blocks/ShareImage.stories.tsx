import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ShareImage, type ShareImageProps } from '@interlace/ui/patterns/share-image';
import {
  NEUTRAL_SHARE_THEME,
  SHARE_IMAGE_SIZES,
  type ShareImageTheme,
} from '@interlace/ui/patterns/share-image-model';

/**
 * A share image is a fixed 1200px picture, so the story shrinks it to the
 * column it sits in, the way a feed shows it. Only the preview scales: the
 * tree is exactly what the image renderer paints.
 */
function Preview(props: ShareImageProps) {
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  const { width, height } = SHARE_IMAGE_SIZES[props.size ?? 'og'];
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / width);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);
  return (
    <figure className="m-0 max-w-prose">
      <div
        ref={box}
        className="overflow-hidden rounded-lg border border-border"
        style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
      >
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <ShareImage {...props} />
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        {width} × {height}, shown at {Math.round(scale * 100)}%
      </figcaption>
    </figure>
  );
}

// An invented warm, editorial look: a story fixture, never shipped.
const PAPER: ShareImageTheme = {
  ...NEUTRAL_SHARE_THEME,
  background: '#f6f2ea',
  foreground: '#1d1b17',
  muted: '#5a554c',
  accent: '#1f4fa3',
  surface: '#fffdf8',
  border: '#ddd5c6',
  chart: ['#1f4fa3', '#b8862a', '#4d5d24', '#9a2f2f', '#6b7280'],
};

const meta = {
  title: 'Blocks/ShareImage',
  component: Preview,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The picture a link unfurls into on X, LinkedIn, Facebook, WhatsApp, iMessage and Slack. Render it with an image renderer (Next’s `ImageResponse`) at 1200 × 630, or 1200 × 1200 for `size="square"`.\n\n' +
          '**Theme.** Image renderers cannot read CSS variables, so the theme is a value. `themeFromCss(css)` reads your own theme file (`:root` shadcn tokens, `var()` resolved, `oklch()` turned into hex), and `shareMeta()` writes the `og:` and `twitter:` tags with each image’s size and alt.\n\n' +
          '**Evidence.** One optional piece beside the words (or under them in a square): a `stat`, up to five `bars`, or your own `visual`.\n\n' +
          '**Right to left.** Satori has no bidi algorithm, so Hebrew and Arabic are broken into lines and put in drawing order before it sees them. Register an Arabic face Satori can read (Cairo works; Noto Naskh Arabic does not).\n\n' +
          '**Motion.** None: a share image is a still.',
      },
    },
  },
  args: {
    brand: 'Field Atlas',
    label: 'Guide',
    kicker: 'Field notes',
    title: 'How tide tables are worked out, and why they are sometimes wrong',
    description:
      'Harmonic constituents, local surveys and the weather: what goes into a tide prediction, and where it fails.',
    site: 'atlas.example',
    footnote: '4 sources',
    theme: PAPER,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['og', 'square'], table: { category: 'Layout' } },
    dir: { control: 'inline-radio', options: ['auto', 'ltr', 'rtl'], table: { category: 'Layout' } },
    theme: { control: false },
    brand: { control: 'text' },
    visual: { control: false },
  },
} satisfies Meta<typeof Preview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A guide page: the words alone, in a warm editorial theme. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/How tide tables are worked out/)).toBeTruthy();
    await expect(canvasElement.querySelector('[data-slot="share-image"]')?.getAttribute('data-size')).toBe(
      'og',
    );
  },
};

/** A dataset page: one number beside the title. */
export const Stat: Story = {
  args: {
    label: 'Dataset',
    kicker: 'Coastline',
    title: 'Share of the coast that is protected',
    description: undefined,
    stat: { value: '38%', label: 'of 2,400 km, in 2025' },
    footnote: 'Updated 24 Nov 2026',
  },
};

/** A survey result, square, for chat thumbnails and saved cards. */
export const SquareBars: Story = {
  args: {
    size: 'square',
    label: 'Survey',
    kicker: 'Readers',
    title: 'Which tide forecast do you trust?',
    description: undefined,
    bars: [
      { label: 'Harbour office', value: 46, display: '46%' },
      { label: 'Weather app', value: 31, display: '31%' },
      { label: 'Printed table', value: 15, display: '15%' },
    ],
    footnote: 'n = 1,204',
  },
};

/** Hebrew: the card mirrors, and the text is drawn in reading order. */
export const RightToLeft: Story = {
  args: {
    brand: 'אטלס',
    label: 'מדריך',
    kicker: 'שאלה',
    title: 'למה הגאות מגיעה פעמיים ביום?',
    description: 'הירח, השמש וצורת החוף: הסבר קצר עם מקורות.',
    stat: { value: '12:25', label: 'שעות בין גאות לגאות' },
    footnote: undefined,
  },
};

/** No theme given: Interlace’s neutral look. */
export const Neutral: Story = {
  args: { theme: undefined, label: undefined },
};
