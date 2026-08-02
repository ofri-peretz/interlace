import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Input } from '@interlace/ui/input';
import { Label } from '@interlace/ui/label';
import { withDark, withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Single-line text input. Pair with `<Label htmlFor>` for accessible name per `FORM_PHILOSOPHY.md`. Supports `aria-invalid` for error state (see `Invalid` story).',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: () => (
    <div className="flex w-[320px] flex-col gap-2">
      <Label htmlFor="search">Search articles</Label>
      <Input id="search" placeholder="JWT, SQL, prototype pollution…" />
    </div>
  ),
};
export const Disabled: Story = {
  render: () => (
    <div className="flex w-[320px] flex-col gap-2">
      <Label htmlFor="search-d">Search</Label>
      <Input id="search-d" placeholder="Disabled" disabled />
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="flex w-[320px] flex-col gap-2">
      <Label htmlFor="search-inv">Search</Label>
      <Input
        id="search-inv"
        placeholder="Reaches the destructive ring"
        aria-invalid="true"
        aria-describedby="search-inv-err"
      />
      <span id="search-inv-err" className="text-destructive text-xs">
        Query cannot be empty.
      </span>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  render: () => (
    <div className="flex w-[320px] flex-col gap-2">
      <Label htmlFor="search-rtl">بحث المقالات</Label>
      <Input id="search-rtl" placeholder="JWT, SQL, تلوث النموذج الأولي…" />
    </div>
  ),
  decorators: [withRtl],
};

/**
 * Focus ring. SC 2.4.13 wants ≥3:1 against adjacent colours; the DS ring
 * is `ring-ring/60` (3.23:1 light / 4.73:1 dark) — /50 measured 2.57:1
 * on white and did NOT clear the floor. The play function drives real
 * keyboard focus so the ring is painted in the CI screenshot + axe run.
 */
export const Focused: Story = {
  render: () => (
    <Input
      aria-label="Focus ring demo"
      placeholder="Tab to me"
      className="w-[260px]"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.tab();
    await expect(input).toHaveFocus();
  },
};

/** Loading placeholder — reserves the exact 36px control height (CLS=0). */
export const Loading: Story = {
  render: () => (
    <div className="w-[260px]">
      <Skeleton variant="input" />
    </div>
  ),
};
