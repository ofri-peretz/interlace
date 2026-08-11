import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
import { Switch } from '@interlace/ui/switch';
import { withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta: Meta<typeof Switch> = {
  title: 'Primitives/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Binary on/off control whose change takes effect immediately — there is no submit step. Reach for Checkbox instead whenever the value is collected now and applied later by a form (`FORM_PHILOSOPHY.md`). Base UI owns `role="switch"`, `aria-checked` and Space/Enter activation; wrap it in a native `<label>` so a click on the text toggles it too.',
      },
    },
  },
  argTypes: {
    'aria-label': {
      control: 'text',
      description:
        'Accessible name. Base UI puts its own id on the `role="switch"` element, so `<Label htmlFor>` cannot reach it — the stories below render this string as the visible label text as well.',
      table: { category: 'A11y', type: { summary: 'string' } },
    },
    checked: {
      control: 'boolean',
      description:
        'Controlled on/off state. The Default story feeds this control back through `onCheckedChange`, so clicking the switch and moving the control stay in sync.',
      table: { category: 'State', type: { summary: 'boolean' } },
    },
    defaultChecked: {
      control: 'boolean',
      description:
        'Uncontrolled initial state — read once on mount, so it only takes effect on a remount. Ignored entirely when `checked` is passed.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description:
        'Ignore all user interaction. Paints at 50% opacity — exempt from SC 1.4.11 as an inactive component.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    readOnly: {
      control: 'boolean',
      description:
        'Focusable and announced, but the user cannot change it. Unlike `disabled`, the value is still submitted with the form.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    required: {
      control: 'boolean',
      description: 'The switch must be on before its form can be submitted.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    name: {
      control: 'text',
      description: 'Name of the hidden `<input>` — identifies the field on submit.',
      table: { category: 'Form', type: { summary: 'string' } },
    },
    value: {
      control: 'text',
      description: 'Value submitted with the form while the switch is on.',
      table: {
        category: 'Form',
        type: { summary: 'string' },
        defaultValue: { summary: "'on'" },
      },
    },
    onCheckedChange: {
      action: 'checkedChange',
      description: 'Fired when the switch is activated or deactivated.',
      table: {
        category: 'Events',
        type: { summary: '(checked: boolean, details) => void' },
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the track. The thumb is styled internally.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    'aria-label': 'Respect reduced motion',
    checked: false,
    disabled: false,
    readOnly: false,
    required: false,
    onCheckedChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

// Base UI's Switch renders its own internal id on the role="switch" span,
// so `<Label htmlFor>` doesn't reach the interactive element. All stories
// use the native-label wrap pattern + `aria-label` (see KeyboardToggle below
// for the rationale).
export const Default: Story = {
  render: function DefaultSwitch(args) {
    // `useArgs` closes the controlled loop: the Controls panel drives
    // `checked`, and a click on the switch writes back into it. Without this
    // the switch would be a frozen controlled component whose control did
    // nothing on screen.
    const [, updateArgs] = useArgs();
    return (
      <label className="flex cursor-pointer items-center gap-3">
        <Switch
          {...args}
          onCheckedChange={(checked, details) => {
            args.onCheckedChange?.(checked, details);
            updateArgs({ checked });
          }}
        />
        <span>{args['aria-label']}</span>
      </label>
    );
  },
};
export const Checked: Story = {
  render: () => (
    <label className="flex items-center gap-3 cursor-pointer">
      <Switch aria-label="Reduced motion (on)" defaultChecked />
      <span>Reduced motion (on)</span>
    </label>
  ),
};

/**
 * The realistic shape: a settings panel where every row is a label + a
 * one-line consequence, and the switch is the right-hand affordance. A lone
 * 32×18 track in an empty canvas teaches nothing about the spacing or the
 * label association this primitive depends on.
 */
export const SettingsRows: Story = {
  render: () => (
    <div className="w-full max-w-float divide-y divide-border rounded-md border border-border">
      {[
        {
          label: 'Respect reduced motion',
          hint: 'Skip slide and zoom transitions.',
          on: true,
        },
        {
          label: 'Weekly digest',
          hint: 'One email every Monday, no more.',
          on: false,
        },
        {
          label: 'Beta rules',
          hint: 'Enable rules still in the release candidate set.',
          on: false,
        },
      ].map((row) => (
        <label
          key={row.label}
          className="flex cursor-pointer items-center justify-between gap-md p-md"
        >
          <span className="flex flex-col gap-xs">
            <span className="text-ui font-medium">{row.label}</span>
            <span className="text-ui-sm text-muted-foreground">{row.hint}</span>
          </span>
          <Switch aria-label={row.label} defaultChecked={row.on} />
        </label>
      ))}
    </div>
  ),
};

// Base UI's Switch renders its own internal id on the role="switch" span,
// so `<Label htmlFor>` doesn't reach the interactive element. Wrap in a
// native `<label>` (DOM-nested association) + add `aria-label` as a
// belt-and-suspenders accessible-name source for axe.
export const KeyboardToggle: Story = {
  render: () => (
    <label className="flex items-center gap-2 cursor-pointer">
      <Switch aria-label="Keyboard-operable" />
      <span>Keyboard-operable</span>
    </label>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const sw = canvas.getByRole('switch');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await step('Toggle via mouse click', async () => {
      await userEvent.click(sw);
      await expect(sw).toHaveAttribute('aria-checked', 'true');
    });
    await step('Toggle back via keyboard Space', async () => {
      sw.focus();
      await userEvent.keyboard(' ');
      await expect(sw).toHaveAttribute('aria-checked', 'false');
    });
  },
};

export const Invalid: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-3 cursor-pointer">
        <Switch
          aria-label="Accept policy"
          aria-invalid="true"
          aria-describedby="policy-err"
        />
        <span>Accept policy</span>
      </label>
      <span id="policy-err" className="text-destructive text-xs">
        You must accept to continue.
      </span>
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  render: () => (
    <label className="flex items-center gap-3 cursor-pointer">
      <Switch aria-label="احترام تقليل الحركة" defaultChecked />
      <span>احترام تقليل الحركة</span>
    </label>
  ),
  decorators: [withRtl],
};

/** Disabled — pointer-events off, 50% opacity (SC 1.4.11 exempt). */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-not-allowed items-center gap-2">
        <Switch aria-label="Off and disabled" disabled />
        <span>Off, disabled</span>
      </label>
      <label className="flex cursor-not-allowed items-center gap-2">
        <Switch aria-label="On and disabled" defaultChecked disabled />
        <span>On, disabled</span>
      </label>
    </div>
  ),
};

/** Loading placeholder — matches the 32×20 track silhouette. */
export const Loading: Story = {
  render: () => <Skeleton variant="switch" />,
};
