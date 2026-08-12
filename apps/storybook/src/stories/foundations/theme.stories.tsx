'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';
import { Button } from '@interlace/ui/button';
import { Input } from '@interlace/ui/input';
import { Label } from '@interlace/ui/label';

import { withRtl } from '@/decorators';

/**
 * `theme` — the CSS baseline, layer by layer.
 *
 * The `theme` registry item is not a component; it is the one import that
 * makes every other item look like itself:
 *
 * ```css
 * @import "tailwindcss";
 * @import "@interlace/ui/styles/index.css";
 * ```
 *
 * Before that barrel existed, consumers had to know — and repeat in order —
 * a five-file import chain, and a skipped file silently degraded half the
 * contract (omitting `preflight.css` cost the WCAG 2.2 SC 2.4.13 focus
 * ring). The barrel makes it one line, and CSS Cascade Layers make the order
 * self-documenting:
 *
 * ```css
 * @layer interlace.primitives, interlace.foundation, interlace.preflight,
 *        interlace.bridge, interlace.brand, interlace.semantics;
 * ```
 *
 * Left to right is ascending priority. The whole stack stays under the
 * `interlace.*` namespace so a consumer who wants to fork the brand declares
 * `@layer interlace.brand` AFTER importing and their declarations win
 * deterministically — without layers, brand override is source-order
 * roulette.
 *
 * ─── Why this page is not a palette ───────────────────────────────
 *
 * `Foundations/Colors` already specimens the semantic tokens with measured
 * contrast ratios and AA badges, and `Tokens/Theme Tokens` renders the
 * 55-property brand manifest. Repeating either here would be a second
 * source of truth for the same picture. What has no picture anywhere else
 * is the INSTALL CONTRACT — which layer owns what, and what visibly stops
 * working when one of them is missing. That is this page, and every row
 * proves its layer with a live element or a live computed value rather than
 * a description.
 */

// ── Live custom-property reads ──────────────────────────────────────────────

const PENDING = '…';

/**
 * Paint the resolved values into the DOM, and repaint when `<html>` changes.
 *
 * Two things this avoids, both of which bit before it existed.
 *
 * The scheme class is not on `<html>` when this mounts — the theme decorator
 * writes it several hundred milliseconds later — so a one-shot read prints
 * the LIGHT palette inside the dark story, under swatches that correctly
 * followed the cascade. A page about "a wrong value inherits instead of
 * erroring" cannot afford to be wrong that way.
 *
 * And it deliberately does not go through React state. Re-rendering when the
 * class lands restarts the a11y addon's axe scan, and the test-runner's own
 * `axe.run` then dies on "Axe is already running" — nondeterministically,
 * because it depends on when the class arrives. `textContent` mirrors an
 * external mutable source without asking React to reconcile anything, which
 * is what this is: a mirror of the cascade, not state.
 */
