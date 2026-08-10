import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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
          'Single-line text entry. A styling-only wrapper over `<input>` — it owns the surface, the focus ring and the `aria-invalid` ring, and delegates value, selection, IME and `onChange` to the native element, so there is no controlled-state machinery to fight. Reach for it for any one-line value; use `Textarea` for multi-line, `NumberField` when the value needs steppers, and `Form`/`Field` when you want Base UI to own label + error wiring instead of pairing a `Label` by hand.',
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: [
        'text',
        'email',
        'password',
        'search',
        'url',
        'tel',
        'number',
        'date',
        'file',
      ],
      description:
        'Native input type. Drives the on-screen keyboard on mobile and the browser-native validation/UI (date picker, file picker, reveal button).',
      table: {
        category: 'Appearance',
        type: { summary: "'text' | 'email' | 'password' | 'search' | …" },
        defaultValue: { summary: 'text' },
      },
    },
    placeholder: {
      control: 'text',
      description:
        'Hint text shown while empty. Never a substitute for a `Label` — it disappears on first keystroke.',
      table: { category: 'Appearance' },
    },
    defaultValue: {
      control: 'text',
      description:
        'Uncontrolled initial value. The story remounts on change so the control is observable.',
      table: { category: 'Appearance' },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the base classes via `cn()` — the width seam. The primitive is `w-full`, so the consumer sizes it.',
      table: { category: 'Appearance' },
    },
    disabled: {
      control: 'boolean',
      description:
        'Native disabled. Drops pointer events and applies `opacity-50` (SC 1.4.3 exempts inactive components from the contrast floor).',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    readOnly: {
      control: 'boolean',
      description:
        'Value is selectable and submitted, but not editable. Prefer over `disabled` when the value still matters to the form.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    required: {
      control: 'boolean',
      description: 'Native constraint validation + `aria-required` semantics.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    'aria-invalid': {
      control: 'boolean',
      description:
        'Switches the ring and border to the destructive token. Pair with `aria-describedby` pointing at the error text — see the `Invalid` story.',
      table: { category: 'State' },
    },
    name: {
      control: 'text',
      description: 'Form field name used on submit.',
      table: { category: 'Form' },
    },
    autoComplete: {
      control: 'text',
      description:
        'Autofill token (`email`, `username`, `current-password`, `off`, …). Filling this in is the cheapest UX win on any sign-in form.',
      table: { category: 'Form' },
    },
    maxLength: {
      control: 'number',
      description: 'Hard character cap enforced by the browser.',
      table: { category: 'Form' },
    },
    onChange: {
      action: 'change',
      description: 'Native change event — fires per keystroke.',
      table: { category: 'Events' },
    },
    onFocus: { action: 'focus', table: { category: 'Events' } },
    onBlur: { action: 'blur', table: { category: 'Events' } },
    // Not a controllable seam: the id is wired to the demo `<Label htmlFor>`.
    id: { table: { disable: true } },
  },
  args: {
    type: 'search',
    placeholder: 'JWT, SQL, prototype pollution…',
    defaultValue: '',
    className: 'w-full',
    disabled: false,
    readOnly: false,
    required: false,
    'aria-invalid': false,
    name: 'q',
    autoComplete: 'off',
    onChange: fn(),
    onFocus: fn(),
    onBlur: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => (
    <div className="flex w-[320px] max-w-full flex-col gap-2">
      <Label htmlFor="search">Search articles</Label>
      {/* key: `defaultValue` is read once per mount, so remount when it changes
          or the Controls entry would look inert. */}
      <Input key={String(args.defaultValue)} id="search" {...args} />
    </div>
  ),
};
export const Disabled: Story = {
  render: () => (
    <div className="flex w-[320px] max-w-full flex-col gap-2">
      <Label htmlFor="search-d">Search</Label>
      <Input id="search-d" placeholder="Disabled" disabled />
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="flex w-[320px] max-w-full flex-col gap-2">
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

/**
 * The types worth seeing side by side — each one changes the mobile keyboard
 * and the browser-native affordance, not just the validation rule.
 */
export const Types: Story = {
  render: () => (
    <div className="grid w-[440px] max-w-full grid-cols-1 gap-4">
      {(
        [
          ['text', 'Full name', 'Ada Lovelace'],
          ['email', 'Email', 'you@example.com'],
          ['password', 'Password', '••••••••'],
          ['search', 'Search', 'prototype pollution'],
          ['url', 'Website', 'https://interlace.tools'],
          ['date', 'Published', ''],
        ] as const
      ).map(([type, label, placeholder]) => (
        <div key={type} className="flex flex-col gap-2">
          <Label htmlFor={`type-${type}`}>
            {label} <code className="text-muted-foreground">type=&quot;{type}&quot;</code>
          </Label>
          <Input id={`type-${type}`} type={type} placeholder={placeholder} />
        </div>
      ))}
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  render: () => (
    <div className="flex w-[320px] max-w-full flex-col gap-2">
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
      className="w-[260px] max-w-full"
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
    <div className="w-[260px] max-w-full">
      <Skeleton variant="input" />
    </div>
  ),
};
