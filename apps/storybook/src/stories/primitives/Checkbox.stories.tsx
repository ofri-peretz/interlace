import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from '@interlace/ui/checkbox';
import { withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta: Meta<typeof Checkbox> = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tri-state boolean control (checked / unchecked / indeterminate) for independent options the user can toggle in place — feature flags, opt-ins, a "select all" parent over a list. Use `RadioGroup` when the options are mutually exclusive and `Switch` when the change applies immediately with no submit step. Per `FORM_PHILOSOPHY.md` pair it with a `<label>` for the accessible name; the `Invalid` story shows the `aria-invalid` contract.',
      },
    },
  },
  // Root API comes from `@base-ui/react/checkbox`, which react-docgen cannot
  // follow through the package boundary — declared by hand.
  argTypes: {
    defaultChecked: {
      control: 'boolean',
      description:
        'Uncontrolled initial tick state. Read once on mount; the box stays user-toggleable.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    checked: {
      control: false,
      description:
        'Controlled tick state. Supply together with `onCheckedChange` — on its own it freezes the box.',
      table: { category: 'State' },
    },
    indeterminate: {
      control: 'boolean',
      description:
        'Mixed state — renders the minus glyph and exposes `aria-checked="mixed"`. For a parent whose children are partly selected.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    disabled: {
      control: 'boolean',
      description:
        'Ignore interaction and drop to 50% opacity (exempt from SC 1.4.11).',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    readOnly: {
      control: 'boolean',
      description:
        'Visible and focusable but not togglable — use for a value the user may read but not change in this context.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    required: {
      control: 'boolean',
      description: 'The form cannot submit until the box is ticked.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    'aria-invalid': {
      control: 'boolean',
      description:
        'Failed validation — recolours the border and focus ring to `destructive`. Pair with `aria-describedby` pointing at the error text.',
      table: { category: 'State' },
    },
    'aria-label': {
      control: 'text',
      description:
        'Accessible name on the `role="checkbox"` node itself. Needed because Base UI keeps its own id on the hidden input, so `<Label htmlFor>` does not reach the role node.',
      table: { category: 'Accessibility' },
    },
    name: {
      control: 'text',
      description: 'Field name in the submitted form data.',
      table: { category: 'Data' },
    },
    value: {
      control: 'text',
      description: 'Value submitted when the box is ticked.',
      table: { category: 'Data' },
    },
    onCheckedChange: {
      action: 'checkedChange',
      description:
        'Fires with the next boolean state plus an event-details object.',
      table: { category: 'Events' },
    },
    className: {
      control: 'text',
      description:
        'The painted box is 16px with a transparent 24×24 hit area (SC 2.5.8) — override with care; shrinking it breaks the target-size floor.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

// Base UI's Checkbox renders its own internal id on the role="checkbox" span,
// so `<Label htmlFor>` doesn't reach the interactive element. Wrap in a
// native `<label>` (DOM-nested association) and add `aria-label` as the
// accessible-name source axe can detect on the role node itself.
export const Default: Story = {
  args: {
    'aria-label': 'Include type-aware rules',
    defaultChecked: true,
    indeterminate: false,
    disabled: false,
    readOnly: false,
    required: false,
  },
  // Shown as the settings row it ships in — a bare 16px box in a wide canvas
  // hides the label pairing that makes it accessible.
  render: (args) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox {...args} />
      <span>Include type-aware rules</span>
    </label>
  ),
};
export const Disabled: Story = {
  render: () => (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox aria-label="Type-aware (disabled)" disabled />
      <span>Type-aware (disabled)</span>
    </label>
  ),
};

export const Invalid: Story = {
  render: () => (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox
        aria-label="Accept terms (required)"
        aria-invalid="true"
        aria-describedby="terms-err"
      />
      <span>Accept terms</span>
      <span id="terms-err" className="text-destructive text-xs ml-2">
        Required
      </span>
    </label>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  render: () => (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox aria-label="تضمين القواعد المدركة للنوع" defaultChecked />
      <span>تضمين القواعد المدركة للنوع</span>
    </label>
  ),
  decorators: [withRtl],
};

/**
 * Indeterminate — the third state, exposed as `aria-checked="mixed"` by
 * Base UI. Used for a parent checkbox whose children are partly selected.
 */
export const Indeterminate: Story = {
  render: () => (
    <label className="flex cursor-pointer items-center gap-2">
      <Checkbox aria-label="Select all rules" indeterminate />
      <span>Select all rules</span>
    </label>
  ),
};

/** Loading placeholder — the 16px box. */
export const Loading: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Skeleton variant="checkbox" />
      <Skeleton variant="label" />
    </div>
  ),
};
