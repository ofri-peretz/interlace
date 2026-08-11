import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  CommandPalette,
  CommandPaletteCollection,
  CommandPaletteContent,
  CommandPaletteDescription,
  CommandPaletteEmpty,
  CommandPaletteGroup,
  CommandPaletteGroupLabel,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
  CommandPaletteShortcut,
  CommandPaletteTitle,
  CommandPaletteTrigger,
  useCommandPaletteHotkey,
} from '@interlace/ui/command-palette';
import { Button } from '@interlace/ui/button';
import { VisuallyHidden } from '@interlace/ui/visually-hidden';
import { withReducedMotion, withRtl } from '@/decorators';
import {
  ArrowRightIcon,
  BookOpenIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
} from 'lucide-react';

const meta: Meta<typeof CommandPalette> = {
  title: 'Primitives/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  parameters: {
    // The global `padded` default, deliberately not overridden to `centered`.
    // A palette portals its whole panel to `document.body`, so `#storybook-root`
    // holds only the trigger — under `centered` the root collapses to
    // fit-content and the runner's collapsed-root gate has nothing to measure.
    // `padded` keeps the root filling the canvas, which is also the truthful
    // frame: the palette is a full-viewport overlay, not an inline widget.
    docs: {
      description: {
        component:
          'The ⌘K surface: one modal panel holding a filterable list of actions. It is a composition, not a new primitive — `Dialog` supplies the modal (focus trap, page inert, Escape, focus restore) and an `inline` Base UI combobox supplies the field and the list. `inline` is the load-bearing prop: without it the combobox opens a second portal over the dialog and swallows Escape, so one press does nothing and the user is stuck in a surface they cannot leave from the keyboard. The ⌘K binding is opt-in via `useCommandPaletteHotkey` — a design system should not seize a global chord on mount.',
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description:
        'Controlled open state, forwarded to `Dialog.Root`. Setting it takes ownership — the trigger then only reports intent through `onOpenChange`.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Open on mount, uncontrolled.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    onOpenChange: {
      control: false,
      description: 'Fired when the palette opens or closes, with the Base UI reason.',
      table: { type: { summary: '(open, eventDetails) => void' }, category: 'Events' },
    },
    children: {
      control: false,
      description: '`CommandPaletteTrigger` (optional) + `CommandPaletteContent`.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
  args: {
    onOpenChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CommandPalette>;

interface Command {
  value: string;
  label: string;
  group: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COMMANDS: Command[] = [
  { value: 'new-article', label: 'New article', group: 'Actions', shortcut: '⌘N', icon: PlusIcon },
  { value: 'open-docs', label: 'Open documentation', group: 'Actions', shortcut: '⌘D', icon: BookOpenIcon },
  { value: 'settings', label: 'Open settings', group: 'Actions', shortcut: '⌘,', icon: SettingsIcon },
  { value: 'theme-light', label: 'Switch to light theme', group: 'Theme', icon: SunIcon },
  { value: 'theme-dark', label: 'Switch to dark theme', group: 'Theme', icon: MoonIcon },
  { value: 'goto-registry', label: 'Go to registry', group: 'Navigation', icon: ArrowRightIcon },
  { value: 'goto-storybook', label: 'Go to Storybook', group: 'Navigation', icon: ArrowRightIcon },
];

const GROUPED_COMMANDS = ['Actions', 'Theme', 'Navigation'].map((group) => ({
  value: group,
  items: COMMANDS.filter((command) => command.group === group),
}));

function CommandRow({ command }: { command: Command }) {
  const Icon = command.icon;
  return (
    <CommandPaletteItem value={command}>
      <Icon className="text-muted-foreground size-4" />
      {command.label}
      {command.shortcut ? (
        <CommandPaletteShortcut>{command.shortcut}</CommandPaletteShortcut>
      ) : null}
    </CommandPaletteItem>
  );
}

/**
 * The canonical shape. `CommandPaletteTitle` is visually hidden but present —
 * a modal without an accessible name is announced as "dialog" and nothing
 * else.
 */
export const Default: Story = {
  render: function DefaultStory(args) {
    const [ran, setRan] = React.useState<string | null>(null);
    return (
      <div className="flex flex-col items-center gap-3">
        <CommandPalette {...args}>
          <CommandPaletteTrigger
            render={<Button variant="outline">Open command palette</Button>}
          />
          <CommandPaletteContent
            items={GROUPED_COMMANDS}
            onValueChange={(command: Command | null) =>
              setRan(command?.label ?? null)
            }
          >
            <VisuallyHidden>
              <CommandPaletteTitle>Command palette</CommandPaletteTitle>
              <CommandPaletteDescription>
                Search for a command and press Enter to run it.
              </CommandPaletteDescription>
            </VisuallyHidden>
            <CommandPaletteInput placeholder="Type a command or search…" />
            <CommandPaletteEmpty>No matching command.</CommandPaletteEmpty>
            <CommandPaletteList>
              {(group: { value: string; items: Command[] }) => (
                <CommandPaletteGroup key={group.value} items={group.items}>
                  <CommandPaletteGroupLabel>{group.value}</CommandPaletteGroupLabel>
                  <CommandPaletteCollection>
                    {(command: Command) => (
                      <CommandRow key={command.value} command={command} />
                    )}
                  </CommandPaletteCollection>
                </CommandPaletteGroup>
              )}
            </CommandPaletteList>
          </CommandPaletteContent>
        </CommandPalette>
        <p className="text-muted-foreground text-sm" data-testid="last-command">
          {ran ? `Ran: ${ran}` : 'Nothing run yet.'}
        </p>
      </div>
    );
  },
};

/** Flat list — no groups. The minimum viable palette. */
export const Flat: Story = {
  render: () => (
    <CommandPalette defaultOpen>
      <CommandPaletteContent items={COMMANDS}>
        <VisuallyHidden>
          <CommandPaletteTitle>Command palette</CommandPaletteTitle>
        </VisuallyHidden>
        <CommandPaletteInput placeholder="Type a command or search…" />
        <CommandPaletteEmpty>No matching command.</CommandPaletteEmpty>
        <CommandPaletteList>
          {(command: Command) => (
            <CommandRow key={command.value} command={command} />
          )}
        </CommandPaletteList>
      </CommandPaletteContent>
    </CommandPalette>
  ),
};

/**
 * `useCommandPaletteHotkey` — the ⌘K / Ctrl+K binding, opted into at the call
 * site. Click into the canvas first so the iframe owns the keyboard, then
 * press the chord.
 */
export const WithHotkey: Story = {
  render: function HotkeyStory() {
    const [open, setOpen] = React.useState(false);
    useCommandPaletteHotkey(() => setOpen(true));
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-muted-foreground text-sm">
          Press <kbd className="font-sans">⌘K</kbd> (or{' '}
          <kbd className="font-sans">Ctrl+K</kbd>) anywhere on this canvas.
        </p>
        <CommandPalette open={open} onOpenChange={setOpen}>
          <CommandPaletteContent items={COMMANDS}>
            <VisuallyHidden>
              <CommandPaletteTitle>Command palette</CommandPaletteTitle>
            </VisuallyHidden>
            <CommandPaletteInput placeholder="Type a command or search…" />
            <CommandPaletteEmpty>No matching command.</CommandPaletteEmpty>
            <CommandPaletteList>
              {(command: Command) => (
                <CommandRow key={command.value} command={command} />
              )}
            </CommandPaletteList>
          </CommandPaletteContent>
        </CommandPalette>
      </div>
    );
  },
};

/**
 * The keyboard contract from `command-palette.tsx`, driven for real.
 *
 * A command palette IS its keyboard model, and axe cannot press a key: it
 * renders the static tree and would pass an unusable panel. This story is the
 * proof for every row of the table in the source header, and
 * `overlay-nav-keyboard-lock` fails if it is deleted.
 *
 * The Escape assertion is the one that matters most. Without `inline` on the
 * combobox root, Base UI's `useDismiss` intercepts Escape to close a popup
 * that is not there and the dialog stays open — a keyboard trap (WCAG 2.1.2)
 * that looks fine in every screenshot.
 */
export const KeyboardFlow: Story = {
  render: function KeyboardStory() {
    const [ran, setRan] = React.useState<string | null>(null);
    return (
      <div className="flex flex-col items-center gap-3">
        <CommandPalette>
          <CommandPaletteTrigger
            render={<Button variant="outline">Open command palette</Button>}
          />
          <CommandPaletteContent
            items={COMMANDS}
            onValueChange={(command: Command | null) =>
              setRan(command?.label ?? null)
            }
          >
            <VisuallyHidden>
              <CommandPaletteTitle>Command palette</CommandPaletteTitle>
            </VisuallyHidden>
            <CommandPaletteInput placeholder="Type a command or search…" />
            <CommandPaletteEmpty>No matching command.</CommandPaletteEmpty>
            <CommandPaletteList>
              {(command: Command) => (
                <CommandRow key={command.value} command={command} />
              )}
            </CommandPaletteList>
          </CommandPaletteContent>
        </CommandPalette>
        <p className="text-muted-foreground text-sm" data-testid="last-command">
          {ran ? `Ran: ${ran}` : 'Nothing run yet.'}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /open command palette/i });
    // The panel is portalled out of `canvasElement`.
    const body = within(document.body);

    await step('Enter on the trigger opens the palette', async () => {
      await userEvent.tab();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(body.queryByRole('dialog')).toBeTruthy());
    });

    await step('Focus lands in the search input, not on the panel', async () => {
      await waitFor(() => {
        const input = body.getByRole('combobox');
        expect(document.activeElement).toBe(input);
      });
    });

    await step('The input is wired to the listbox it filters', async () => {
      const input = body.getByRole('combobox');
      await waitFor(() => {
        const controls = input.getAttribute('aria-controls');
        expect(controls).toBeTruthy();
        expect(document.getElementById(controls!)?.getAttribute('role')).toBe(
          'listbox',
        );
      });
    });

    await step('Typing filters the list', async () => {
      await userEvent.keyboard('theme');
      await waitFor(() => {
        const options = body.getAllByRole('option');
        expect(options).toHaveLength(2);
      });
    });

    await step('ArrowDown highlights WITHOUT moving DOM focus', async () => {
      const input = body.getByRole('combobox');
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        const active = input.getAttribute('aria-activedescendant');
        expect(active).toBeTruthy();
        expect(document.getElementById(active!)?.getAttribute('role')).toBe(
          'option',
        );
      });
      // Base UI navigates virtually. Asserting activeElement.role === 'option'
      // here — correct for Select — would be asserting a bug.
      expect(document.activeElement).toBe(input);
    });

    await step('Enter runs the highlighted command and closes', async () => {
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(body.queryByRole('dialog')).toBeFalsy());
      await waitFor(() =>
        expect(canvas.getByTestId('last-command').textContent).toContain(
          'Switch to light theme',
        ),
      );
    });

    await step('Focus returns to the trigger', async () => {
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });

    await step('Escape closes the palette (WCAG 2.1.2 — no trap)', async () => {
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(body.queryByRole('dialog')).toBeTruthy());
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(body.queryByRole('dialog')).toBeFalsy());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  },
};

