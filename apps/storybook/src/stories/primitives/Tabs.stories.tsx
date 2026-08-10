import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@interlace/ui/tabs';
import { Skeleton } from '@interlace/ui/skeleton';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Tabs> = {
  title: 'Primitives/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Horizontal tab navigation with keyboard arrow-key traversal per `KEYBOARD_PHILOSOPHY.md`. Lazy-mount: a TabsContent renders only when its trigger is active.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="security" className="w-[420px] max-w-full">
      <TabsList>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="quality">Code Quality</TabsTrigger>
        <TabsTrigger value="react">React</TabsTrigger>
      </TabsList>
      <TabsContent value="security" className="text-muted-foreground p-3 text-sm">
        8 plugins, 224+ rules.
      </TabsContent>
      <TabsContent value="quality" className="text-muted-foreground p-3 text-sm">
        6 plugins, 49+ rules.
      </TabsContent>
      <TabsContent value="react" className="text-muted-foreground p-3 text-sm">
        2 plugins, 91 rules.
      </TabsContent>
    </Tabs>
  ),
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
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
