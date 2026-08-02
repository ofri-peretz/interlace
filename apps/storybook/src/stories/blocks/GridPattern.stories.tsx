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
          'Decorative graph-paper grid for section backgrounds, with an optional set ' +
          'of highlighted cells. Like DotPattern it is `aria-hidden` chrome that ' +
          'inherits `currentColor`, so it tints from a text colour on the wrapper.',
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
      <GridPattern className="text-border" data-testid="story-grid" />
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
  render: () => (
    <Stage>
      <GridPattern
        dashArray="4 2"
        className="text-border"
        data-testid="story-grid-dashed"
      />
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
  render: () => (
    <Stage>
      <GridPattern
        squares={[
          [2, 1],
          [4, 3],
          [7, 2],
          [9, 4],
        ]}
        className="text-primary/30"
        data-testid="story-grid-squares"
      />
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
  render: () => (
    <Stage>
      <GridPattern
        animated
        squares={[
          [1, 1],
          [5, 2],
          [8, 3],
        ]}
        className="text-primary/30"
        data-testid="story-grid-animated"
      />
    </Stage>
  ),
};