/** Empty state — the query matches nothing. */
export const NoResults: Story = {
  render: () => (
    <CommandPalette defaultOpen>
      <CommandPaletteContent items={COMMANDS} defaultInputValue="zzzz">
        <VisuallyHidden>
          <CommandPaletteTitle>Command palette</CommandPaletteTitle>
        </VisuallyHidden>
        <CommandPaletteInput placeholder="Type a command or search…" />
        <CommandPaletteEmpty>No matching command.</CommandPaletteEmpty>
        <CommandPaletteList>
          {(command: Command) => (
            <CommandRow key={command.value} command={command} />
          )}
        </CommandPaletteList>
      </CommandPaletteContent>
    </CommandPalette>
  ),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  parameters: { backgrounds: { default: 'dark' } },
  render: () => (
    <div className="dark">
      <CommandPalette defaultOpen>
        <CommandPaletteContent items={COMMANDS}>
          <VisuallyHidden>
            <CommandPaletteTitle>Command palette</CommandPaletteTitle>
          </VisuallyHidden>
          <CommandPaletteInput placeholder="Type a command or search…" />
          <CommandPaletteEmpty>No matching command.</CommandPaletteEmpty>
          <CommandPaletteList>
            {(command: Command) => (
              <CommandRow key={command.value} command={command} />
            )}
          </CommandPaletteList>
        </CommandPaletteContent>
      </CommandPalette>
    </div>
  ),
};

const RTL_COMMANDS = [
  { value: 'new', label: 'مقال جديد' },
  { value: 'docs', label: 'فتح التوثيق' },
  { value: 'settings', label: 'الإعدادات' },
];

export const RTL: Story = {
  render: () => (
    <CommandPalette defaultOpen>
      <CommandPaletteContent items={RTL_COMMANDS}>
        <VisuallyHidden>
          <CommandPaletteTitle>لوحة الأوامر</CommandPaletteTitle>
        </VisuallyHidden>
        <CommandPaletteInput placeholder="اكتب أمرًا…" />
        <CommandPaletteEmpty>لا توجد نتائج.</CommandPaletteEmpty>
        <CommandPaletteList>
          {(command: { value: string; label: string }) => (
            <CommandPaletteItem key={command.value} value={command}>
              {command.label}
            </CommandPaletteItem>
          )}
        </CommandPaletteList>
      </CommandPaletteContent>
    </CommandPalette>
  ),
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Flat,
  decorators: [withReducedMotion],
};
