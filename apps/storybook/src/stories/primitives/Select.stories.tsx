import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@interlace/ui/select';
import { withReducedMotion, withRtl } from '@/decorators';
import { Skeleton } from '@interlace/ui/skeleton';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: {
    // Not centered. Select is a FORM CONTROL — it belongs at the width of
    // the field it fills, and a fit-content root collapsed its story root to
    // 212px inside a 1280px canvas. The other centered stories are overlays
    // whose trigger really is intrinsic; this one is not.
    layout: 'padded',
    docs: {
      description: {
        component:
          'Single-select over a list that is too long to show at rest — sort orders, plugin pickers, anything past a handful of options. The root renders no DOM of its own: it holds the value and open state for `SelectTrigger` + `SelectContent`, and Base UI supplies the combobox/listbox ARIA, typeahead, Home/End navigation and focus return. Use `RadioGroup` when every option should stay visible, and a plain `<input list>`/Autocomplete when the user should be able to type a value that is not in the list.',
      },
    },
  },
  argTypes: {
    defaultValue: {
      control: 'text',
      description:
        'Initially selected item value. Uncontrolled — this story remounts the select when the control changes so the new default takes effect.',
      table: { type: { summary: 'Value | null' }, category: 'Data' },
    },
    value: {
      control: false,
      description:
        'Controlled selection. Pair with `onValueChange` and own the state yourself; leave unset (as these stories do) to let Base UI hold it.',
      table: { type: { summary: 'Value | null' }, category: 'Data' },
    },
    name: {
      control: 'text',
      description:
        'Form field name. Projected onto the hidden input so a native `<form>` submit carries the selection.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    items: {
      control: false,
      description:
        'Optional value→label map. Only needed when item values are objects, or when `SelectValue` must render a label for a value whose `SelectItem` is not mounted. These stories compose `SelectItem` children instead.',
      table: {
        type: { summary: 'Record<string, ReactNode> | { label, value }[]' },
        category: 'Data',
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Ignore all interaction; the trigger drops to 50% opacity.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    readOnly: {
      control: 'boolean',
      description:
        'The popup still opens but no other item can be chosen. Unlike `disabled`, the value still submits with the form.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    required: {
      control: 'boolean',
      description: 'A value must be chosen before the owning form can submit.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    defaultOpen: {
      control: 'boolean',
      description:
        'Open the popup on mount. Uncontrolled — the story remounts on change so the control takes effect.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    modal: {
      control: 'boolean',
      description:
        'When open, lock page scroll and make everything outside the popup inert. Turn off for a select inside an already-modal surface.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'State' },
    },
    highlightItemOnHover: {
      control: 'boolean',
      description:
        'Whether pointer movement moves the highlight. Off keeps CSS `:hover` distinguishable from the keyboard `data-highlighted` state.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' }, category: 'Appearance' },
    },
    onValueChange: {
      control: false,
      description: 'Fired with the newly selected value plus Base UI event details.',
      table: { type: { summary: '(value, eventDetails) => void' }, category: 'Events' },
    },
    onOpenChange: {
      control: false,
      description:
        'Fired when the popup opens or closes, with the reason (`triggerPress`, `escapeKey`, `outsidePress`, …) on the event details.',
      table: { type: { summary: '(open, eventDetails) => void' }, category: 'Events' },
    },
    children: {
      control: false,
      description:
        '`SelectTrigger` + `SelectContent`. Items are composed as children rather than passed as an array so each row can carry an icon, a description, or a group label.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
  args: {
    onValueChange: fn(),
    onOpenChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

// `SelectValue` prints the raw value when it can't resolve a label — the
// selected item's `SelectItem` isn't mounted while the popup is closed. The
// value→label map is what makes the resting trigger read "Latest", not "date".
const SORT_ITEMS = {
  date: 'Latest',
  reactions: 'Popular',
  comments: 'Most discussed',
  reading_time: 'Long reads',
};

export const Default: Story = {
  args: {
    defaultValue: 'date',
    name: 'sort',
    disabled: false,
    readOnly: false,
    required: false,
    defaultOpen: false,
    modal: true,
    highlightItemOnHover: true,
  },
  // Remount on the uncontrolled seeds — a mounted select ignores a new
  // defaultValue / defaultOpen, so those controls would otherwise look inert.
  render: (args) => (
    <Select
      key={`${String(args.defaultValue)}-${String(args.defaultOpen)}`}
      {...args}
      items={SORT_ITEMS}
    >
      <SelectTrigger className="w-[180px] max-w-full" aria-label="Sort by">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="date">Latest</SelectItem>
        <SelectItem value="reactions">Popular</SelectItem>
        <SelectItem value="comments">Most discussed</SelectItem>
        <SelectItem value="reading_time">Long reads</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Grouped: Story = {
  render: () => (
    <Select
      defaultValue="security"
      items={{
        security: 'eslint-plugin-secure-coding',
        jwt: 'eslint-plugin-jwt',
        crypto: 'eslint-plugin-crypto',
        reliability: 'eslint-plugin-reliability',
        conventions: 'eslint-plugin-conventions',
      }}
    >
      <SelectTrigger className="w-[220px] max-w-full" aria-label="Choose plugin">
        <SelectValue placeholder="Choose plugin" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectGroupLabel>Security</SelectGroupLabel>
          <SelectItem value="security">eslint-plugin-secure-coding</SelectItem>
          <SelectItem value="jwt">eslint-plugin-jwt</SelectItem>
          <SelectItem value="crypto">eslint-plugin-crypto</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectGroupLabel>Quality</SelectGroupLabel>
          <SelectItem value="reliability">eslint-plugin-reliability</SelectItem>
          <SelectItem value="conventions">eslint-plugin-conventions</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

/**
 * Keyboard-only flow per the APG listbox pattern: Enter opens the popup AND
 * moves focus onto an option, arrows rove, Escape closes and returns focus to
 * the trigger. This is the story the keyboard table in `select.tsx` claims as
 * its proof — `overlay-nav-keyboard-lock` fails if it is deleted.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <Select items={SORT_ITEMS}>
      <SelectTrigger className="w-[180px] max-w-full" aria-label="Sort by">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="date">Latest</SelectItem>
        <SelectItem value="reactions">Popular</SelectItem>
        <SelectItem value="comments">Most discussed</SelectItem>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox', { name: /sort by/i });
    // The popup is portalled out of `canvasElement`, and Base UI force-mounts
    // its items on trigger focus so closed-trigger typeahead works. So query
    // by ROLE, not by selector: the closed positioner carries `hidden`, which
    // takes it out of the a11y tree while its DOM is still there. A
    // `querySelector('[role="listbox"]')` assertion would pass either way.
    const body = within(document.body);

    await step('The trigger advertises the listbox it owns', async () => {
      // Base UI writes the ARIA pairing in a mount effect.
      await waitFor(() => {
        expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
      });
    });

    await step('Enter opens the popup and focuses an option', async () => {
      // Tab to it rather than calling .focus() — userEvent keeps its own
      // notion of the focused element, and a raw focus() call leaves its
      // keyboard dispatch pointed at the document instead of the trigger.
      await userEvent.tab();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(body.queryByRole('listbox')).toBeTruthy());
      await waitFor(() =>
        expect(trigger.getAttribute('aria-expanded')).toBe('true'),
      );
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('role')).toBe('option'),
      );
    });

    await step('ArrowDown roves to the next option', async () => {
      const first = document.activeElement;
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(document.activeElement).not.toBe(first));
      expect(document.activeElement?.getAttribute('role')).toBe('option');
    });

    await step('Escape closes and restores focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(body.queryByRole('listbox')).toBeFalsy());
      await waitFor(() =>
        expect(trigger.getAttribute('aria-expanded')).toBe('false'),
      );
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  },
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-[180px] max-w-full" aria-label="Disabled select">
        <SelectValue placeholder="Disabled" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="x">Unreachable</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  render: () => (
    <div className="dark">
      <Select defaultValue="date" items={SORT_ITEMS}>
        <SelectTrigger className="w-[180px] max-w-full" aria-label="Sort by">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">Latest</SelectItem>
          <SelectItem value="reactions">Popular</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <Select>
        <SelectTrigger
          className="w-[180px] max-w-full"
          aria-label="Choose plan"
          aria-invalid="true"
          aria-describedby="plan-err-sel"
        >
          <SelectValue placeholder="Pick a plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">Free</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
        </SelectContent>
      </Select>
      <span id="plan-err-sel" className="text-destructive text-xs">
        Plan is required.
      </span>
    </div>
  ),
};

export const RTL: Story = {
  render: () => (
    <Select defaultValue="date" items={{ date: 'الأحدث', reactions: 'الأكثر شعبية' }}>
      <SelectTrigger className="w-[180px] max-w-full" aria-label="رتب حسب">
        <SelectValue placeholder="رتب حسب" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="date">الأحدث</SelectItem>
        <SelectItem value="reactions">الأكثر شعبية</SelectItem>
      </SelectContent>
    </Select>
  ),
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Default,
  decorators: [withReducedMotion],
};

/** Loading placeholder — reserves the 36px trigger height (CLS=0). */
export const Loading: Story = {
  render: () => (
    <div className="w-[220px] max-w-full">
      <Skeleton variant="select" />
    </div>
  ),
};
