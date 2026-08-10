import type { Meta, StoryObj } from '@storybook/react-vite';
import { Figure } from '@interlace/ui/patterns/figure';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/Figure',
  component: Figure,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Semantic wrapper for self-contained media — an image, diagram, chart or screenshot ' +
          'with a caption that travels with it. It composes AspectRatio, so the frame is ' +
          'reserved before the asset loads and the surrounding prose never jumps. Use it for ' +
          'media that is referenced from the text ("see Figure 1"); a purely decorative image ' +
          'does not need a `<figure>` at all. `alt` is required at the type level — WCAG ' +
          '1.1.1 is a compile error here, not a lint warning.',
      },
    },
  },
  argTypes: {
    src: {
      control: 'text',
      description: 'Image URL for the default `<img>`. Ignored entirely when `children` is provided.',
      table: { category: 'Media', type: { summary: 'string' } },
    },
    alt: {
      control: 'text',
      description:
        'Required. Describe what the media conveys, not what it is ("Coverage climbing from 62% to 100% over six weeks", not "a chart"). For a genuinely decorative figure pass an empty string explicitly — the type forces the choice at the call site.',
      table: { category: 'A11y', type: { summary: 'string' } },
    },
    ratio: {
      control: { type: 'range', min: 0.25, max: 4, step: 0.05 },
      description:
        'Width ÷ height handed to AspectRatio — this is what reserves the space, so it should match the asset (16/9 ≈ 1.78, 4/3 ≈ 1.33, square = 1). A wrong ratio letterboxes the media rather than shifting the page.',
      table: {
        category: 'Layout',
        type: { summary: 'number' },
        defaultValue: { summary: '16 / 9' },
      },
    },
    caption: {
      control: 'text',
      description:
        'Rendered in a `<figcaption>` under the frame. Omit it and no caption element is emitted at all.',
      table: { category: 'Content', type: { summary: 'ReactNode' } },
    },
    children: {
      control: false,
      description:
        'Replaces the default `<img>` with your own node — next/image, a video, an inline SVG diagram, an embed. It is positioned inside the reserved frame, so it should be absolutely positioned to fill it (see the Variants story).',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the `<figure>`, which already carries `my-lg`. The block has no width of its own — it fills its parent — so width belongs on a wrapper, not here.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
} satisfies Meta<typeof Figure>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_SRC =
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80&auto=format&fit=crop';

export const Default: Story = {
  args: {
    src: SAMPLE_SRC,
    alt: 'A developer typing on a laptop with code visible on the screen.',
    caption: 'Figure 1. The canonical CLS-free media block.',
    ratio: 16 / 9,
  },
  decorators: [
    (Story) => (
      <div className="w-[640px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

// `StoryObj<typeof Figure>` rather than `StoryObj<typeof meta>`: `alt` is a
// REQUIRED prop, which makes `args` mandatory on every meta-typed story — and
// this one is a pure composition demo that renders its own Figures.
export const Variants: StoryObj<typeof Figure> = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="space-y-lg p-8">
      <div className="w-[480px] max-w-full">
        <Figure
          src={SAMPLE_SRC}
          alt="16:9 widescreen frame."
          caption="ratio = 16 / 9 (default widescreen)"
        />
      </div>
      <div className="w-[480px] max-w-full">
        <Figure
          src={SAMPLE_SRC}
          alt="4:3 classic frame."
          ratio={4 / 3}
          caption="ratio = 4 / 3"
        />
      </div>
      <div className="w-[320px] max-w-full">
        <Figure
          src={SAMPLE_SRC}
          alt="1:1 square frame."
          ratio={1}
          caption="ratio = 1 (square)"
        />
      </div>
      <div className="w-[480px] max-w-full">
        <Figure
          src={SAMPLE_SRC}
          alt="No caption — just the framed media."
        />
      </div>
      <div className="w-[480px] max-w-full">
        <Figure alt="Composed child overriding the default img.">
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-muted text-muted-foreground">
            Custom child (SVG / video / next-image)
          </div>
        </Figure>
      </div>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [
    withDark,
    (Story) => (
      <div className="w-[640px] max-w-full p-6">
        <Story />
      </div>
    ),
  ],
};

export const RTL: Story = {
  ...Default,
  decorators: [
    withRtl,
    (Story) => (
      <div className="w-[640px] max-w-full p-6">
        <Story />
      </div>
    ),
  ],
};

export const BelowMinViewport: Story = {
  args: {
    src: SAMPLE_SRC,
    alt: 'Rendered below the 320 CSS-px floor — the dev outline should warn.',
    caption: 'Below MIN_VIEWPORT (280px) — preflight outline activates.',
  },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="w-[280px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
};
