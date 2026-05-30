import type { Meta, StoryObj } from '@storybook/react-vite';
import { Figure } from '@interlace/ui/blocks/figure';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/Figure',
  component: Figure,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Semantic media block. Composes AspectRatio so the layout reserves space before the asset loads (CLS=0). `alt` is required at the type level — WCAG 1.1.1 is non-negotiable.',
      },
    },
  },
  argTypes: {
    ratio: { control: { type: 'number', min: 0.25, max: 4, step: 0.05 } },
    caption: { control: 'text' },
    alt: { control: 'text' },
    src: { control: 'text' },
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
  },
  decorators: [
    (Story) => (
      <div className="w-[640px]">
        <Story />
      </div>
    ),
  ],
};

export const Variants: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="space-y-lg p-8">
      <div className="w-[480px]">
        <Figure
          src={SAMPLE_SRC}
          alt="16:9 widescreen frame."
          caption="ratio = 16 / 9 (default widescreen)"
        />
      </div>
      <div className="w-[480px]">
        <Figure
          src={SAMPLE_SRC}
          alt="4:3 classic frame."
          ratio={4 / 3}
          caption="ratio = 4 / 3"
        />
      </div>
      <div className="w-[320px]">
        <Figure
          src={SAMPLE_SRC}
          alt="1:1 square frame."
          ratio={1}
          caption="ratio = 1 (square)"
        />
      </div>
      <div className="w-[480px]">
        <Figure
          src={SAMPLE_SRC}
          alt="No caption — just the framed media."
        />
      </div>
      <div className="w-[480px]">
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
      <div className="w-[640px] p-6">
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
      <div className="w-[640px] p-6">
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
      <div className="w-[280px] p-4">
        <Story />
      </div>
    ),
  ],
};
