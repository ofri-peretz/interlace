import type { Meta, StoryObj } from '@storybook/react-vite';
import { GridPattern } from '@interlace/ui/patterns/grid-pattern';

const meta: Meta<typeof GridPattern> = {
  title: 'Blocks/GridPattern',
  component: GridPattern,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Decorative graph-paper backdrop that fills its positioned parent, with an ' +
          'optional set of highlighted accent cells. It is `aria-hidden` + ' +
          '`pointer-events-none` chrome and carries no information, so a reader who ' +
          'never notices it has missed nothing. Colour comes from `currentColor`: tint ' +
          'it with a text-colour utility on `className` (e.g. `text-border`), never a ' +
          'literal. Needs a `relative overflow-hidden` ancestor — reach for DotPattern ' +
          'when you want texture without the ruled-line grid.',
      },
    },
  },
  argTypes: {
    cellWidth: {
      control: { type: 'range', min: 8, max: 120, step: 2 },
      description: 'Width of one grid cell, in user-space units.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '40' }, category: 'Geometry' },
    },
    cellHeight: {
      control: { type: 'range', min: 8, max: 120, step: 2 },
      description: 'Height of one grid cell. Set it equal to `cellWidth` for square cells.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '40' }, category: 'Geometry' },
    },
    offsetX: {
      control: { type: 'range', min: -40, max: 40, step: 1 },
      description:
        'Horizontal origin of the pattern. The -1 default clips the leading edge so the grid bleeds past the left of its container instead of starting with a full line.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '-1' }, category: 'Geometry' },
    },
    offsetY: {
      control: { type: 'range', min: -40, max: 40, step: 1 },
      description: 'Vertical origin of the pattern.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '-1' }, category: 'Geometry' },
    },
    strokeWidth: {
      control: { type: 'range', min: 0.25, max: 4, step: 0.25 },
      description: 'Grid line weight, in user-space units.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1' }, category: 'Appearance' },
    },
    dashArray: {
      control: 'text',
      description:
        'SVG `stroke-dasharray`. `"0"` draws solid lines; `"4 2"` dashes. A dashed stroke reads lighter than a solid one at the same opacity.',
      table: { type: { summary: 'string' }, defaultValue: { summary: '"0"' }, category: 'Appearance' },
    },
    squares: {
      control: 'object',
      description:
        'Accent cells as `[column, row]` pairs. They inherit the SVG fill (`currentColor`), so they tint from the same text-colour utility as the lines.',
      table: { type: { summary: '[number, number][]' }, category: 'Data' },
    },
    animated: {
      control: 'boolean',
      description:
        'Pulse the accent squares on a soft opacity loop. No effect without `squares`, and forced off under `prefers-reduced-motion`.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'Motion',
      },
    },
    animationDuration: {
      control: { type: 'range', min: 1, max: 12, step: 0.5 },
      description: 'Seconds for one full pulse cycle of an animated accent cell.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '4' }, category: 'Motion' },
    },
    className: {
      control: 'text',
      description:
        'The colour seam. Base classes already set `opacity-30` + `fill-current stroke-current`, so a text-colour utility here (`text-border`, `text-primary/30`) is how the grid gets its hue.',
      table: { category: 'Appearance' },
    },
    'data-testid': {
      control: 'text',
      description: 'Required selector hook (R5) — no runtime default.',
      table: { type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-64 w-full max-w-content overflow-hidden rounded-lg border border-border bg-card">
    {children}
  </div>
);

const accentSquares: [number, number][] = [
  [2, 1],
  [4, 3],
  [7, 2],
  [9, 4],
];

export const Default: Story = {
  args: {
    'data-testid': 'story-grid',
    className: 'text-border',
    cellWidth: 40,
    cellHeight: 40,
    offsetX: -1,
    offsetY: -1,
    strokeWidth: 1,
    dashArray: '0',
    animated: false,
    animationDuration: 4,
  },
  render: (args) => (
    <Stage>
      <GridPattern {...args} />
    </Stage>
  ),
};

export const Dashed: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A dashed stroke reads lighter than a solid one at the same opacity.',
      },
    },
  },
  args: {
    'data-testid': 'story-grid-dashed',
    className: 'text-border',
    dashArray: '4 2',
  },
  render: (args) => (
    <Stage>
      <GridPattern {...args} />
    </Stage>
  ),
};

export const HighlightedSquares: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`squares` takes `[column, row]` pairs. Useful for suggesting a data shape ' +
          'behind a hero without rendering an actual chart.',
      },
    },
  },
  args: {
    'data-testid': 'story-grid-squares',
    className: 'text-primary/30',
    squares: accentSquares,
  },
  render: (args) => (
    <Stage>
      <GridPattern {...args} />
    </Stage>
  ),
};

export const Animated: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Highlighted cells fade in and out on a loop. Ambient only — the grid ' +
          'carries no information, so a reader who never notices the animation has ' +
          'missed nothing.',
      },
    },
  },
  args: {
    'data-testid': 'story-grid-animated',
    className: 'text-primary/30',
    animated: true,
    animationDuration: 4,
    squares: [
      [1, 1],
      [5, 2],
      [8, 3],
    ],
  },
  render: (args) => (
    <Stage>
      <GridPattern {...args} />
    </Stage>
  ),
};
