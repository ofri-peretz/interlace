import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { InteractiveGridPattern } from '@interlace/ui/patterns/interactive-grid-pattern';

const meta: Meta<typeof InteractiveGridPattern> = {
  title: 'Blocks/InteractiveGridPattern',
  component: InteractiveGridPattern,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A grid whose cells light up under the cursor. Unlike DotPattern and ' +
          'GridPattern this one responds to input, so it exposes the hover index as ' +
          'controlled state (`hoveredSquare` + `onHoveredSquareChange`) as well as ' +
          'uncontrolled (`defaultHoveredSquare`) — the standard both-modes contract. ' +
          'The effect is still decorative: nothing is conveyed by hover alone, so a ' +
          'keyboard or touch user loses no information.',
      },
    },
  },
  argTypes: {
    columns: {
      control: { type: 'range', min: 4, max: 48, step: 1 },
      description: 'Horizontal cell count. `columns × rows` rects are rendered, so keep the product sane.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '24' }, category: 'Geometry' },
    },
    rows: {
      control: { type: 'range', min: 4, max: 48, step: 1 },
      description: 'Vertical cell count.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '24' }, category: 'Geometry' },
    },
    squareWidth: {
      control: { type: 'range', min: 8, max: 120, step: 2 },
      description: 'Width of one cell, in user-space units.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '40' }, category: 'Geometry' },
    },
    squareHeight: {
      control: { type: 'range', min: 8, max: 120, step: 2 },
      description: 'Height of one cell.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '40' }, category: 'Geometry' },
    },
    lineOpacity: {
      control: { type: 'range', min: 0, max: 1, step: 0.05 },
      description:
        'Stroke opacity of every cell border. Raise it over a busy background, drop it under body copy.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.3' }, category: 'Appearance' },
    },
    hoverOpacity: {
      control: { type: 'range', min: 0, max: 1, step: 0.05 },
      description: 'Fill opacity of the hovered cell.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.3' }, category: 'Appearance' },
    },
    defaultHoveredSquare: {
      control: { type: 'number', min: 0, step: 1 },
      description:
        'Uncontrolled starting cell (flat index, row-major). Seeding one makes the affordance discoverable before the pointer arrives.',
      table: { type: { summary: 'number | null' }, defaultValue: { summary: 'null' }, category: 'State' },
    },
    hoveredSquare: {
      control: { type: 'number', min: 0, step: 1 },
      description:
        'Controlled cell index. Setting this at all switches the component to controlled mode — hover then does nothing unless you also handle `onHoveredSquareChange`. Leave it empty to keep the internal state.',
      table: { type: { summary: 'number | null' }, category: 'State' },
    },
    onHoveredSquareChange: {
      action: 'hoveredSquareChange',
      description:
        'Fires with `(index, { row, column })`, or `(null, null)` when the pointer leaves. Noun-first change event (R9).',
      table: {
        type: { summary: '(index: number | null, details: { row, column } | null) => void' },
        category: 'Events',
      },
    },
    label: {
      control: 'text',
      description:
        'Written into the SVG `<title>`. NOT an accessible name — the grid is `aria-hidden`; this exists for tooling that opens the SVG on its own.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: "'Decorative interactive grid'" },
        category: 'Accessibility',
      },
    },
    squaresClassName: {
      control: 'text',
      description: 'Class merged onto every `<rect>`, after the base cell classes.',
      table: { category: 'Appearance' },
    },
    className: {
      control: 'text',
      description:
        'The colour seam — cells inherit `currentColor`, so a text-colour utility here sets the hue (base is `text-border`).',
      table: { category: 'Appearance' },
    },
    squareProps: {
      control: false,
      description:
        'Per-cell prop factory `(index, { row, column }) => rect props`. Spread before the component\'s own geometry and hover wiring, so it can decorate but not hijack.',
      table: { type: { summary: 'InteractiveGridSquareProps' }, category: 'Slots' },
    },
    'data-testid': {
      control: 'text',
      description: 'Required selector hook (R5). Each cell derives `{value}-cell-{index}`.',
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

export const Default: Story = {
  args: {
    'data-testid': 'story-interactive-grid',
    columns: 24,
    rows: 24,
    squareWidth: 40,
    squareHeight: 40,
    lineOpacity: 0.3,
    hoverOpacity: 0.3,
    label: 'Decorative interactive grid',
  },
  render: (args) => (
    <Stage>
      <InteractiveGridPattern {...args} />
    </Stage>
  ),
};

export const Uncontrolled: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`defaultHoveredSquare` seeds a lit cell so the affordance is discoverable ' +
          'before the pointer arrives — and so this story has something for axe and ' +
          'the dark-theme decorator to render without simulating a hover.',
      },
    },
  },
  args: {
    'data-testid': 'story-interactive-grid-uncontrolled',
    defaultHoveredSquare: 12,
  },
  render: (args) => (
    <Stage>
      <InteractiveGridPattern {...args} />
    </Stage>
  ),
};

export const Controlled: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The consumer owns the hover index. Useful when something outside the grid ' +
          '— a legend, a step indicator — should drive which cell is lit.',
      },
    },
  },
  render: function ControlledStory() {
    const [hovered, setHovered] = React.useState<number | null>(5);
    return (
      <div className="flex w-full max-w-content flex-col gap-3">
        <Stage>
          <InteractiveGridPattern
            hoveredSquare={hovered}
            onHoveredSquareChange={setHovered}
            data-testid="story-interactive-grid-controlled"
          />
        </Stage>
        <p className="text-ui text-muted-foreground tabular-nums">
          Hovered cell: {hovered ?? 'none'}
        </p>
      </div>
    );
  },
};

export const HigherContrast: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`lineOpacity` and `hoverOpacity` are the two knobs that decide how loud the ' +
          'grid is against the surface behind it. Raise them over a busy background, ' +
          'drop them under body copy.',
      },
    },
  },
  args: {
    'data-testid': 'story-interactive-grid-contrast',
    lineOpacity: 0.4,
    hoverOpacity: 0.9,
    defaultHoveredSquare: 8,
  },
  render: (args) => (
    <Stage>
      <InteractiveGridPattern {...args} />
    </Stage>
  ),
};
