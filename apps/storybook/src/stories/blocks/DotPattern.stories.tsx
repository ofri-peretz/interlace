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
  render: () => (
    <Stage>
      <DotPattern className="text-muted-foreground/40" data-testid="story-dots" />
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