function useProbePainter(): void {
  React.useLayoutEffect(() => {
    const paint = () => {
      const styles = getComputedStyle(document.documentElement);
      const read = (name: string) => styles.getPropertyValue(name).trim();

      // Document-scoped rather than ref-scoped: the values come from
      // `<html>`, so every probe on the page — including the several stories
      // an autodocs page mounts at once — wants the same answer.
      for (const el of document.querySelectorAll<HTMLElement>('[data-probe]')) {
        el.textContent = read(el.dataset.probe ?? '') || PENDING;
      }

      // The alias chain the `interlace.semantics` layer exists to create.
      // Reported rather than assumed: a stylesheet that loaded partially
      // leaves `--primary` resolving to nothing, and the page would otherwise
      // look merely a little grey.
      const primary = read('--primary');
      const brand = read('--interlace-primary');
      const ok = primary !== '' && primary === brand;
      for (const check of document.querySelectorAll<HTMLElement>(
        '[data-slot="theme-alias-check"]',
      )) {
        check.textContent = ok
          ? '--primary resolves to the same value as --interlace-primary — the alias chain is intact.'
          : 'The alias chain is BROKEN: --primary does not resolve to --interlace-primary.';
        check.classList.toggle('text-destructive', !ok);
        check.classList.toggle('text-muted-foreground', ok);
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

// ── One layer row ───────────────────────────────────────────────────────────

function LayerRow({
  layer,
  file,
  owns,
  children,
}: {
  layer: string;
  file: string;
  owns: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="theme-layer"
      data-layer={layer}
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <div className="flex flex-wrap items-baseline justify-between gap-xs">
            <Typography variant="code" as="code" className="font-semibold">
              @layer {layer}
            </Typography>
            <Typography variant="caption" tone="muted" as="code">
              {file}
            </Typography>
          </div>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            {owns}
          </Typography>
        </Stack>
        <div className="rounded-md border border-border bg-card/40 p-sm">
          {children}
        </div>
      </Stack>
    </Box>
  );
}

function Probe({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-xs border-b border-border py-1 last:border-b-0">
      <Typography variant="code" as="code" className="text-muted-foreground">
        {name}
      </Typography>
      <Typography variant="code" as="code" className="break-all" data-probe={name}>
        {PENDING}
      </Typography>
    </div>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

function Specimen() {
  useProbePainter();

  return (
    <Stack gap="lg" className="w-full" data-slot="theme-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          The CSS baseline — six layers, one import
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          <code className="font-mono">
            npx shadcn add @interlace/theme
          </code>{' '}
          installs the stylesheets below. Each row names a layer, the file it
          comes from, what it owns, and shows the thing that stops working
          without it — a live element or a live computed value, never a
          description.
        </Typography>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
          <code className="font-mono text-code">{`@import "tailwindcss";
@import "@interlace/ui/styles/index.css";`}</code>
        </pre>
      </Stack>

      <LayerRow
        layer="interlace.primitives"
        file="styles/tokens.css"
        owns="Raw values: keyframes, motion timings, animation utility classes. No semantic meaning — the mechanical primitives everything else spends."
      >
        <Probe name="--animate-accordion-down" />
        <Typography variant="caption" tone="muted">
          Registered as a Tailwind theme key, so{' '}
          <code className="font-mono">animate-accordion-down</code> exists as a
          utility. This layer also enumerates every long-running animation in
          the <code className="font-mono">prefers-reduced-motion</code> clamp.
        </Typography>
      </LayerRow>

      <LayerRow
        layer="interlace.foundation"
        file="styles/foundation.css"
        owns="Type scale, spacing scale, radius, container widths, font families — brand-INVARIANT structure, registered as Tailwind theme tokens. Harbor and Interlace share every value in this layer."
      >
        <Stack gap="sm">
          <div>
            <Probe name="--text-body" />
            <Probe name="--text-ui-sm" />
            <Probe name="--spacing-md" />
            <Probe name="--radius-md" />
            <Probe name="--container-prose" />
          </div>
          <Stack gap="xs">
            <Typography variant="h4" as="p">
              Heading four
            </Typography>
            <Typography variant="body">
              Body — the 16px reading size at 1.6 line-height.
            </Typography>
            <Typography variant="ui-sm" tone="muted">
              ui-sm — 13px dense UI text.
            </Typography>
            <Typography variant="code" as="code">
              code — 14px monospace.
            </Typography>
          </Stack>
        </Stack>
      </LayerRow>

      <LayerRow
        layer="interlace.preflight"
        file="styles/preflight.css"
        owns="Token-aware baseline beyond Tailwind's own: body background and foreground, ::selection, the WCAG 2.2 SC 2.4.13 focus ring, scrollbar tint, ::placeholder contrast, and the [data-min-viewport] container contract."
      >
        <Stack gap="sm">
          <Typography variant="ui-sm" tone="muted">
            Tab to the control below. The ring is painted by{' '}
            <code className="font-mono">:focus-visible</code> in this layer —
            not by the Button — which is why dropping{' '}
            <code className="font-mono">preflight.css</code> silently costs
            every focusable element in the app its indicator.
          </Typography>
          <div className="flex flex-wrap items-end gap-sm">
            <Button variant="outline">Focusable</Button>
            <div className="grid gap-xs">
              <Label htmlFor="theme-preflight-input">
                Placeholder contrast
              </Label>
              <Input
                id="theme-preflight-input"
                placeholder="AA against every surface"
              />
            </div>
          </div>
        </Stack>
      </LayerRow>

      <LayerRow
        layer="interlace.bridge"
        file="styles/theme.css"
        owns="The fumadocs ↔ shadcn token bridge. Fumadocs ships the --color-fd-* family and not the unprefixed shadcn names, so an app that uses both would otherwise run two colour stories side by side."
      >
        <pre className="overflow-x-auto">
          <code className="font-mono text-code">{`:root {
  --background: var(--color-fd-background);
  --foreground: var(--color-fd-foreground);
  --card:       var(--color-fd-card);
  /* … */
}`}</code>
        </pre>
        <Typography variant="caption" tone="muted">
          Inert in an app with no fumadocs — the later{' '}
          <code className="font-mono">interlace.semantics</code> layer wins.
          That ordering is the whole reason the layers are declared rather
          than imported and hoped for.
        </Typography>
      </LayerRow>

      <LayerRow
        layer="interlace.brand"
        file="styles/interlace-theme.css"
        owns="Concrete brand values — the --interlace-* literals, light and dark. THE supported consumer override surface: fork this layer to re-brand and nothing else has to move."
      >
        <Stack gap="sm">
          <div className="flex flex-wrap items-center gap-sm">
            {['primary', 'background', 'foreground', 'muted', 'border'].map(
              (name) => (
                <div key={name} className="flex items-center gap-xs">
                  <span
                    aria-hidden
                    className="block size-6 rounded-sm border border-border"
                    style={{ backgroundColor: `var(--interlace-${name})` }}
                  />
                  <Typography variant="caption" tone="muted" as="code">
                    {name}
                  </Typography>
                </div>
              ),
            )}
          </div>
          <Typography variant="caption" tone="muted">
            Five of {`55`}. The full manifest, with live values, is{' '}
            <strong>Tokens/Theme Tokens</strong>; the measured contrast table
            for the semantic aliases is <strong>Foundations/Colors</strong>.
          </Typography>
        </Stack>
      </LayerRow>

      <LayerRow
        layer="interlace.semantics"
        file="styles/interlace-theme.css"
        owns="The alias bindings — --background, --foreground, --primary, --ring … mapped onto the --interlace-* brand values — plus the Tailwind v4 @theme inline registration that makes bg-primary and friends resolve at all."
      >
        <Stack gap="sm">
          <div>
            <Probe name="--interlace-primary" />
            <Probe name="--primary" />
            <Probe name="--interlace-background" />
            <Probe name="--background" />
          </div>
          <Typography
            variant="ui-sm"
            className="text-muted-foreground"
            data-slot="theme-alias-check"
          >
            Checking the alias chain{'\u2026'}
          </Typography>
        </Stack>
      </LayerRow>
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Foundations/Theme',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'What `npx shadcn add @interlace/theme` actually installs: six cascade layers, each proved by a live element or a live computed value rather than described. Deliberately NOT a palette — `Foundations/Colors` specimens the semantic tokens with contrast ratios and `Tokens/Theme Tokens` renders the 55-property brand manifest; duplicating either would create a second source of truth for the same picture. What had no picture anywhere was the install contract: which layer owns what, and what stops working when one is missing (drop `preflight.css` and every focusable element in the app silently loses its WCAG 2.2 SC 2.4.13 ring). The last row asserts the alias chain live — `--primary` must resolve to `--interlace-primary`.',
      },
    },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    // Six layers, and the alias chain the sixth one exists to create. A
    // stylesheet that loaded partially reports here rather than looking
    // slightly wrong.
    const rows = canvasElement.querySelectorAll('[data-slot="theme-layer"]');
    await expect(rows.length).toBe(6);
    await expect(
      canvasElement.querySelector('[data-slot="theme-alias-check"]')
        ?.textContent,
    ).toContain('intact');

    // The probes must report the scheme the story is actually rendering in.
    // A value read before the theme class landed prints the light palette on
    // a dark page — the swatches follow the cascade and the labels do not,
    // and the page silently contradicts itself. `waitFor` because the class
    // arrives on its own schedule; the assertion does not change.
    await waitFor(() => {
      const dark = document.documentElement.classList.contains('dark');
      const background = canvasElement
        .querySelector('[data-probe="--interlace-background"]')
        ?.textContent?.trim()
        .toLowerCase();
      expect(background).toBe(dark ? '#0a0a0a' : '#fff');
    });
  },
};

/** The dark twin runs the same play — the probes must report DARK values. */
export const Dark: Story = {
  ...Default,
  tags: [],
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
