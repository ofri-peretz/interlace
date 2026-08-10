'use client';

/**
 * @interlace/ui — ThemeSwitcher + ThemeSchemeToggle
 *
 * The UI half of the two-axis theme contract (`styles/index.css`,
 * `src/lib/use-theme.ts`). Two controls, because the two axes are genuinely
 * different questions and a single control that tries to serve both ends up
 * as a four-item list called "Light / Dark / Harbor / Harbor Dark" — a
 * cross-product that grows multiplicatively with every theme added.
 *
 *   ThemeSwitcher       menu: which THEME  ×  which SCHEME  (two radio groups)
 *   ThemeSchemeToggle   one-click light ⇄ dark, for a nav bar
 *
 * Behaviour lives in `useTheme()`; Base UI owns the a11y (roles, roving
 * focus, typeahead, Escape, focus restore, `aria-checked` / `aria-pressed`).
 * This file owns the pixels and nothing else.
 *
 * ## Anatomy
 *
 *   <ThemeSwitcher>                       ← DropdownMenuTrigger (button)
 *     └ popup                             ← data-min-viewport, role="menu"
 *        ├ "Theme"        radiogroup      ← one item per registered theme
 *        ├ separator
 *        └ "Appearance"   radiogroup      ← Light / Dark / System
 *
 *   <ThemeSchemeToggle>                   ← Base UI Toggle, aria-pressed
 *
 * ## MIN_VIEWPORT — 320
 *
 * The trigger collapses to its icon below `sm` (the label is `hidden
 * sm:inline`), so it is a 32–36px square at the 320 floor — clear of the
 * WCAG 2.5.5 target-size minimum. The popup is `min-w-48` and Base UI's
 * positioner shifts it into view, so it fits a 320 column.
 *
 * | Rule | Concept                          | Where in this file                                             |
 * | ---- | -------------------------------- | -------------------------------------------------------------- |
 * | R4   | Extends the underlying part      | `ComponentProps<typeof DropdownMenuTrigger> & VariantProps<…>`   |
 * | R6   | data-slot on every part          | `theme-switcher` / `-content` / `-item` / `theme-scheme-toggle` |
 * | R7   | className merged + ...rest       | `cn(themeSwitcherVariants(…), className)` + `{...props}`        |
 * | R8   | No `isXxx`; enums for >2 states  | `size` (sm/default); scheme is a 3-value enum, not a boolean     |
 * | R11  | One variable per part            | Trigger owns `size`; the menu owns nothing configurable          |
 * | R12  | Reuse over wrap                  | Composes DropdownMenu / Toggle rather than re-implementing them  |
 * | R13  | Ecosystem first                  | `@base-ui/react/menu` owns menuitemradio + typeahead + Escape    |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const      |
 * | R17  | API parity                       | `value`/`onValueChange` naming inherited from Base UI + MUI      |
 * | R18  | Tailwind only                    | Zero inline `style`; cva classes only                            |
 * | R19  | Tokens only                      | bg-background / text-foreground / ring — no hex, no palette escape |
 * | R20  | AA contrast                      | Every pair is a theme token measured by `theme-contract-lock`     |
 * | R25  | Client component                 | localStorage + matchMedia + DOM writes                           |
 * | R26  | A11y from upstream               | role=menuitemradio + aria-checked (menu), aria-pressed (toggle)  |
 *
 * ## Why no colour swatches
 *
 * The obvious flourish — a dot per theme painted in that theme's primary —
 * cannot be done honestly today. A swatch would need `[data-theme='X']` on
 * the dot itself, and the default theme has no such selector (it IS `:root`),
 * so the Interlace dot would silently paint in whatever theme is currently
 * active. A dot that lies about which brand it represents is worse than no
 * dot; the check indicator carries the state instead. Adding
 * `[data-theme='interlace']` as an alias for `:root` would fix it and is a
 * contract change, not a component change.
 *
 * ## Out of scope
 *
 * No provider, no context, no SSR theme cookie. The `<html>` element is the
 * shared state and `THEME_SCRIPT` (see `lib/theme-script.ts`) is what makes
 * it correct before first paint — a consumer that skips the script gets a
 * working switcher and a flash on reload, which is a documentation problem,
 * not one more moving part in here.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useTheme, type SchemePreference } from '../lib/use-theme.js';
import type { ThemeName } from '../lib/theme-tokens.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import { Toggle } from './toggle.js';

/**
 * Minimum viable viewport (CSS px) for this primitive — DESIGN_PRINCIPLES #14.
 */
export const MIN_VIEWPORT = 320 as const;

/**
 * The appearance axis, as the user sees it.
 *
 * `system` is FIRST-CLASS, not a checkbox hidden under the other two: it is
 * the state a user is in before they touch anything, and a switcher with no
 * way back to it turns one click into a permanent override of the OS
 * setting. (This is why `useTheme` keeps `schemePreference` separate from
 * the resolved `scheme`.)
 */
const SCHEME_OPTIONS: ReadonlyArray<{
  value: SchemePreference;
  label: string;
  Icon: typeof SunIcon;
}> = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: MonitorIcon },
];

const themeSwitcherVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors',
    'border-input bg-background text-foreground',
    'hover:bg-accent hover:text-accent-foreground',
    // `focus-visible:`, never bare `focus:` — a ring painted on mouse clicks
    // trains reviewers to read "ring present" as "keyboard affordance
    // present", and it is the first thing trimmed for looking noisy.
    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
    'disabled:pointer-events-none disabled:opacity-50',
    'data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ),
  {
    variants: {
      size: {
        sm: 'h-8 px-2 text-ui-sm',
        default: 'h-9 px-3 text-ui-sm',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

interface ThemeSwitcherProps
  extends Omit<React.ComponentProps<typeof DropdownMenuTrigger>, 'render'>,
    VariantProps<typeof themeSwitcherVariants> {
  /** Accessible name for the trigger. Default: `'Theme'`. */
  label?: string;
  /** Popup alignment against the trigger. */
  align?: React.ComponentProps<typeof DropdownMenuContent>['align'];
  /** Popup side. */
  side?: React.ComponentProps<typeof DropdownMenuContent>['side'];
}

const ThemeSwitcher = React.forwardRef<HTMLButtonElement, ThemeSwitcherProps>(
  function ThemeSwitcher(
    { className, size, label = 'Theme', align = 'end', side, ...props },
    ref,
  ) {
    const {
      theme,
      setTheme,
      scheme,
      schemePreference,
      setScheme,
      themes,
      mounted,
    } = useTheme();

    const active = SCHEME_OPTIONS.find(
      (option) => option.value === schemePreference,
    );
    // `??` rather than `!`: an unknown preference must still render an icon.
    const TriggerIcon = active?.Icon ?? SunIcon;
    const activeTheme = themes.find((entry) => entry.name === theme);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={ref}
          data-slot="theme-switcher"
          data-min-viewport={String(MIN_VIEWPORT)}
          // Reflected so a consumer can style off the active pair, and so an
          // e2e test can assert what the control BELIEVES independently of
          // what the <html> element says. When those two disagree, the bug is
          // worth finding.
          data-theme-value={theme}
          data-scheme-value={scheme}
          aria-label={label}
          className={cn(themeSwitcherVariants({ size }), className)}
          {...props}
        >
          <TriggerIcon aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">
            {activeTheme ? activeTheme.label : label}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          data-slot="theme-switcher-content"
          align={align}
          side={side}
          className="min-w-48"
        >
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value: ThemeName) => setTheme(value)}
          >
            {themes.map((entry) => (
              <DropdownMenuRadioItem
                key={entry.name}
                data-slot="theme-switcher-item"
                value={entry.name}
                // `aria-checked` comes from Base UI's menuitemradio role.
                // `aria-current` is the extra signal for "this is the one in
                // effect right now" — and it is suppressed until `mounted`,
                // because before the storage read the hook is reporting the
                // DEFAULT, not the user's choice, and announcing the wrong
                // one is worse than announcing nothing.
                aria-current={mounted && entry.name === theme ? 'true' : undefined}
              >
                {entry.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={schemePreference}
            onValueChange={(value: SchemePreference) => setScheme(value)}
          >
            {SCHEME_OPTIONS.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                data-slot="theme-switcher-item"
                value={option.value}
                aria-current={
                  mounted && option.value === schemePreference
                    ? 'true'
                    : undefined
                }
              >
                <option.Icon aria-hidden="true" className="size-4" />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
ThemeSwitcher.displayName = 'ThemeSwitcher';

interface ThemeSchemeToggleProps
  extends Omit<
    React.ComponentProps<typeof Toggle>,
    'pressed' | 'defaultPressed' | 'onPressedChange' | 'value'
  > {
  /** Accessible name. Default: `'Dark mode'`. */
  label?: string;
}

/**
 * One-click light ⇄ dark, for a nav bar that has no room for a menu.
 *
 * Deliberately does NOT cycle through `system`: a three-state control with
 * one affordance is unusable without a legend, and `aria-pressed` is a
 * boolean by definition. A user who wants "follow my OS" back reaches for
 * `ThemeSwitcher` — which is why the two ship together and why this one
 * writes an explicit preference rather than pretending to be neutral.
 */
const ThemeSchemeToggle = React.forwardRef<
  HTMLButtonElement,
  ThemeSchemeToggleProps
>(function ThemeSchemeToggle({ className, label = 'Dark mode', ...props }, ref) {
  const { scheme, setScheme } = useTheme();
  const dark = scheme === 'dark';

  return (
    <Toggle
      ref={ref}
      data-slot="theme-scheme-toggle"
      data-min-viewport={String(MIN_VIEWPORT)}
      aria-label={label}
      // Base UI projects this onto `aria-pressed` — the correct ARIA for a
      // two-state button (a switch role would demand on/off semantics the
      // user never sees).
      pressed={dark}
      onPressedChange={(pressed: boolean) =>
        setScheme(pressed ? 'dark' : 'light')
      }
      className={cn('size-9 p-0', className)}
      {...props}
    >
      {dark ? (
        <MoonIcon aria-hidden="true" className="size-4" />
      ) : (
        <SunIcon aria-hidden="true" className="size-4" />
      )}
    </Toggle>
  );
});
ThemeSchemeToggle.displayName = 'ThemeSchemeToggle';

export { ThemeSwitcher, ThemeSchemeToggle, themeSwitcherVariants };
export type { ThemeSwitcherProps, ThemeSchemeToggleProps };
