import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@interlace/ui/number-field';
import { Skeleton } from '@interlace/ui/skeleton';
import { Label } from '@interlace/ui/label';
import { withRtl } from '@/decorators';

const meta: Meta<typeof NumberField> = {
  title: 'Primitives/NumberField',
  component: NumberField,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A numeric field with stepper buttons, arrow-key stepping, drag-to-scrub and clamping — all owned by Base UI, which is the reason to use it over `<Input type="number">` (whose spinners are unstylable and whose clamping is browser-dependent). The controls below sit on the Root; the visible parts are composed as Group → Decrement / Input / Increment. Reach for it when a value has a step and bounds; a plain `Input` is better for identifiers that merely happen to be digits.',
      },
    },
  },
  argTypes: {
    defaultValue: {
      control: 'number',
      description:
        'Uncontrolled starting value. The story remounts when it changes so the control is observable.',
      table: { category: 'Data', type: { summary: 'number' } },
    },
    min: {
      control: 'number',
      description: 'Lower clamp. Disables Decrement once reached.',
      table: { category: 'Data' },
    },
    max: {
      control: 'number',
      description: 'Upper clamp. Disables Increment once reached.',
      table: { category: 'Data' },
    },
    step: {
      control: 'number',
      description:
        'Amount applied by the buttons, the arrow keys and a scrub drag.',
      table: { category: 'Data', defaultValue: { summary: '1' } },
    },
    largeStep: {
      control: 'number',
      description: 'Step used while Shift is held. Snaps to multiples.',
      table: { category: 'Data', defaultValue: { summary: '10' } },
    },
    smallStep: {
      control: 'number',
      description: 'Step used while the meta key is held. Snaps to multiples.',
      table: { category: 'Data', defaultValue: { summary: '0.1' } },
    },
    snapOnStep: {
      control: 'boolean',
      description:
        'Round to the nearest multiple of `step` when incrementing, instead of adding to the current value.',
      table: { category: 'Data', defaultValue: { summary: 'false' } },
    },
    format: {
      control: 'object',
      description:
        '`Intl.NumberFormatOptions` for the displayed text — e.g. `{ style: "currency", currency: "USD" }` or `{ style: "percent" }`. The underlying value stays a raw number.',
      table: { category: 'Data', type: { summary: 'Intl.NumberFormatOptions' } },
    },
    allowWheelScrub: {
      control: 'boolean',
      description:
        'Let the mouse wheel change the value while the input is focused and hovered. Off by default — it hijacks page scroll.',
      table: { category: 'Behaviour', defaultValue: { summary: 'false' } },
    },
    disabled: {
      control: 'boolean',
      description: 'Ignore all interaction; dims the group to `opacity-50`.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    readOnly: {
      control: 'boolean',
      description:
        'Value is shown and submitted but cannot be changed. Prefer over `disabled` when the number still matters to the form.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    required: {
      control: 'boolean',
      description: 'Form constraint — a value must be present on submit.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    name: {
      control: 'text',
      description: 'Identifies the field in form submission.',
      table: { category: 'Form' },
    },
    onValueChange: {
      action: 'valueChange',
      description:
        'Fires on every change with `(value, eventDetails)`; `eventDetails.reason` distinguishes typing from a button press, wheel or scrub.',
      table: { category: 'Events' },
    },
    onValueCommitted: {
      action: 'valueCommitted',
      description:
        'Fires later, when the value settles — blur after typing, or pointer-up after scrubbing/pressing. This is the one to persist on.',
      table: { category: 'Events' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the Root wrapper (`inline-flex items-stretch`).',
      table: { category: 'Appearance' },
    },
  },
  args: {
    defaultValue: 5,
    min: 0,
    max: 100,
    step: 1,
    largeStep: 10,
    smallStep: 0.1,
    snapOnStep: false,
    format: { maximumFractionDigits: 2 },
    allowWheelScrub: false,
    disabled: false,
    readOnly: false,
    required: false,
    name: 'quantity',
    onValueChange: fn(),
    onValueCommitted: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof NumberField>;

export const Default: Story = {
  // key: `defaultValue` is read once per mount — remount so the control moves
  // the visible number instead of looking inert.
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="nf-quantity">Quantity</Label>
      <NumberField key={String(args.defaultValue)} id="nf-quantity" {...args}>
        <NumberFieldGroup>
          <NumberFieldDecrement>−</NumberFieldDecrement>
          {/* No aria-label here — the visible <Label htmlFor> is the
              accessible name, and an aria-label would silently override it. */}
          <NumberFieldInput />
          <NumberFieldIncrement>+</NumberFieldIncrement>
        </NumberFieldGroup>
      </NumberField>
    </div>
  ),
};

export const Bounded: Story = {
  parameters: {
    docs: { description: { story: 'Bounded between 0 and 100, with a step of 5.' } },
  },
  render: () => (
    <NumberField defaultValue={50} min={0} max={100} step={5}>
      <NumberFieldGroup>
        <NumberFieldDecrement>−</NumberFieldDecrement>
        <NumberFieldInput aria-label="Quantity" />
        <NumberFieldIncrement>+</NumberFieldIncrement>
      </NumberFieldGroup>
    </NumberField>
  ),
};

/**
 * `format` is an `Intl.NumberFormatOptions` bag, so currency and percent
 * presentation come free — the committed value stays a plain number, which is
 * what makes this safe to bind straight to state.
 */
export const Formatted: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-lg">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Price</span>
        <NumberField
          defaultValue={1499}
          step={100}
          format={{ style: 'currency', currency: 'USD' }}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement>−</NumberFieldDecrement>
            <NumberFieldInput aria-label="Price" className="w-28" />
            <NumberFieldIncrement>+</NumberFieldIncrement>
          </NumberFieldGroup>
        </NumberField>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Sample rate</span>
        <NumberField
          defaultValue={0.25}
          min={0}
          max={1}
          step={0.05}
          format={{ style: 'percent' }}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement>−</NumberFieldDecrement>
            <NumberFieldInput aria-label="Sample rate" className="w-24" />
            <NumberFieldIncrement>+</NumberFieldIncrement>
          </NumberFieldGroup>
        </NumberField>
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <NumberField defaultValue={5} disabled>
      <NumberFieldGroup>
        <NumberFieldDecrement>−</NumberFieldDecrement>
        <NumberFieldInput aria-label="Quantity" />
        <NumberFieldIncrement>+</NumberFieldIncrement>
      </NumberFieldGroup>
    </NumberField>
  ),
};

/**
 * Read-only. The value still submits and is still selectable — the difference
 * from `disabled`, which removes it from the form and from the tab order.
 */
export const ReadOnly: Story = {
  render: () => (
    <NumberField defaultValue={42} readOnly>
      <NumberFieldGroup>
        <NumberFieldDecrement>−</NumberFieldDecrement>
        <NumberFieldInput aria-label="Quantity" />
        <NumberFieldIncrement>+</NumberFieldIncrement>
      </NumberFieldGroup>
    </NumberField>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

/** Loading placeholder — the 36px grouped control. */
export const Loading: Story = {
  render: () => <Skeleton variant="number-field" />,
};
