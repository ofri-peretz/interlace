import { Marquee } from '@interlace/ui/magicui/marquee';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * Marquee stories
 *
 * The component is WCAG 2.2.2 (Pause, Stop, Hide) compliant by default: a
 * visible pause button ships alongside `pauseOnHover`, and reduced-motion
 * users get a static row with no opt-in required. These stories keep
 * `showPauseControl` on throughout, matching how the component ships.
 */

const TECH = ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'ESLint', 'Storybook', 'Radix UI', 'Vitest'];

const NOTIFICATIONS = [
  'Build passed on main',
  '3 new stars this week',
  'Coverage held at 100%',
  'PR merged: fix pause control',
];

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="flex shrink-0 items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground">
    {children}
  </span>
);

const meta: Meta<typeof Marquee> = {
  title: 'MagicUI/Marquee',
  component: Marquee,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'An infinitely-scrolling row (or column) of content — logo clouds, ' +
          'ticker rows, testimonial strips. Motion is gated three ways: the ' +
          'global `prefers-reduced-motion` reset, an optional `pauseOnHover` for ' +
          'mouse users, and a visible play/pause button for keyboard and ' +
          'screen-reader users, since a marquee runs well past the 5-second ' +
          'threshold WCAG 2.2.2 cares about.',
      },
    },
  },
  argTypes: {
    reverse: {
      control: 'boolean',
      description: 'Reverse the animation direction.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Appearance' },
    },
    vertical: {
      control: 'boolean',
      description:
        'Animate top-to-bottom instead of left-to-right. Give the marquee an explicit height via `className` so the wrap-around is visible.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Appearance' },
    },
    pauseOnHover: {
      control: 'boolean',
      description:
        'Pause on mouse hover. Additive to the visible pause button below, not a replacement for it — keyboard and screen-reader users cannot hover.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Behavior' },
    },
    repeat: {
      control: { type: 'number', min: 1, max: 6 },
      description:
        'How many times the children are duplicated to fill the scrolling track without a visible seam. Each extra copy is more DOM nodes for the same visual loop.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '2' }, category: 'Behavior' },
    },
    showPauseControl: {
      control: 'boolean',
      description:
        'Render the visible play/pause button (WCAG 2.2.2). Turn off only when a parent surface already exposes its own pause control.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Accessibility' },
    },
    pauseLabel: {
      control: 'text',
      description: 'Accessible label for the pause control, e.g. "Pause sponsor logos".',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Pause scrolling content' }, category: 'Accessibility' },
    },
    className: {
      control: 'text',
      description: 'Merged onto the scrolling track — the seam for width/height (needed for `vertical`).',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    children: {
      control: false,
      description: 'Content to repeat along the track.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Marquee>;

export const Default: Story = {
  args: {
    reverse: false,
    pauseOnHover: false,
    vertical: false,
    repeat: 2,
    showPauseControl: true,
    pauseLabel: 'Pause scrolling content',
  },
  render: (args) => (
    <Marquee {...args}>
      {TECH.map((label) => (
        <Chip key={label}>{label}</Chip>
      ))}
    </Marquee>
  ),
};

export const Reverse: Story = {
  args: { ...Default.args, reverse: true },
  render: Default.render,
};

export const PauseOnHover: Story = {
  name: 'Pause on hover',
  args: { ...Default.args, pauseOnHover: true },
  render: Default.render,
  parameters: {
    docs: {
      description: {
        story: 'Hovering the row pauses it — handy for a logo cloud a mouse user wants to actually read.',
      },
    },
  },
};

export const Vertical: Story = {
  args: { ...Default.args, vertical: true, className: 'h-64 w-72' },
  render: (args) => (
    <Marquee {...args}>
      {NOTIFICATIONS.map((label) => (
        <Chip key={label}>{label}</Chip>
      ))}
    </Marquee>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: 'dark' } };
