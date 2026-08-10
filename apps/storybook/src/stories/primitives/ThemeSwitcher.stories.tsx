import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  ThemeSchemeToggle,
  ThemeSwitcher,
} from '@interlace/ui/theme-switcher';
import { withDark, withReducedMotion, withRtl } from '@/decorators';

/**
 * The two-axis theme control. `data-theme` selects the BRAND, `.dark`
 * selects the SCHEME, and they are orthogonal — the switcher is the only
 * place in the DS where both are visible at once.
 *
 * The stories write to `<html>` for real, so switching a theme here changes
 * the whole Storybook canvas. That is the point: a theme that only looks
 * right inside its own story is not a theme.
 */
const meta: Meta<typeof ThemeSwitcher> = {
  title: 'Primitives/ThemeSwitcher',
  component: ThemeSwitcher,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The menu that owns both theme axes at once: `data-theme` picks the BRAND, `.dark` picks the SCHEME, and they are orthogonal — which is exactly why they are two radio groups in one popup rather than a flattened "Light / Dark / Harbor / Harbor Dark" cross-product. `system` is a first-class appearance choice, not a checkbox, so a user can always get back to following the OS. Base UI supplies `menuitemradio`, typeahead, roving focus, Escape and focus restore. The choice persists to `localStorage`; ship `THEME_SCRIPT` in `<head>` or the page will flash on reload. For a nav bar with no room for a menu, use `ThemeSchemeToggle` (see the SchemeToggle story) — it deliberately cannot reach `system`.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'default'],
      description: 'Trigger height: sm 32px · default 36px.',
      table: {
        category: 'Appearance',
        type: { summary: "'sm' | 'default'" },
        defaultValue: { summary: "'default'" },
      },
    },
    label: {
      control: 'text',
      description:
        'Accessible name for the trigger, and the visible fallback text before a theme resolves. Below the `sm` breakpoint the text is hidden and this is the only name the button has.',
      table: {
        category: 'A11y',
        type: { summary: 'string' },
        defaultValue: { summary: "'Theme'" },
      },
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description:
        'Popup alignment against the trigger. `end` keeps a right-hand nav button from pushing the menu off-screen.',
      table: {
        category: 'Placement',
        type: { summary: "'start' | 'center' | 'end'" },
        defaultValue: { summary: "'end'" },
      },
    },
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left', 'inline-start', 'inline-end'],
      description:
        'Which side of the trigger the popup opens on. Leave unset to let the positioner choose and flip when space runs out.',
      table: {
        category: 'Placement',
        type: { summary: "'top' | 'right' | 'bottom' | 'left' | 'inline-start' | 'inline-end'" },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the trigger. Rarely right — a user can always change their own theme.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the trigger only; the popup is not configurable from here.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    size: 'default',
    label: 'Theme',
    align: 'end',
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof ThemeSwitcher>;

/**
 * Shown against a strip of the surfaces the choice actually repaints, so the
 * effect of picking a theme is visible in the same frame as the control.
 */
export const Default: Story = {
  render: (args) => (
    <div className="flex w-[420px] max-w-full flex-col gap-md rounded-md border border-border bg-card p-md">
      <div className="flex items-center justify-between gap-md">
        <span className="text-ui-sm text-muted-foreground">Appearance</span>
        <ThemeSwitcher {...args} />
      </div>
      <div className="flex flex-wrap items-center gap-xs">
        <span className="rounded-md bg-primary px-3 py-1 text-ui-sm text-primary-foreground">
          primary
        </span>
        <span className="rounded-md bg-muted px-3 py-1 text-ui-sm text-muted-foreground">
          muted
        </span>
        <span className="rounded-md border border-border px-3 py-1 text-ui-sm">
          border
        </span>
      </div>
    </div>
  ),
};

export const Small: Story = {
  args: { size: 'sm' },
  render: (args) => <ThemeSwitcher {...args} />,
};

/**
 * The compact form for a nav bar: one click, light ⇄ dark, `aria-pressed`
 * carrying the state. It deliberately cannot reach "system" — see the
 * component's header for why a three-state control with one affordance is
 * unusable without a legend.
 */
export const SchemeToggle: Story = {
  render: () => <ThemeSchemeToggle />,
};

/**
 * Keyboard-only flow per the APG menu-button pattern: Enter opens the menu
 * AND moves focus into it, arrows rove between the radio items, Escape
 * closes and returns focus to the trigger.
 *
 * Axe cannot press a key — it renders the menu closed and reports green on
 * a control with no keyboard path to open at all. This is the gate.
 */
export const KeyboardFlow: Story = {
  render: () => <ThemeSwitcher />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /theme/i });

    await step('The trigger advertises the menu it owns', async () => {
      await waitFor(() => {
        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
      });
    });

    await step('Enter opens the menu and focuses a radio item', async () => {
      // Tab rather than .focus(): userEvent keeps its own notion of the
      // focused element, and a raw focus() call leaves its keyboard dispatch
      // pointed at the document.
      await userEvent.tab();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(document.querySelector('[role="menu"]')).toBeTruthy(),
      );
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('role')).toBe(
          'menuitemradio',
        ),
      );
    });

    await step('The active theme is announced as checked', async () => {
      const checked = document.querySelectorAll(
        '[role="menuitemradio"][aria-checked="true"]',
      );
      // One per radio group: the theme, and the appearance preference.
      expect(checked.length).toBe(2);
    });

    await step('ArrowDown roves to the next item', async () => {
      const first = document.activeElement;
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(document.activeElement).not.toBe(first));
      expect(document.activeElement?.getAttribute('role')).toBe(
        'menuitemradio',
      );
    });

    await step('Escape closes and restores focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(document.querySelector('[role="menu"]')).toBeFalsy(),
      );
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
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

export const ReducedMotion: Story = {
  ...Default,
  decorators: [withReducedMotion],
};
