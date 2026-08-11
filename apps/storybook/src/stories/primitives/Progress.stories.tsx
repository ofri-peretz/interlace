import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
  MIN_VIEWPORT,
} from '@interlace/ui/progress';
import { withRtl } from '@/decorators';

/**
 * `size` lives on `ProgressTrack` and `tone` on `ProgressIndicator` — the two
 * axes are orthogonal and belong to different parts. They ride along in the
 * story args (with `label` / `showValue` for the optional text parts) so the
 * whole compound is drivable from one Controls panel.
 */
type ProgressStoryArgs = React.ComponentProps<typeof Progress> & {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'success' | 'warning' | 'danger';
  label?: string;
  showValue?: boolean;
};

const meta: Meta<ProgressStoryArgs> = {
  title: 'Primitives/Progress',
  component: Progress,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Determinate progress rail for work whose completion is measurable — an upload, a multi-step form, a quota. Composed rather than monolithic: the root owns the value and the `role="progressbar"` ARIA, `ProgressTrack` owns the rail height, `ProgressIndicator` owns the fill tone, and `ProgressLabel` / `ProgressValue` are optional text parts. Pass `value={null}` for work of unknown length (the bar goes indeterminate), and reach for `Skeleton` instead when the thing being waited on is content, not a task.',
      },
    },
  },
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description:
        'Current progress, between `min` and `max`. `null` switches the bar to indeterminate — the root reports no `aria-valuenow` and the status becomes `indeterminate`.',
      table: { type: { summary: 'number | null' }, category: 'Data' },
    },
    min: {
      control: 'number',
      description: 'Lower bound of the scale.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' }, category: 'Data' },
    },
    max: {
      control: 'number',
      description: 'Upper bound of the scale — set it to the real total (e.g. bytes, steps) instead of pre-normalising to 100.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '100' }, category: 'Data' },
    },
    format: {
      control: 'object',
      description:
        '`Intl.NumberFormatOptions` used by `ProgressValue`. Defaults to a percentage; pass e.g. `{ style: "unit", unit: "megabyte" }` to read out the real quantity.',
      table: { type: { summary: 'Intl.NumberFormatOptions' }, category: 'Data' },
    },
    locale: {
      control: 'text',
      description: 'Locale for that formatter. Defaults to the runtime locale.',
      table: { type: { summary: 'Intl.LocalesArgument' }, category: 'Data' },
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
      description: 'Rail height on `ProgressTrack` — `sm` 4px, `md` 8px, `lg` 12px.',
      table: {
        type: { summary: "'sm' | 'md' | 'lg'" },
        defaultValue: { summary: 'md' },
        category: 'Appearance',
      },
    },
    tone: {
      control: 'inline-radio',
      options: ['default', 'success', 'warning', 'danger'],
      description:
        'Fill colour on `ProgressIndicator`. Semantic, not decorative: `danger` should mean the task is failing, not that the bar is nearly empty.',
      table: {
        type: { summary: "'default' | 'success' | 'warning' | 'danger'" },
        defaultValue: { summary: 'default' },
        category: 'Appearance',
      },
    },
    label: {
      control: 'text',
      description:
        'Text for the optional `ProgressLabel` part. Base UI wires it to the root as the accessible name — clear it and this story falls back to an `aria-label`, because a progressbar with no name is an axe failure.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    showValue: {
      control: 'boolean',
      description:
        'Render the optional `ProgressValue` part, which prints the formatted value ("66%") next to the label.',
      table: { type: { summary: 'boolean' }, category: 'Slots' },
    },
    getAriaValueText: {
      control: false,
      description:
        'Override the spoken value text — e.g. "step 3 of 5" instead of "60%". Prefer this over hand-writing `aria-valuetext`.',
      table: { type: { summary: '(formattedValue, value) => string' }, category: 'Data' },
    },
  },
};

export default meta;
type Story = StoryObj<ProgressStoryArgs>;

const SIZES = ['sm', 'md', 'lg'] as const;
const TONES = ['default', 'success', 'warning', 'danger'] as const;

export const Default: Story = {
  args: {
    value: 66,
    min: 0,
    max: 100,
    size: 'md',
    tone: 'default',
    label: 'Uploading…',
    showValue: true,
  },
  render: ({ size, tone, label, showValue, ...args }) => (
    <div className="w-[320px] max-w-full">
      <Progress aria-label={label ? undefined : 'Upload progress'} {...args}>
        {(label || showValue) && (
          <div className="mb-2 flex items-center justify-between">
            {label ? <ProgressLabel>{label}</ProgressLabel> : <span />}
            {showValue ? <ProgressValue /> : null}
          </div>
        )}
        <ProgressTrack size={size}>
          <ProgressIndicator tone={tone} />
        </ProgressTrack>
      </Progress>
    </div>
  ),
};

// Grid: size (rows) × tone (cols). One slow-paced sample value per row so the
// reader's eye walks the tone palette without numeric noise.
export const Variants: Story = {
  render: () => (
    <div className="w-[640px] max-w-full">
      <div
        className="grid items-center gap-x-6 gap-y-4"
        style={{ gridTemplateColumns: 'auto repeat(4, minmax(0, 1fr))' }}
      >
        <div />
        {TONES.map((tone) => (
          <div
            key={tone}
            className="text-muted-foreground text-xs font-mono uppercase"
          >
            {tone}
          </div>
        ))}
        {SIZES.map((size, rowIdx) => {
          // Spread sample values across rows so each cell isn't identical:
          // sm=25, md=50, lg=75.
          const value = 25 + rowIdx * 25;
          return (
            <SizeRow key={size} size={size} value={value} />
          );
        })}
      </div>
    </div>
  ),
};

function SizeRow({
  size,
  value,
}: {
  size: (typeof SIZES)[number];
  value: number;
}) {
  return (
    <>
      <div className="text-muted-foreground text-xs font-mono uppercase">
        {size}
      </div>
      {TONES.map((tone) => (
        <Progress
          key={`${size}-${tone}`}
          value={value}
          aria-label={`Progress ${size} ${tone} at ${value}%`}
        >
          <ProgressTrack size={size}>
            <ProgressIndicator tone={tone} />
          </ProgressTrack>
        </Progress>
      ))}
    </>
  );
}

/**
 * Indeterminate — `value={null}` for work whose length isn't known yet. The
 * root drops `aria-valuenow` and reports `data-status="indeterminate"`; the
 * rail stays at its resting tone rather than lying about a percentage.
 */
export const Indeterminate: Story = {
  ...Default,
  args: {
    value: null,
    size: 'md',
    tone: 'default',
    label: 'Contacting registry…',
    showValue: false,
  },
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a 319px container with the
 * `data-interlace-dev` flag so preflight's dashed warning outline appears.
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <Progress value={66} aria-label="Below-min-viewport demo progress">
        <div className="mb-2 flex items-center justify-between">
          <ProgressLabel>{`< ${MIN_VIEWPORT}px — dev outline`}</ProgressLabel>
          <ProgressValue />
        </div>
        <ProgressTrack size="md">
          <ProgressIndicator tone="default" />
        </ProgressTrack>
      </Progress>
    </div>
  ),
  decorators: [
    (Story) => (
      // Promote the body flag for this story so the preflight selector matches.
      <div
        ref={(node) => {
          if (node && typeof document !== 'undefined') {
            document.body.setAttribute('data-interlace-dev', '');
          }
        }}
      >
        <Story />
      </div>
    ),
  ],
};
