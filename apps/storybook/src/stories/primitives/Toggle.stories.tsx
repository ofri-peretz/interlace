import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
import { Bold, Italic, Underline } from 'lucide-react';
import { Toggle, ToggleGroup } from '@interlace/ui/toggle';

const meta: Meta<typeof Toggle> = {
  title: 'Primitives/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A button that stays in. Use it when the control applies a state to something else on screen — bold on the selection, a filter on a list — and the pressed state is the whole feedback. Base UI carries `aria-pressed`, which is why this is not a Switch (a setting the user turns on) and not a Checkbox (a value a form collects). Compose several inside `ToggleGroup` for a formatting-toolbar cluster.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline'],
      description:
        'Resting appearance. `default` is transparent until hovered or pressed — right inside a toolbar where the group already reads as one unit; `outline` gives a lone toggle its own edge.',
      table: {
        category: 'Appearance',
        type: { summary: "'default' | 'outline'" },
        defaultValue: { summary: "'default'" },
      },
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description:
        'Height and padding: sm 32px · md 36px · lg 40px. Even `sm` clears the WCAG 2.5.5 24×24 target floor.',
      table: {
        category: 'Appearance',
        type: { summary: "'sm' | 'md' | 'lg'" },
        defaultValue: { summary: "'md'" },
      },
    },
    pressed: {
      control: 'boolean',
      description:
        'Controlled pressed state. The Default story feeds this control back through `onPressedChange`, so the button and the control stay in sync.',
      table: { category: 'State', type: { summary: 'boolean' } },
    },
    defaultPressed: {
      control: false,
      description:
        'Uncontrolled initial state — read once on mount. Use `pressed` above to drive the toggle from the Controls panel.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description:
        'Ignore user interaction. 50% opacity, pointer-events off — exempt from SC 1.4.11 as an inactive component.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    value: {
      control: 'text',
      description:
        'Identifies this toggle inside a `ToggleGroup` — the string the group reports as pressed.',
      table: { category: 'State', type: { summary: 'string' } },
    },
    onPressedChange: {
      action: 'pressedChange',
      description: 'Fires whenever the pressed state flips.',
      table: {
        category: 'Events',
        type: { summary: '(pressed: boolean, details) => void' },
      },
    },
    'aria-label': {
      control: 'text',
      description:
        'Required whenever the child is an icon — the pressed state is announced, but the thing being toggled is not.',
      table: { category: 'A11y', type: { summary: 'string' } },
    },
    children: {
      control: false,
      description: 'Icon or text. Icons should be 16px (`size-4`) at the `md` size.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description: 'Merged into the cva class list.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    variant: 'default',
    size: 'md',
    disabled: false,
    'aria-label': 'Toggle bold',
    onPressedChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { pressed: false },
  render: function DefaultToggle(args) {
    // `useArgs` closes the controlled loop — otherwise a controlled `pressed`
    // would freeze the button and the control would change nothing on screen.
    const [, updateArgs] = useArgs();
    return (
      <Toggle
        {...args}
        onPressedChange={(pressed, details) => {
          args.onPressedChange?.(pressed, details);
          updateArgs({ pressed });
        }}
      >
        <Bold className="size-4" aria-hidden />
      </Toggle>
    );
  },
};

export const Outline: Story = {
  args: { variant: 'outline', size: 'md', 'aria-label': 'Toggle italic' },
  render: (args) => (
    <Toggle {...args}>
      <Italic className="size-4" aria-hidden />
    </Toggle>
  ),
};

export const Sizes: Story = {
  // The registry's thumbnail for this component — see the preview policy in
  // apps/registry/scripts/build-story-map.mjs. Default renders too small to
  // read at thumbnail size.
  tags: ['preview'],
  parameters: {
    docs: { description: { story: 'Three sizes match the WCAG 2.5.5 target-size floor at sm.' } },
  },
  render: () => (
    <div className="flex items-center gap-3">
      <Toggle size="sm" aria-label="sm">
        <Bold className="size-3.5" aria-hidden />
      </Toggle>
      <Toggle size="md" aria-label="md">
        <Bold className="size-4" aria-hidden />
      </Toggle>
      <Toggle size="lg" aria-label="lg">
        <Bold className="size-5" aria-hidden />
      </Toggle>
    </div>
  ),
};

export const Group: Story = {
  parameters: {
    docs: { description: { story: 'Multi-select group — three independent toggles, classic formatting toolbar.' } },
  },
  render: () => (
    <ToggleGroup>
      <Toggle aria-label="Bold">
        <Bold className="size-4" aria-hidden />
      </Toggle>
      <Toggle aria-label="Italic">
        <Italic className="size-4" aria-hidden />
      </Toggle>
      <Toggle aria-label="Underline">
        <Underline className="size-4" aria-hidden />
      </Toggle>
    </ToggleGroup>
  ),
};

/** Dark twin of the preview, so the site's scheme toggle repaints it
 *  rather than swapping it for a different composition. */
export const Dark: Story = { ...Sizes, globals: { theme: 'dark' } };
