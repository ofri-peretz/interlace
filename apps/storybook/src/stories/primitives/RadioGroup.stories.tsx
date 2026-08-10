import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RadioGroup, RadioGroupItem } from '@interlace/ui/radio-group';
import { withDark, withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta: Meta<typeof RadioGroup> = {
  title: 'Primitives/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Single-select over a small set of mutually exclusive options, where every option should stay visible — filter facets, plan tiers, a two-or-three-way preference. Base UI owns `role="radiogroup"`, the roving tabindex and arrow-key wrapping; this wrapper only adds the `grid gap-2` pitch and the 24×24 hit area. Past ~6 options (or when the choices are unknown at build time) reach for `Select` instead, and for independent on/off choices use `Checkbox`.',
      },
    },
  },
  argTypes: {
    defaultValue: {
      control: 'text',
      description:
        'Initially checked item, matched against each `RadioGroupItem`\'s `value`. Uncontrolled — this story remounts the group when the control changes so the new default takes effect.',
      table: { type: { summary: 'Value' }, category: 'Data' },
    },
    value: {
      control: false,
      description:
        'Controlled selection. Pair with `onValueChange` and own the state yourself; leave unset (as these stories do) to let Base UI hold it.',
      table: { type: { summary: 'Value' }, category: 'Data' },
    },
    name: {
      control: 'text',
      description:
        'Form field name. Projected onto the hidden input so a native `<form>` submit carries the value.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    'aria-label': {
      control: 'text',
      description:
        'Accessible name for the group itself. Required unless an external `<label>`/heading is wired via `aria-labelledby` — a `role="radio"` whose container has no name is an axe failure.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    disabled: {
      control: 'boolean',
      description: 'Ignore all interaction; every item inherits the state from the root.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    readOnly: {
      control: 'boolean',
      description:
        'Selection is visible and focusable but cannot be changed. Unlike `disabled`, the value still submits with the form.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    required: {
      control: 'boolean',
      description: 'A value must be chosen before the owning form can submit.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    onValueChange: {
      control: false,
      description: 'Fired with the newly selected value plus Base UI event details.',
      table: { type: { summary: '(value, eventDetails) => void' }, category: 'Events' },
    },
    children: {
      control: false,
      description:
        'The `RadioGroupItem`s. Options are composed as children rather than passed as an `options` array so each row can carry its own label, hint, or icon.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    className: {
      control: 'text',
      description:
        'Merged after `grid gap-2` — the seam for a different pitch or a horizontal layout (`flex gap-6`).',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
  args: {
    onValueChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

const READING_TIME_OPTIONS = [
  { value: 'short', label: '< 5 min', a11y: 'Less than 5 min' },
  { value: 'medium', label: '5–10 min', a11y: '5 to 10 min' },
  { value: 'long', label: '10+ min', a11y: '10 min or more' },
];

// Base UI's RadioGroupItem renders its own internal id on the role="radio"
// span, so `<Label htmlFor>` doesn't reach the interactive element. Wrap
// each item in a native `<label>` (DOM-nested association) and add
// `aria-label` as the accessible-name source axe detects on the role node.
// Also: the group itself gets `aria-label` so the radio's container has
// the WAI-ARIA group label axe expects for `role=radio` descendants.
export const Default: Story = {
  args: {
    defaultValue: 'short',
    'aria-label': 'Reading time',
    name: 'reading-time',
    disabled: false,
    readOnly: false,
    required: false,
  },
  // Shown as the filter field it actually is, rather than three bare dots:
  // the field label above the group is what a real form renders.
  render: (args) => (
    <div className="w-[280px] max-w-full">
      <p className="text-foreground mb-2 text-sm font-medium">Reading time</p>
      {/* Remount on defaultValue change — an uncontrolled group ignores a
          new defaultValue on re-render, so the control would look inert. */}
      <RadioGroup key={String(args.defaultValue)} {...args}>
        {READING_TIME_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2"
          >
            <RadioGroupItem value={option.value} aria-label={option.a11y} />
            <span>{option.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <RadioGroup
      aria-label="Plan tier"
      aria-invalid="true"
      aria-describedby="plan-err"
      className="flex flex-col gap-2"
    >
      <label className="flex items-center gap-2 cursor-pointer">
        <RadioGroupItem value="free" aria-label="Free" />
        <span>Free</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <RadioGroupItem value="pro" aria-label="Pro" />
        <span>Pro</span>
      </label>
      <span id="plan-err" className="text-destructive text-xs">
        Pick a plan to continue.
      </span>
    </RadioGroup>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  render: () => (
    <RadioGroup
      defaultValue="short"
      aria-label="وقت القراءة"
      className="flex flex-col gap-2"
    >
      <label className="flex items-center gap-2 cursor-pointer">
        <RadioGroupItem value="short" aria-label="أقل من 5 دقائق" />
        <span>أقل من 5 دقائق</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <RadioGroupItem value="medium" aria-label="من 5 إلى 10 دقائق" />
        <span>5–10 دقائق</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <RadioGroupItem value="long" aria-label="10 دقائق أو أكثر" />
        <span>10+ دقائق</span>
      </label>
    </RadioGroup>
  ),
  decorators: [withRtl],
};

/** Disabled group — every item inherits the state from the root. */
export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="recommended" disabled aria-label="Preset">
      {['recommended', 'strict'].map((value) => (
        <label key={value} className="flex cursor-not-allowed items-center gap-2">
          <RadioGroupItem value={value} aria-label={value} />
          <span className="capitalize">{value}</span>
        </label>
      ))}
    </RadioGroup>
  ),
};

/**
 * Read-only group — the choice stays visible and focusable but cannot be
 * changed, and (unlike `disabled`) it still submits with the form.
 */
export const ReadOnly: Story = {
  render: () => (
    <RadioGroup defaultValue="strict" readOnly aria-label="Locked preset">
      {['recommended', 'strict'].map((value) => (
        <label key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} aria-label={value} />
          <span className="capitalize">{value}</span>
        </label>
      ))}
    </RadioGroup>
  ),
};

/** Loading placeholder — three option rows at the group's own gap-2 pitch. */
export const Loading: Story = {
  render: () => (
    <div className="w-[260px] max-w-full">
      <Skeleton variant="radio-group" />
    </div>
  ),
};
