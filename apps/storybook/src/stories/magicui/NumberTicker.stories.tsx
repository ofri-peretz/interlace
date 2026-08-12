import { NumberTicker } from '@interlace/ui/magicui/number-ticker';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * NumberTicker stories
 *
 * `startValue` defaults to `value` itself — no animation, an honest number on
 * first paint. Count-up is opt-in by passing an explicit lower `startValue`.
 * That default matters for stat rows on a landing page: a number that reads
 * `0` before JS settles looks broken, not delightful.
 *
 * The component renders a bare `<span>`, so every story below places it in
 * the label + number + caption context it actually ships in.
 */

const Stat = ({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) => (
  <div className="flex w-64 flex-col gap-1 rounded-lg border border-border bg-background p-4">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className="text-3xl font-semibold text-foreground">{children}</span>
    {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
  </div>
);

const meta: Meta<typeof NumberTicker> = {
  title: 'MagicUI/NumberTicker',
  component: NumberTicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A count-up (or count-down) span for stat cards and dashboards. Runs on ' +
          '`requestAnimationFrame` with an ease-out-expo curve, triggered by an ' +
          '`IntersectionObserver` the first time it scrolls into view — no ' +
          'motion/react dependency. `prefers-reduced-motion` skips straight to the ' +
          'final formatted value.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'number',
      description: 'The target number.',
      table: { type: { summary: 'number' }, category: 'Data' },
    },
    startValue: {
      control: 'number',
      description:
        'Where the count starts. Defaults to `value` (no animation). Pass an explicit lower number to opt into the count-up.',
      table: { type: { summary: 'number' }, defaultValue: { summary: 'value' }, category: 'Data' },
    },
    direction: {
      control: 'inline-radio',
      options: ['up', 'down'],
      description: 'Count up toward `value`, or down from `value` toward `startValue`.',
      table: { type: { summary: "'up' | 'down'" }, defaultValue: { summary: 'up' }, category: 'Behavior' },
    },
    decimalPlaces: {
      control: { type: 'number', min: 0, max: 4 },
      description: 'Fraction digits to keep, formatted with `Intl.NumberFormat`.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' }, category: 'Appearance' },
    },
    notation: {
      control: 'inline-radio',
      options: ['standard', 'compact', 'scientific', 'engineering'],
      description:
        '`Intl.NumberFormat` notation, forwarded verbatim. `compact` turns `128,400` into `128K` — eight tabular glyphs down to four, which is the difference between fitting and wrapping in a stat tile at the 320px floor.',
      table: {
        type: { summary: "'standard' | 'compact' | 'scientific' | 'engineering'" },
        defaultValue: { summary: 'standard' },
        category: 'Appearance',
      },
    },
    duration: {
      control: { type: 'number', min: 200, max: 4000, step: 100 },
      description: 'Animation length in milliseconds.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1500' }, category: 'Behavior' },
    },
    delay: {
      control: { type: 'number', min: 0, max: 3, step: 0.1 },
      description: 'Seconds to wait, after entering view, before the count starts.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' }, category: 'Behavior' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the span — the seam for size and colour.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NumberTicker>;

export const Default: Story = {
  args: {
    value: 12480,
    startValue: 0,
    decimalPlaces: 0,
  },
  render: (args) => (
    <Stat label="npm weekly downloads" caption="+12% vs last week">
      <NumberTicker {...args} />
    </Stat>
  ),
};

export const NoAnimation: Story = {
  name: 'No startValue — honest static render',
  args: { value: 409 },
  render: (args) => (
    <Stat label="lint rules shipped" caption="no count-up: startValue was not set">
      <NumberTicker {...args} />
    </Stat>
  ),
};

export const CountDown: Story = {
  name: 'direction="down"',
  args: { value: 0, startValue: 100, direction: 'down' },
  render: (args) => (
    <Stat label="seats remaining" caption="counts down from startValue">
      <NumberTicker {...args} />
    </Stat>
  ),
};

export const DecimalPlaces: Story = {
  name: 'decimalPlaces={2}',
  args: { value: 4.87, startValue: 0, decimalPlaces: 2 },
  render: (args) => (
    <Stat label="average review score" caption="out of 10">
      <NumberTicker {...args} />
    </Stat>
  ),
};

/**
 * `notation="compact"` — the six-figure case, at the width it actually breaks.
 *
 * Both tiles below are pinned to 288px, a stat card inside the 320px viewport
 * floor once the page gutters are paid. The grouped form is eight tabular
 * glyphs at `text-3xl` and does not fit; the compact form is four. The count
 * animates through the compact string too, so the width is stable for the
 * whole run instead of growing a digit at a time.
 *
 * This shipped as a local re-patch in the design system's only real consumer
 * before it was a prop.
 */
export const Compact: Story = {
  name: 'notation="compact" — six figures in a 288px tile',
  args: { value: 128400, startValue: 0, notation: 'compact' },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div className="w-72 max-w-[288px] rounded-lg border border-border bg-background p-4">
        <span className="text-sm font-medium text-muted-foreground">
          page views · notation=&quot;compact&quot;
        </span>
        <div className="text-3xl font-semibold text-foreground">
          <NumberTicker {...args} />
        </div>
        <span className="text-xs text-muted-foreground">fits</span>
      </div>
      <div className="w-72 max-w-[288px] rounded-lg border border-border bg-background p-4">
        <span className="text-sm font-medium text-muted-foreground">
          page views · notation=&quot;standard&quot; (default)
        </span>
        <div className="text-3xl font-semibold text-foreground">
          <NumberTicker value={128400} startValue={0} />
        </div>
        <span className="text-xs text-muted-foreground">
          the same number, four glyphs wider
        </span>
      </div>
    </div>
  ),
};

/**
 * Compact keeps `decimalPlaces` meaningful — one place buys back the precision
 * the rounding threw away, still in five glyphs.
 */
export const CompactWithDecimal: Story = {
  name: 'notation="compact" + decimalPlaces={1}',
  args: { value: 128400, startValue: 0, notation: 'compact', decimalPlaces: 1 },
  render: (args) => (
    <Stat label="page views" caption="128.4K instead of 128K">
      <NumberTicker {...args} />
    </Stat>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
