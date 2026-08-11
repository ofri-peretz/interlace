import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@interlace/ui/tabs';
import { Skeleton } from '@interlace/ui/skeleton';
import { withRtl } from '@/decorators';

const meta: Meta<typeof Tabs> = {
  title: 'Primitives/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Switches one region of the page between a small set of peer views that the reader is expected to compare. Not navigation — a tab that changes the route belongs in a nav, and more than about five panels belongs in a list or a select. Keyboard arrow-key traversal follows `KEYBOARD_PHILOSOPHY.md`; activation is manual (arrows move focus, Enter/Space selects) and a `TabsContent` mounts only while its trigger is active.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'select',
      options: ['security', 'quality', 'react'],
      description:
        'Controlled active tab. The Default story feeds this control back through `onValueChange`, so clicking a tab moves the control and vice-versa. `null` selects nothing.',
      table: { category: 'State', type: { summary: 'string | number | null' } },
    },
    defaultValue: {
      control: false,
      description:
        'Uncontrolled initial tab — read once on mount. Use `value` above to drive the tab set from the Controls panel.',
      table: { category: 'State', type: { summary: 'string | number | null' } },
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description:
        'Layout flow, and which arrow keys traverse the list. `vertical` expects the consumer to lay the list out as a column.',
      table: {
        category: 'Appearance',
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: "'horizontal'" },
      },
    },
    onValueChange: {
      action: 'valueChange',
      description:
        'Fires on selection. `eventDetails.reason` distinguishes a user click from the automatic fallback that runs when the selected tab is removed or disabled.',
      table: {
        category: 'Events',
        type: { summary: '(value, details) => void' },
      },
    },
    children: {
      control: false,
      description:
        'One `TabsList` of `TabsTrigger`s plus one `TabsContent` per `value`.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description: 'Merged onto the root — this is where the tab set gets its width.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    orientation: 'horizontal',
    className: 'w-[420px] max-w-full',
    onValueChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

const PANELS = [
  { value: 'security', label: 'Security', body: '8 plugins, 224+ rules.' },
  { value: 'quality', label: 'Code Quality', body: '6 plugins, 49+ rules.' },
  { value: 'react', label: 'React', body: '2 plugins, 91 rules.' },
] as const;

export const Default: Story = {
  args: { value: 'security' },
  render: function DefaultTabs(args) {
    // `useArgs` closes the controlled loop — without it a controlled `value`
    // would freeze the tab set and the control would change nothing on screen.
    const [, updateArgs] = useArgs();
    return (
      <Tabs
        {...args}
        onValueChange={(value, details) => {
          args.onValueChange?.(value, details);
          updateArgs({ value });
        }}
      >
        <TabsList>
          {PANELS.map((panel) => (
            <TabsTrigger key={panel.value} value={panel.value}>
              {panel.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {PANELS.map((panel) => (
          <TabsContent
            key={panel.value}
            value={panel.value}
            className="text-muted-foreground p-3 text-sm"
          >
            {panel.body}
          </TabsContent>
        ))}
      </Tabs>
    );
  },
};

/**
 * Keyboard-only flow per the APG tabs pattern, **manual activation** variant:
 *
 *   - the tablist is a single tab stop (roving tabindex), starting on the
 *     selected tab;
 *   - arrows move FOCUS only — selection does not follow;
 *   - Enter / Space activates the focused tab;
 *   - Home / End jump to the ends.
 *
 * Manual activation is Base UI's default and is the APG's recommendation
 * whenever revealing a panel is expensive — automatic activation would fire
 * a panel load for every tab the user arrows past.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <Tabs defaultValue="security" className="w-[420px] max-w-full">
      <TabsList>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="quality">Quality</TabsTrigger>
        <TabsTrigger value="react">React</TabsTrigger>
      </TabsList>
      <TabsContent value="security" className="p-3 text-sm">
        Security panel
      </TabsContent>
      <TabsContent value="quality" className="p-3 text-sm">
        Quality panel
      </TabsContent>
      <TabsContent value="react" className="p-3 text-sm">
        React panel
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');

    await step('Roving tabindex: ONE tab stop, on the selected tab', async () => {
      // Base UI assigns the roving index in a mount effect, so read it
      // through waitFor rather than on the first paint.
      await waitFor(() => {
        const tabbable = tabs.filter((t) => t.getAttribute('tabindex') !== '-1');
        expect(tabbable).toHaveLength(1);
        expect(tabbable[0].getAttribute('aria-selected')).toBe('true');
      });
    });

    await step('ArrowRight moves focus WITHOUT changing selection', async () => {
      tabs[0].focus();
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() => expect(document.activeElement).toBe(tabs[1]));
      // Manual activation: arrowing past a tab must not load its panel.
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    });

    await step('Enter activates the focused tab', async () => {
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(tabs[1].getAttribute('aria-selected')).toBe('true'),
      );
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    });

    await step('End / Home move focus to the ends', async () => {
      await userEvent.keyboard('{End}');
      await waitFor(() =>
        expect(document.activeElement).toBe(tabs[tabs.length - 1]),
      );
      await userEvent.keyboard('{Home}');
      await waitFor(() => expect(document.activeElement).toBe(tabs[0]));
    });

    await step('The selected tab controls a real panel', async () => {
      await waitFor(() => {
        const selected = tabs.find(
          (t) => t.getAttribute('aria-selected') === 'true',
        ) as HTMLElement;
        const controls = selected.getAttribute('aria-controls');
        expect(controls).toBeTruthy();
        expect(document.getElementById(controls as string)).toBeTruthy();
      });
    });
  },
};

/**
 * Async tab set — reserve the list row + panel body so the surface under a
 * loading tab group doesn't jump when the real tabs arrive.
 */
export const Loading: Story = {
  render: () => <Skeleton variant="tabs" className="w-[420px] max-w-full" />,
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
