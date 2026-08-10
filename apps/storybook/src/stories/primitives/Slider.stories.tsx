import type * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from '@interlace/ui/slider';
import { Skeleton } from '@interlace/ui/skeleton';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Slider> = {
  title: 'Primitives/Slider',
  component: Slider,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Value picker for a bounded numeric range where the approximate position matters more than the exact digits — volume, thresholds, opacity. Use a NumberField when the user needs to type a precise value. Compositional: `Slider` (root) owns the value, `SliderControl` → `SliderTrack` → `SliderIndicator` paint the rail, and one `SliderThumb` per handle. Keyboard (Arrow / Home / End / PageUp / PageDown), drag, focus-visible and ARIA all come from Base UI.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'object',
      description:
        'Controlled value, always an array (one entry per thumb). The stories below feed this control back through `onValueChange`, so dragging the knob updates the control and vice-versa.',
      table: { category: 'State', type: { summary: 'readonly number[]' } },
    },
    defaultValue: {
      control: false,
      description:
        'Uncontrolled initial value — read once on mount. Use `value` above to drive the slider from the Controls panel.',
      table: { category: 'State', type: { summary: 'readonly number[]' } },
    },
    min: {
      control: 'number',
      description: 'Lowest selectable value. Must not equal `max`.',
      table: {
        category: 'Range',
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
      },
    },
    max: {
      control: 'number',
      description: 'Highest selectable value. Must not equal `min`.',
      table: {
        category: 'Range',
        type: { summary: 'number' },
        defaultValue: { summary: '100' },
      },
    },
    step: {
      control: { type: 'number', min: 0.1, step: 0.1 },
      description:
        'Snap increment, anchored at `min`. Keep `(max - min)` evenly divisible by it.',
      table: {
        category: 'Range',
        type: { summary: 'number' },
        defaultValue: { summary: '1' },
      },
    },
    largeStep: {
      control: 'number',
      description: 'Increment for PageUp / PageDown and Shift + Arrow.',
      table: {
        category: 'Range',
        type: { summary: 'number' },
        defaultValue: { summary: '10' },
      },
    },
    minStepsBetweenValues: {
      control: 'number',
      description:
        'For range sliders — how many steps must separate two thumbs. `0` lets them meet.',
      table: {
        category: 'Range',
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
      },
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description:
        'Layout flow. `vertical` also remaps the arrow keys; give the control an explicit height.',
      table: {
        category: 'Appearance',
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: "'horizontal'" },
      },
    },
    thumbAlignment: {
      control: 'select',
      options: ['center', 'edge', 'edge-client-only'],
      description:
        'How the knob sits at `min` / `max` — centred on the rail edge, or inset so its own edge lines up.',
      table: {
        category: 'Appearance',
        type: { summary: "'center' | 'edge' | 'edge-client-only'" },
        defaultValue: { summary: "'center'" },
      },
    },
    thumbCollisionBehavior: {
      control: 'select',
      options: ['push', 'swap', 'none'],
      description:
        'What two thumbs do when dragged into each other. Only observable on the Range story.',
      table: {
        category: 'Appearance',
        type: { summary: "'push' | 'swap' | 'none'" },
        defaultValue: { summary: "'push'" },
      },
    },
    disabled: {
      control: 'boolean',
      description:
        'Ignore user interaction. Paints at 50% opacity — exempt from SC 1.4.11 as an inactive component.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    name: {
      control: 'text',
      description: 'Identifies the field when a form is submitted.',
      table: { category: 'Form', type: { summary: 'string' } },
    },
    onValueChange: {
      action: 'valueChange',
      description: 'Fires continuously while the value moves.',
      table: {
        category: 'Events',
        type: { summary: '(value, details) => void' },
      },
    },
    onValueCommitted: {
      action: 'valueCommitted',
      description:
        'Fires once the interaction settles (pointer up / key release) — the one to hang an expensive request off.',
      table: {
        category: 'Events',
        type: { summary: '(value, details) => void' },
      },
    },
    children: {
      control: false,
      description:
        'The parts: `SliderControl` → `SliderTrack` → `SliderIndicator`, plus one `SliderThumb` per handle.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the root. This is where the slider gets its width.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    min: 0,
    max: 100,
    step: 1,
    largeStep: 10,
    disabled: false,
    orientation: 'horizontal',
    className: 'w-64 max-w-full',
    onValueChange: fn(),
    onValueCommitted: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

/**
 * Shared body for the args-driven stories: closes the controlled loop so the
 * `value` control and the knob drive each other, and renders a live readout
 * (a slider without one makes the reader guess what they just selected).
 */
function ControlledSlider({
  args,
  label,
  updateArgs,
}: {
  args: React.ComponentProps<typeof Slider>;
  label: string;
  updateArgs: (next: { value: readonly number[] }) => void;
}) {
  const values = (args.value as readonly number[] | undefined) ?? [];
  return (
    <div className="flex w-72 max-w-full flex-col gap-xs">
      <div className="flex items-baseline justify-between">
        <span className="text-ui-sm font-medium">{label}</span>
        <span className="text-ui-sm font-mono text-muted-foreground">
          {values.join(' – ')}
        </span>
      </div>
      <Slider
        {...args}
        aria-label={label}
        onValueChange={(value, details) => {
          args.onValueChange?.(value, details);
          updateArgs({ value: value as readonly number[] });
        }}
      >
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
          </SliderTrack>
          {values.map((_, i) => (
            <SliderThumb
              key={i}
              getAriaLabel={() =>
                values.length > 1
                  ? `${label} ${i === 0 ? 'minimum' : 'maximum'}`
                  : label
              }
            />
          ))}
        </SliderControl>
      </Slider>
    </div>
  );
}

export const Default: Story = {
  args: { value: [50] },
  render: function DefaultSlider(args) {
    const [, updateArgs] = useArgs();
    return (
      <ControlledSlider
        args={args}
        label="Confidence threshold"
        updateArgs={updateArgs}
      />
    );
  },
};

export const Range: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Two-thumb range — pass a two-entry `value` (or `defaultValue`) tuple and render one `SliderThumb` per entry. `minStepsBetweenValues` and `thumbCollisionBehavior` govern what happens when the two meet.',
      },
    },
  },
  args: { value: [20, 70] },
  render: function RangeSlider(args) {
    const [, updateArgs] = useArgs();
    return (
      <ControlledSlider args={args} label="Severity range" updateArgs={updateArgs} />
    );
  },
};

export const Stepped: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Stepped values — `step={10}` snaps to 0/10/20/…/100, and the readout shows the snap happening as you drag.',
      },
    },
  },
  args: { value: [40], step: 10 },
  render: function SteppedSlider(args) {
    const [, updateArgs] = useArgs();
    return (
      <ControlledSlider args={args} label="Sampling rate" updateArgs={updateArgs} />
    );
  },
};

export const Disabled: Story = {
  args: { value: [40], disabled: true },
  render: function DisabledSlider(args) {
    const [, updateArgs] = useArgs();
    return (
      <ControlledSlider args={args} label="Disabled slider" updateArgs={updateArgs} />
    );
  },
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

/** Loading placeholder — the 8px rail. */
export const Loading: Story = {
  render: () => (
    <div className="w-[260px] max-w-full">
      <Skeleton variant="slider" />
    </div>
  ),
};
