import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Label } from '@interlace/ui/label';
import { Input } from '@interlace/ui/input';
import { withDark, withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta: Meta<typeof Label> = {
  title: 'Primitives/Label',
  component: Label,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The accessible name of a form control, rendered as a native `<label>`. It owns no state of its own — the dimming in a disabled row comes from reading the control\'s state through `peer-disabled:` / `group-data-[disabled]`, which is why the control carries `peer`. Use it whenever you wire a control by hand; reach for Base UI `Field.Label` (see `Form`) instead when the field should also own error text and validation state.',
      },
    },
  },
  argTypes: {
    children: {
      control: 'text',
      description:
        'The label text. Keep it a noun phrase — it is what a screen reader announces when focus lands on the control.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    htmlFor: {
      control: 'text',
      description:
        'The `id` of the control this labels. Without it a click on the text does not focus the control and the control has no accessible name (`FORM_PHILOSOPHY.md`).',
      table: { category: 'Behaviour' },
    },
    className: {
      control: 'text',
      description:
        'Merged via `cn()`. The base is a `flex … gap-2` row, so an icon or a required marker can sit beside the text without extra wrappers.',
      table: { category: 'Appearance' },
    },
    onClick: {
      action: 'click',
      description:
        'Native click. Fires in addition to the browser forwarding the activation to the labelled control.',
      table: { category: 'Events' },
    },
  },
  args: {
    children: 'Email',
    htmlFor: 'email',
    className: '',
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  render: (args) => (
    <div className="flex w-[260px] max-w-full flex-col gap-2">
      <Label {...args} />
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

/**
 * The `flex … gap-2` base is the point: a required marker, a hint, or an icon
 * composes into the label row without a wrapper element that would break the
 * `<label>` → control association.
 */
export const WithMarker: Story = {
  render: () => (
    <div className="flex w-[260px] max-w-full flex-col gap-2">
      <Label htmlFor="email-req">
        Email
        <span aria-hidden className="text-destructive">
          *
        </span>
        <span className="sr-only">(required)</span>
      </Label>
      <Input id="email-req" type="email" required placeholder="you@example.com" />
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  render: () => (
    <div className="flex w-[260px] max-w-full flex-col gap-2">
      <Label htmlFor="email-rtl">البريد الإلكتروني</Label>
      <Input id="email-rtl" type="email" placeholder="you@example.com" />
    </div>
  ),
  decorators: [withRtl],
};

/**
 * Disabled pairing. The label dims via `peer-disabled:` — it reads the
 * DISABLED CONTROL's state rather than owning a disabled prop of its own,
 * which is why the input carries `peer`. Contrast is exempt here: SC
 * 1.4.3 carves out inactive user-interface components.
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex w-[260px] max-w-full flex-col gap-2">
      <Input
        id="email-disabled"
        type="email"
        placeholder="you@example.com"
        className="peer order-2"
        disabled
      />
      <Label htmlFor="email-disabled" className="order-1">
        Email
      </Label>
    </div>
  ),
};

/** Loading placeholder. */
export const Loading: Story = {
  render: () => (
    <div className="flex w-[260px] max-w-full flex-col gap-2">
      <Skeleton variant="label" />
      <Skeleton variant="input" />
    </div>
  ),
};
