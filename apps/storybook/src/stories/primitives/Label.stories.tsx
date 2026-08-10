import type { Meta, StoryObj } from '@storybook/react-vite';
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
          'Form-control label — shadcn-canon lower-level alternative to Base UI `Field.Label`. Always pair via `htmlFor` per `FORM_PHILOSOPHY.md` so a click on the label focuses the control.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  render: () => (
    <div className="flex w-[260px] max-w-full flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
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
