import type { Meta, StoryObj } from '@storybook/react-vite';
import { DotPattern } from '@interlace/ui/patterns/dot-pattern';

const meta: Meta<typeof DotPattern> = {
  title: 'Blocks/DotPattern',
  component: DotPattern,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Decorative dot field for section backgrounds. It is chrome, not content: ' +
          'the SVG is `aria-hidden` and `pointer-events-none`, so it never lands in ' +
          'the accessibility tree or intercepts a click meant for what sits on top. ' +
          'Colour comes from `currentColor`, so you tint it by setting a text colour ' +
          'on the wrapper rather than by passing a hex.',
      },
    },
  },
  argTypes: {
    spacingX: {
      control: { type: 'range', min: 4, max: 64, step: 1 },
      description: 'Horizontal distance between dot centres, in px. Together with `spacingY` this is the tile size.',
      table: { category: 'Grid', type: { summary: 'number' }, defaultValue: { summary: '16' } },
    },
    spacingY: {
      control: { type: 'range', min: 4, max: 64, step: 1 },
      description: 'Vertical distance between dot centres, in px.',
      table: { category: 'Grid', type: { summary: 'number' }, defaultValue: { summary: '16' } },
    },
    offsetX: {
      control: { type: 'range', min: -32, max: 32, step: 1 },
      description: 'Shifts the whole grid origin horizontally — use it to line the field up with content above it.',
      table: { category: 'Grid', type: { summary: 'number' }, defaultValue: { summary: '0' } },
    },
    offsetY: {
      control: { type: 'range', min: -32, max: 32, step: 1 },
      description: 'Shifts the whole grid origin vertically.',
      table: { category: 'Grid', type: { summary: 'number' }, defaultValue: { summary: '0' } },
    },
    dotX: {
      control: { type: 'range', min: 0, max: 32, step: 0.5 },
      description: 'Where the dot sits inside its own cell on the x axis, in px. Distinct from `offsetX`: this moves the dot within the tile, not the tile.',
      table: { category: 'Grid', type: { summary: 'number' }, defaultValue: { summary: '1' } },
    },
    dotY: {
      control: { type: 'range', min: 0, max: 32, step: 0.5 },
      description: 'Where the dot sits inside its own cell on the y axis, in px.',
      table: { category: 'Grid', type: { summary: 'number' }, defaultValue: { summary: '1' } },
    },
    radius: {
      control: { type: 'range', min: 0.25, max: 6, step: 0.05 },
      description: 'Dot radius in px. Below ~1 the field reads as texture; above ~2 it reads as polka dots.',
      table: { category: 'Appearance', type: { summary: 'number' }, defaultValue: { summary: '1' } },
    },
    color: {
      control: 'text',
      description:
        'Any CSS colour string, but the intended value is `currentColor` — tint the field by setting a text colour on the wrapper (e.g. `text-muted-foreground/40`) so it follows the theme instead of pinning a literal.',
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
        defaultValue: { summary: 'currentColor' },
      },
    },
    glow: {
      control: 'boolean',
      description:
        'Pulse each dot on a randomised delay. Costs one DOM node per cell instead of one tiled `<rect>`, and falls back to the static tile under `prefers-reduced-motion` — so it belongs behind a hero, not behind a form.',
      table: { category: 'Motion', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the root `<svg>`, which is already `absolute inset-0`. The colour utility goes here.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
    'data-testid': {
      control: 'text',
      description: 'Selector hook for E2E tests. No runtime default — the consumer supplies it.',
      table: { category: 'Testing', type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Decorative layers need a sized, positioned parent to be visible at all. */
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-64 w-full max-w-content overflow-hidden rounded-lg border border-border bg-card">
    {children}
  </div>
);

export const Default: Story = {
  args: {
    spacingX: 16,
    spacingY: 16,
    offsetX: 0,
    offsetY: 0,
    dotX: 1,
    dotY: 1,
    radius: 1,
    color: 'currentColor',
    glow: false,
    className: 'text-muted-foreground/40',
    'data-testid': 'story-dots',
  },
  render: (args) => (
    <Stage>
      <DotPattern {...args} />
    </Stage>
  ),
};

export const Dense: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Tighter spacing reads as texture rather than as individual dots.',
      },
    },
  },
  render: () => (
    <Stage>
      <DotPattern
        spacingX={12}
        spacingY={12}
        radius={0.8}
        className="text-muted-foreground/40"
        data-testid="story-dots-dense"
      />
    </Stage>
  ),
};

export const Glow: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `glow` variant animates dot opacity on a randomised per-dot delay. It ' +
          'is ambient motion — decorative, non-looping-attention — so it belongs ' +
          'behind a hero, not behind a form.',
      },
    },
  },
  render: () => (
    <Stage>
      <DotPattern
        glow
        spacingX={24}
        spacingY={24}
        className="text-primary/40"
        data-testid="story-dots-glow"
      />
    </Stage>
  ),
};

export const BehindContent: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'What it is for. The copy on top keeps its own contrast against the card ' +
          'surface — the dots sit at 40% and never become the background the text is ' +
          'measured against.',
      },
    },
  },
  render: () => (
    <Stage>
      <DotPattern className="text-muted-foreground/40" data-testid="story-dots-behind" />
      <div className="relative flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h2 className="text-h3 font-bold">Ship the boring parts faster</h2>
        <p className="max-w-prose text-ui text-muted-foreground">
          Composable blocks with skeletons, responsive ladders, and AA contrast
          already settled.
        </p>
      </div>
    </Stage>
  ),
};
