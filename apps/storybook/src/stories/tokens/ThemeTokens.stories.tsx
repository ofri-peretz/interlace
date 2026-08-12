'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

import {
  DEFAULT_THEME,
  SCHEMES,
  THEMES,
  THEME_TOKENS,
} from '@interlace/ui/theme-tokens';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `theme-tokens` — the manifest, rendered.
 *
 * `THEME_TOKENS` enumerates every `--interlace-*` custom property a theme
 * MUST define, in both colour schemes. It is data rather than CSS for one
 * reason: **a missing token does not throw.** CSS has no notion of
 * "undeclared" at this level — the value simply resolves from whatever rule
 * of lower specificity matched, which for a theme file is the PREVIOUS theme
 * in the cascade. A theme that forgets `--interlace-card` renders one surface
 * in the other brand's colour on a page that is otherwise perfect, and nobody
 * files a bug because nobody can name what is wrong.
 *
 * So the manifest is the input to `theme-contract-lock.test.ts`, which fails
 * on a theme missing a token, on a theme inventing one outside the list (a
 * typo is silent for exactly the same reason), and on any theme × scheme
 * whose measured contrast drops below the WCAG 2.2 floors.
 *
 * ─── What this specimen is, and is not ────────────────────────────
 *
 * Every row is generated from the `THEME_TOKENS` export and painted with
 * `var(--interlace-<name>)`, with the resolved value read back through
 * `getComputedStyle(document.documentElement)` and repainted whenever
 * `<html>` changes — see `useTokenValuePainter` for why that matters more
 * than it looks. Nothing is transcribed: add a token to the manifest and a
 * row appears here on the next reload, already showing whatever the live
 * cascade produces.
 *
 * It is the CONTRACT, not the palette. `Foundations/Colors` specimens the
 * shadcn-bare semantic tokens (`--background`, `--primary`, …) with contrast
 * ratios and AA badges; those are the ALIASES. This page is the layer
 * underneath them — the brand values the aliases point at, and the list a
 * new theme has to satisfy in full before it is allowed to exist.
 *
 * Inline `style` is used for the swatches, which the DS forbids in shipped
 * components (R18). There is no alternative here and it is not a shortcut:
 * Tailwind emits a utility per THEME key, and `--interlace-*` are brand
 * values that are deliberately not registered as utilities — they are what
 * the utilities resolve THROUGH. A story that painted them with
 * `bg-primary` would be specimening the alias while claiming to specimen the
 * token.
 */

// ── Token kinds ─────────────────────────────────────────────────────────────
//
// Derived from the name rather than listed, so a new `radius-*` step needs no
// edit here. Everything else in the manifest is a colour; if that ever stops
// being true the row renders as a swatch of nothing, which is visible — the
// failure mode this whole file is about is the one you CANNOT see.

const isLengthToken = (name: string): boolean => name.startsWith('radius-');

const PENDING = '…';

/**
 * Paint the resolved values straight into the DOM, and repaint whenever
 * `<html>` changes.
 *
 * Not React state, and both halves of that are deliberate.
 *
 * **Why it repaints.** The scheme class does not exist when this component
 * first mounts — the theme decorator writes it onto `<html>` several hundred
 * milliseconds later. A one-shot read therefore captures the LIGHT values and
 * prints them under dark swatches: the swatch is painted by
 * `var(--interlace-*)` and follows the cascade, the label does not, and the
 * two silently disagree. On a page whose entire subject is "a wrong value
 * inherits instead of erroring", that is the worst possible bug to have.
 *
 * **Why not state.** Re-rendering when the class lands would restart the a11y
 * addon's axe scan mid-flight, and the test-runner's own `axe.run` then dies
 * on "Axe is already running" — nondeterministically, since it depends on
 * when the class arrives. Writing `textContent` mirrors an external mutable
 * source (the CSS cascade on the root element) without asking React to
 * reconcile anything, which is exactly what this is: a mirror, not state.
 */
function useTokenValuePainter(): void {
  React.useLayoutEffect(() => {
    const paint = () => {
      const styles = getComputedStyle(document.documentElement);
      // Document-scoped rather than ref-scoped: the values come from
      // `<html>`, so every cell on the page — including the several stories
      // an autodocs page mounts at once — wants the same answer.
      for (const el of document.querySelectorAll<HTMLElement>(
        '[data-slot="theme-token-value"]',
      )) {
        const token = el.dataset.token;
        if (!token) continue;
        el.textContent =
          styles.getPropertyValue(`--interlace-${token}`).trim() || PENDING;
      }
    };

    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-scheme', 'style'],
    });
    return () => observer.disconnect();
  }, []);
}

// ── One token cell ──────────────────────────────────────────────────────────

