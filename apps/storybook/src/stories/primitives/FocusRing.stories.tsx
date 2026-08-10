import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusRing, MIN_VIEWPORT } from '@interlace/ui/focus-ring';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/FocusRing',
  component: FocusRing,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Composable wrapper that paints the DS focus contract (WCAG 2.2 SC 2.4.13) around its child on focus-within. Use it for custom interactive surfaces or to reintroduce the ring on subtrees where the global preflight ring was opted out.',
      },
    },
  },
  argTypes: {
    offset: { control: 'select', options: ['none', 'sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof FocusRing>;

export default meta;
type Story = StoryObj<typeof meta>;

const FocusableCard = ({ children }: { children: React.ReactNode }) => (
  <a
    href="#"
    className="block rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground hover:border-primary/60 hover:bg-card/80 focus:outline-none"
  >
    {children}
  </a>
);

export const Default: Story = {
  args: { offset: 'md' },
  render: (args) => (
    <FocusRing {...args} className="block">
      <FocusableCard>Tab here to see the ring at 2px offset.</FocusableCard>
    </FocusRing>
  ),
};

export const Offsets: Story = {
  parameters: {
    docs: { description: { story: 'Walk the four offset enum values — none / sm / md (default) / lg.' } },
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <FocusRing offset="none" className="block">
        <FocusableCard>offset = none</FocusableCard>
      </FocusRing>
      <FocusRing offset="sm" className="block">
        <FocusableCard>offset = sm</FocusableCard>
      </FocusRing>
      <FocusRing offset="md" className="block">
        <FocusableCard>offset = md (default)</FocusableCard>
      </FocusRing>
      <FocusRing offset="lg" className="block">
        <FocusableCard>offset = lg</FocusableCard>
      </FocusRing>
    </div>
  ),
};

export const CustomSurface: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Wrap a custom interactive surface (a clickable list row, a card-as-button). Renders a focus ring that consumers can\'t accidentally style away.',
      },
    },
  },
  render: () => (
    <ul className="max-w-96 divide-y divide-border rounded-md border border-border">
      {['Alpha', 'Bravo', 'Charlie'].map((label) => (
        <li key={label}>
          <FocusRing offset="none" className="block rounded-none">
            <a href="#" className="block px-4 py-3 text-sm hover:bg-muted focus:outline-none">
              {label}
            </a>
          </FocusRing>
        </li>
      ))}
    </ul>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }} className="border-2 border-dashed border-muted p-3">
      <FocusRing className="block">
        <FocusableCard>Below 320 px — ring contract still active.</FocusableCard>
      </FocusRing>
    </div>
  ),
};
