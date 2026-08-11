'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { useTheme } from '@interlace/ui/use-theme';
import {
  SCHEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from '@interlace/ui/theme-script';
import {
  ThemeSchemeToggle,
  ThemeSwitcher,
} from '@interlace/ui/theme-switcher';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `useTheme` — the hook's state and the DOM it projects, side by side.
 *
 * The hook owns two orthogonal axes and writes both onto `<html>`:
 *
 *   theme   →  `data-theme="<name>"`   (the DEFAULT theme is the ABSENCE of
 *                                       the attribute — `:root` already is it)
 *   scheme  →  `class="dark"` + `style.color-scheme`
 *
 * A theme hook is the kind of thing that is easy to describe and hard to
 * believe, because every claim it makes is about an element the reader
 * cannot see. So this story prints both halves at once: the hook's return
 * value on the left, the live attributes of `document.documentElement` on
 * the right, kept current by a `MutationObserver`. Click a control, watch
 * both columns move together. If they ever disagree, the hook is lying.
 *
 * ─── `schemePreference` is not `scheme` ───────────────────────────
 *
 * `schemePreference` is what the user CHOSE (`light | dark | system`);
 * `scheme` is what that resolves to right now. Conflating them is why so
 * many switchers stop following the OS after one click: storing the
 * RESOLVED value turns "follow my system" into "dark, forever, because it
 * happened to be dark when I clicked".
 *
 * ─── Why `mounted` exists ─────────────────────────────────────────
 *
 * The hook starts at the defaults on both server and client and syncs from
 * `localStorage` in an effect — reading storage in a `useState` initialiser
 * would produce different markup on server and client and React would throw
 * the tree away. The page itself does not flash (`THEME_SCRIPT` painted the
 * right colours before first paint); only a control's own checkmark settles
 * a frame late, which is what `mounted` is for.
 */

// ── Live view of what the hook wrote to <html> ──────────────────────────────
//
// A MutationObserver rather than reading during render: the Storybook theme
// decorator writes to the SAME element, and a value sampled during render is
// stale the moment anything else touches the attribute. Observing means the
// panel is a mirror of the DOM rather than a second opinion about it.

type RootState = {
  dataTheme: string | null;
  hasDarkClass: boolean;
  colorScheme: string;
};

const readRoot = (): RootState => {
  const root = document.documentElement;
  return {
    dataTheme: root.getAttribute('data-theme'),
    hasDarkClass: root.classList.contains('dark'),
    colorScheme: root.style.colorScheme || '(unset)',
  };
};

function useRootState(): RootState {
  const [state, setState] = React.useState<RootState>(() => ({
    dataTheme: null,
    hasDarkClass: false,
    colorScheme: '(unset)',
  }));

  React.useEffect(() => {
    const sync = () => setState(readRoot());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  return state;
}

// ── Key/value row ───────────────────────────────────────────────────────────

function Row({
  name,
  value,
  note,
  slot,
}: {
  name: string;
  value: string;
  note?: string;
  slot?: string;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-xs border-b border-border py-2 last:border-b-0"
      data-slot={slot}
    >
      <Typography variant="code" as="code" className="text-muted-foreground">
        {name}
      </Typography>
      <Typography variant="code" as="code" data-slot={slot && `${slot}-value`}>
        {value}
      </Typography>
      {note ? (
        <Typography variant="caption" tone="muted" className="w-full">
          {note}
        </Typography>
      ) : null}
    </div>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

function Specimen() {
  const { theme, scheme, schemePreference, themes, mounted } = useTheme();
  const root = useRootState();

  return (
    <Stack gap="lg" className="w-full" data-slot="use-theme-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          useTheme()
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          Two axes, one element. The left column is what the hook returns; the
          right column is what <code className="font-mono">&lt;html&gt;</code>{' '}
          actually carries, read through a{' '}
          <code className="font-mono">MutationObserver</code>. Use the controls
          below and watch both move together.
        </Typography>
      </Stack>

      <div className="grid gap-md md:grid-cols-2">
        <Box
          border
          radius="md"
          padding="md"
          className="bg-background"
          data-slot="use-theme-hook"
        >
          <Stack gap="sm">
            <Typography variant="h4" as="h3">
              What the hook returns
            </Typography>
            <div>
              <Row name="theme" value={theme} slot="hook-theme" />
              <Row
                name="scheme"
                value={scheme}
                note="Resolved — what is on screen right now."
                slot="hook-scheme"
              />
              <Row
                name="schemePreference"
                value={schemePreference}
                note="Chosen. 'system' means follow prefers-color-scheme."
                slot="hook-preference"
              />
              <Row
                name="mounted"
                value={String(mounted)}
                note="false until the first client effect has read localStorage."
              />
              <Row
                name="themes"
                value={themes.map((t) => t.name).join(' · ')}
                note="The registry, for rendering a picker."
              />
            </div>
          </Stack>
        </Box>

        <Box
          border
          radius="md"
          padding="md"
          className="bg-background"
          data-slot="use-theme-root"
        >
          <Stack gap="sm">
            <Typography variant="h4" as="h3">
              What <code className="font-mono">&lt;html&gt;</code> carries
            </Typography>
            <div>
              <Row
                name="data-theme"
                value={root.dataTheme ?? '(absent)'}
                note="Absent IS the default theme — :root already is Interlace, so writing the name would be a selector nothing defines."
                slot="root-data-theme"
              />
              <Row
                name="class~=dark"
                value={String(root.hasDarkClass)}
                note="shadcn / next-themes canon. The scheme axis."
                slot="root-dark"
              />
              <Row
                name="style.color-scheme"
                value={root.colorScheme}
                note="Not decoration — this is what paints scrollbars, form controls and the pre-CSS canvas in the matching scheme."
                slot="root-color-scheme"
              />
            </div>
          </Stack>
        </Box>
      </div>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-card"
        data-slot="use-theme-controls"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            The controls that write to it
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            <code className="font-mono">ThemeSwitcher</code> is the two-radio-
            group menu (theme × appearance);{' '}
            <code className="font-mono">ThemeSchemeToggle</code> is the
            one-click light&nbsp;⇄&nbsp;dark form for a nav bar. Both are thin
            shells over this hook — no provider, no context. The{' '}
            <code className="font-mono">&lt;html&gt;</code> element is the
            shared state, and a module-level subscriber list is what keeps two
            instances in one document from disagreeing.
          </Typography>
          <div className="flex flex-wrap items-center gap-sm">
            <ThemeSwitcher />
            <ThemeSchemeToggle />
          </div>
        </Stack>
      </Box>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="use-theme-storage"
      >
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            Persistence
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            Written to{' '}
            <code className="font-mono">{THEME_STORAGE_KEY}</code> and{' '}
            <code className="font-mono">{SCHEME_STORAGE_KEY}</code>. The scheme
            key is <em>removed</em> rather than set to{' '}
            <code className="font-mono">&quot;system&quot;</code>: absence is
            how the bootstrap script knows to consult the OS, and it keeps one
            representation of &ldquo;no preference&rdquo; instead of two. Every
            access is wrapped in <code className="font-mono">try</code> —
            Safari in private mode throws on <em>reading</em>{' '}
            <code className="font-mono">localStorage</code>, and a theme hook is
            not worth a blank page.
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

// ── Storage helpers for the stories ─────────────────────────────────────────
//
// Stories that need a specific STORED state set it in `beforeEach` and undo
// it in the returned cleanup. Leaving a key behind would follow the browser
// into every later story in the same test-runner session and silently repaint
// them — the hook is doing exactly what it promises, which is what makes the
// leak hard to spot.

const withStoredScheme = (value: string | null) => async () => {
  const previous = window.localStorage.getItem(SCHEME_STORAGE_KEY);
  if (value === null) window.localStorage.removeItem(SCHEME_STORAGE_KEY);
  else window.localStorage.setItem(SCHEME_STORAGE_KEY, value);
  return () => {
    if (previous === null) window.localStorage.removeItem(SCHEME_STORAGE_KEY);
    else window.localStorage.setItem(SCHEME_STORAGE_KEY, previous);
  };
};

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Utilities/useTheme',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The runtime half of the two-axis theme contract, shown as its own state next to the `<html>` attributes it writes — the right-hand column is a live `MutationObserver` mirror of `document.documentElement`, not a restatement of the left. `data-theme` is absent for the default theme on purpose (`:root` already is it). `schemePreference` and `scheme` are separate values: storing the resolved one is why so many switchers stop following the OS after a single click. There is no provider and no context — the `<html>` element is the shared state, and a module-level subscriber list broadcasts writes to every live instance in the document, which is what fixed embedded previews staying Interlace-orange while the page around them repainted into Harbor.',
      },
    },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The thumbnail. `beforeEach` clears the stored scheme so the hook starts at
 * `'system'` — otherwise a preference left behind by an earlier story decides
 * what this one looks like.
 */
export const Default: Story = {
  tags: ['preview'],
  beforeEach: withStoredScheme(null),
};

/**
 * The click, end to end: press the scheme toggle and both columns move —
 * the hook's `scheme` and the `.dark` class on `<html>` — then press it back.
 *
 * It ends where it started deliberately. The hook persists, so a story that
 * leaves the scheme flipped hands the next story a dark page it never asked
 * for.
 */
export const ToggleScheme: Story = {
  beforeEach: withStoredScheme(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = document.documentElement;
    const toggle = canvas.getByRole('button', { name: /dark mode/i });

    const before = root.classList.contains('dark');

    await userEvent.click(toggle);
    await waitFor(() =>
      expect(root.classList.contains('dark')).toBe(!before),
    );

    // The panel is a mirror, so it must agree — this is the assertion that
    // the hook's state and the DOM did not drift apart.
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="root-dark-value"]')
          ?.textContent,
      ).toBe(String(!before)),
    );
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="hook-scheme-value"]')
          ?.textContent,
      ).toBe(before ? 'light' : 'dark'),
    );

    await userEvent.click(toggle);
    await waitFor(() => expect(root.classList.contains('dark')).toBe(before));
  },
};

/**
 * The dark twin, driven the honest way: a STORED `dark` preference, which is
 * what the hook would read on a real page load.
 *
 * Not the `withDark` decorator. This hook writes `.dark` onto `<html>` from
 * an effect, so a decorator that also writes it is in a race the decorator
 * loses — the hook resolves `'system'` (light, in a headless browser) and
 * strips the class a frame later. Seeding storage makes the hook itself the
 * thing that turns the page dark, which is both correct and the point.
 */
export const Dark: Story = {
  globals: { theme: 'dark' },
  beforeEach: withStoredScheme('dark'),
};

export const RTL: Story = {
  beforeEach: withStoredScheme(null),
  decorators: [withRtl],
};