function TokenCell({ name }: { name: string }) {
  const length = isLengthToken(name);

  return (
    <div
      className="rounded-md border border-border bg-background p-sm"
      data-slot="theme-token"
      data-token={name}
    >
      <Stack gap="xs">
        {length ? (
          <div
            aria-hidden
            className="h-10 w-full border-2 border-primary bg-muted"
            style={{ borderRadius: `var(--interlace-${name})` }}
          />
        ) : (
          <div
            aria-hidden
            className="h-10 w-full rounded-sm border border-border"
            style={{ backgroundColor: `var(--interlace-${name})` }}
          />
        )}
        <Typography variant="code" as="code" className="break-all">
          --interlace-{name}
        </Typography>
        <Typography
          variant="caption"
          tone="muted"
          as="code"
          className="break-all font-mono"
          data-slot="theme-token-value"
          data-token={name}
        >
          {PENDING}
        </Typography>
      </Stack>
    </div>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

function Specimen() {
  useTokenValuePainter();
  const combinations = THEME_TOKENS.length * SCHEMES.length * THEMES.length;

  return (
    <Stack gap="lg" className="w-full" data-slot="theme-tokens-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          The theme contract — {THEME_TOKENS.length} tokens
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          Every <code className="font-mono">--interlace-*</code> property a
          theme must declare, generated from the{' '}
          <code className="font-mono">THEME_TOKENS</code> export and painted
          with the live value. {THEME_TOKENS.length} tokens ×{' '}
          {SCHEMES.length} schemes × {THEMES.length} registered themes ={' '}
          <strong>{combinations}</strong> declarations that{' '}
          <code className="font-mono">theme-contract-lock</code> asserts on
          every run.
        </Typography>
      </Stack>

      <Box
        border
        radius="md"
        padding="md"
        className="border-warning/40 bg-warning/10"
        data-slot="theme-tokens-hazard"
      >
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            A missing token does not throw
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            It inherits — from whatever rule of lower specificity matched,
            which for a theme file is the previous theme in the cascade. So a
            theme that forgets one property renders a single surface in
            another brand&rsquo;s colour, on a page that is otherwise
            flawless. A typo is silent for the same reason, which is why the
            lock fails on tokens INVENTED outside this list as well as on
            tokens missing from it.
          </Typography>
        </Stack>
      </Box>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="theme-tokens-registry"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            The registry — {THEMES.length} themes
          </Typography>
          <ul className="grid gap-sm pl-0 md:grid-cols-2">
            {THEMES.map((theme) => (
              <li
                key={theme.name}
                className="rounded-md border border-border p-sm"
              >
                <Stack gap="xs">
                  <div className="flex flex-wrap items-baseline gap-xs">
                    <Typography variant="ui" className="font-semibold">
                      {theme.label}
                    </Typography>
                    <Typography variant="code" as="code" tone="muted">
                      {theme.name === DEFAULT_THEME
                        ? '(default — written as NO data-theme attribute)'
                        : `data-theme="${theme.name}"`}
                    </Typography>
                  </div>
                  <Typography variant="ui-sm" tone="muted">
                    {theme.description}
                  </Typography>
                </Stack>
              </li>
            ))}
          </ul>
          <Typography variant="caption" tone="muted" className="max-w-prose">
            The default writes no attribute at all: <code className="font-mono">
              :root
            </code>{' '}
            already is that theme, so an attribute would be a redundant
            selector to keep in sync — and it would make &ldquo;no
            preference&rdquo; and &ldquo;chose the default&rdquo;
            indistinguishable in the DOM.
          </Typography>
        </Stack>
      </Box>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="theme-tokens-grid"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            The manifest
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            In source order — the order of the{' '}
            <code className="font-mono">:root</code> block in{' '}
            <code className="font-mono">styles/interlace-theme.css</code>, from
            which the list is re-derived by the lock on every run. Switch the
            Theme toolbar to Harbor and every value below changes; the names
            cannot.
          </Typography>
          <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {THEME_TOKENS.map((token) => (
              <TokenCell key={token} name={token} />
            ))}
          </div>
        </Stack>
      </Box>
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Tokens/Theme Tokens',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The 55-token theme contract as a specimen: every row is generated from the `THEME_TOKENS` export, painted with `var(--interlace-<name>)`, and labelled with the value read back from `getComputedStyle(documentElement)`. It exists as data rather than CSS because a missing token does not throw — it inherits from the previous theme in the cascade, so a forgotten property renders one surface in another brand’s colour on an otherwise perfect page. This is the contract layer, not the palette: `Foundations/Colors` specimens the shadcn-bare aliases (`--background`, `--primary`) with contrast ratios; these are the brand values those aliases resolve through.',
      },
    },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    // The specimen is generated, so the only thing worth asserting is that
    // it is COMPLETE and that the values actually resolved — an empty cell
    // means the token is declared in the manifest and not in any stylesheet,
    // which is precisely the failure this page is about.
    const cells = canvasElement.querySelectorAll('[data-slot="theme-token"]');
    await expect(cells.length).toBe(THEME_TOKENS.length);

    const unresolved = [...cells]
      .filter(
        (cell) =>
          (cell.querySelector('[data-slot="theme-token-value"]')?.textContent ??
            PENDING) === PENDING,
      )
      .map((cell) => cell.getAttribute('data-token'));
    await expect(unresolved).toEqual([]);

    // The label must agree with the SCHEME the story is rendering in — a
    // value read before the theme class landed prints the light palette
    // under dark swatches, and the two disagree silently. `waitFor` because
    // the class arrives on its own schedule; the assertion is the same
    // either way.
    await waitFor(() => {
      const dark = document.documentElement.classList.contains('dark');
      const background =
        canvasElement
          .querySelector(
            '[data-token="background"] [data-slot="theme-token-value"]',
          )
          ?.textContent?.trim()
          .toLowerCase() ?? '';
      expect(background).toBe(dark ? '#0a0a0a' : '#fff');
    });
  },
};

/**
 * The dark twin runs the same play, which is the point: the labels must
 * report the DARK palette, not the light one read before the scheme class
 * arrived.
 */
export const Dark: Story = {
  ...Default,
  tags: [],
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
