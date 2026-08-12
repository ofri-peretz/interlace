import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert, AlertTitle, AlertDescription } from '@interlace/ui/alert';
import { Terminal, AlertTriangle } from 'lucide-react';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Alert> = {
  title: 'Primitives/Alert',
  component: Alert,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Out-of-band runtime banner: something happened to the system and the reader needs to know before continuing ("sync failed", "cache is stale", "no results"). Not for authored asides inside prose — that is `Callout`. Per `ERROR_PHILOSOPHY.md` the `destructive` variant pairs an icon and a title with the colour so failure never rests on hue alone.',
      },
    },
  },
  // `Alert` is a `div` + a two-way cva variant. Everything else the surface
  // shows is composed from `AlertTitle` / `AlertDescription` / a leading icon,
  // so `children` documents but cannot be typed into a control.
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive'],
      description:
        'Severity pigment. `destructive` recolours the title, description, and leading icon; it does not change the layout.',
      table: {
        category: 'Appearance',
        type: { summary: "'default' | 'destructive'" },
        defaultValue: { summary: 'default' },
      },
    },
    className: {
      control: 'text',
      description:
        'Alert is `w-full` by default — the caller owns its measure, usually by constraining the parent column.',
      table: { category: 'Appearance' },
    },
    children: {
      control: false,
      description:
        'Optional leading `<svg>` (auto-slotted into the icon column), then `AlertTitle` and `AlertDescription`.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  args: {
    variant: 'default',
    className: 'w-[460px] max-w-full',
    children: (
      <>
        <Terminal className="size-4" />
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>
          Article cache is more than 7 days old — a sync is in progress.
        </AlertDescription>
      </>
    ),
  },
  render: (args) => <Alert {...args} />,
};
export const Destructive: Story = {
  args: {
    variant: 'destructive',
    className: 'w-[460px] max-w-full',
    children: (
      <>
        <AlertTriangle className="size-4" />
        <AlertTitle>Sync failed</AlertTitle>
        <AlertDescription>
          Falling back to last cached snapshot. Showing stale article counts.
        </AlertDescription>
      </>
    ),
  },
  render: (args) => <Alert {...args} />,
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
