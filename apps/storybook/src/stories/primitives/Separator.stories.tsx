import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from '@interlace/ui/separator';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Separator> = {
  title: 'Primitives/Separator',
  component: Separator,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A 1px token-coloured rule carrying `role="separator"`, for boundaries *inside* one surface — metadata rows, toolbar segments, menu sections. It fills its parent on the chosen axis and owns no margin of its own, so the breathing room around it is the parent layout\'s job. Between larger regions prefer the thing that already implies a boundary (a card border, a `Section` divider, a heading); a rule everywhere reads as noise.',
      },
    },
  },
  argTypes: {
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
      description:
        'Axis of the rule. `horizontal` is `h-px w-full`; `vertical` is `w-px h-full`, so a vertical separator only shows inside a parent with a resolved height (a flex row with `h-12`, or `items-stretch`).',
      table: {
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: 'horizontal' },
        category: 'Appearance',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged after the base classes — the seam for the surrounding margin (`my-3`, `mx-2`) and for a heavier or tinted rule (`bg-primary/40`, `h-0.5`).',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  args: { orientation: 'horizontal', className: 'my-3' },
  // The surrounding layout follows the orientation control, so flipping it
  // shows a real vertical rule instead of an invisible zero-height one.
  render: (args) => {
    const vertical = args.orientation === 'vertical';
    return vertical ? (
      <div className="flex h-12 items-center gap-3 text-sm">
        <span>Reactions</span>
        <Separator {...args} />
        <span>Comments</span>
        <Separator {...args} />
        <span>Long reads</span>
      </div>
    ) : (
      <div className="w-[320px] max-w-full">
        <p className="text-sm font-semibold">Reactions</p>
        <p className="text-muted-foreground text-xs">218 across 12 articles</p>
        <Separator {...args} />
        <p className="text-sm font-semibold">Comments</p>
        <p className="text-muted-foreground text-xs">70 across 12 articles</p>
      </div>
    );
  },
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 items-center gap-3 text-sm">
      <span>Latest</span>
      <Separator orientation="vertical" />
      <span>Popular</span>
      <Separator orientation="vertical" />
      <span>Long reads</span>
    </div>
  ),
};

export const Dark: Story = {
  ...Horizontal,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Horizontal,
  decorators: [withRtl],
};
