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
          'Paints the DS focus contract (WCAG 2.2 SC 2.4.13) on a `<span>` wrapper whenever anything inside it takes focus. Reach for it in two situations: you are composing a custom interactive surface (a card-as-button, a clickable list row) and do not want to hand-write the ring utility chain, or you opted a subtree out of the global preflight ring and need to put the contract back per-element. Every DS primitive already carries its own ring — wrapping one in this is redundant. The cost is one extra DOM node per surface. Server component; no hooks.',
      },
    },
  },
  argTypes: {
    offset: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
      description:
        'Gap between the focused element and the ring: `none` = 0px, `sm` = 1px, `md` = 2px (the preflight contract), `lg` = 4px. Use `none` when the wrapped surface is flush against a container edge, so the ring is not clipped.',
      table: {
        type: { summary: "'none' | 'sm' | 'md' | 'lg'" },
        defaultValue: { summary: 'md' },
        category: 'Appearance',
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the wrapper span, which is `inline-block rounded-md` by default. **Wrapping a block-level child? You must pass `block` here.** An `inline-block` wrapper around an auto-width block child is a circular width dependency that Chrome resolves to zero — the wrapper measures 0px and the content renders one word per line. Set the control to `inline-block` to see it happen.',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: "'inline-block rounded-md'" },
        category: 'Appearance',
      },
    },
    children: {
      control: false,
      description:
        'The focusable element. The ring is applied on `focus-within` of the wrapper rather than `focus-visible` on the child, so it still lands when the child sets its own outline.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
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
  args: { offset: 'md', className: 'block' },
  render: (args) => (
    <div className="w-[420px] max-w-full">
      <FocusRing {...args}>
        <FocusableCard>
          Tab here to see the ring. Change `offset` to move it, or set
          `className` to <code className="font-mono">inline-block</code> to
          watch the zero-width collapse the docs warn about.
        </FocusableCard>
      </FocusRing>
    </div>
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
