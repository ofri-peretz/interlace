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
};

export default meta;
type Story = StoryObj<typeof meta>;

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-64 w-full max-w-content overflow-hidden rounded-lg border border-border bg-card">
    {children}
  </div>
);

export const Default: Story = {
  render: () => (
    <Stage>
      <InteractiveGridPattern data-testid="story-interactive-grid" />
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
  render: () => (
    <Stage>
      <InteractiveGridPattern
        defaultHoveredSquare={12}
        data-testid="story-interactive-grid-uncontrolled"
      />
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
  render: () => (
    <Stage>
      <InteractiveGridPattern
        lineOpacity={0.4}
        hoverOpacity={0.9}
        defaultHoveredSquare={8}
        data-testid="story-interactive-grid-contrast"
      />
    </Stage>
  ),
};
