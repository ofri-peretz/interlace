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
          'Theme (`data-theme`) × colour scheme (`.dark`) picker built on Base UI Menu — `menuitemradio` roles, typeahead, roving focus, Escape-to-close and focus restore all come from upstream. Persists to `localStorage`; pair it with `THEME_SCRIPT` in `<head>` so the choice survives a reload without a flash.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ThemeSwitcher>;

export const Default: Story = {
  render: () => <ThemeSwitcher />,
};

export const Small: Story = {
  render: () => <ThemeSwitcher size="sm" />,
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
