'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { useReducedMotion } from '@interlace/ui/use-reduced-motion';
import { Button } from '@interlace/ui/button';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withReducedMotion, withRtl } from '@/decorators';

/**
 * `useReducedMotion` — an animation with the preference wired to it.
 *
 * The hook is four lines and one media query, and the interesting part is
 * not the hook — it is that the reduced-motion contract has TWO carriers and
 * neither one covers the other:
 *
 *   CSS   `@media (prefers-reduced-motion: reduce)` in `preflight.css`
 *         clamps every `animation-duration` / `transition-duration` to
 *         0.01ms. It covers transitions and keyframes, globally, with no
 *         opt-out — and it cannot touch JavaScript.
 *
 *   JS    `useReducedMotion()` is what a `canvas` loop, a
 *         `requestAnimationFrame` ticker or a `motion/react` spring has to
 *         read, because none of those are CSS and the clamp never sees them.
 *
 * ─── Why this story has a "simulate" toggle ───────────────────────
 *
 * The hook reads `matchMedia('(prefers-reduced-motion: reduce)')`. Nothing
 * in a page can change that value — it belongs to the operating system — so
 * a story that claimed to "toggle the preference" would be lying about
 * where the value comes from.
 *
 * Instead the sample renders from `forced ?? live`: the LIVE row always
 * reports the real OS answer for the machine you are on, and the toggle
 * overrides only which BRANCH the sample takes, so both outcomes are visible
 * without pretending your system setting moved. The two facts are labelled
 * separately for exactly that reason.
 *
 * The `ReducedMotion` story below is the other half: it applies the story
 * decorator that injects the CSS clamp, and prints the live hook value next
 * to it — which stays `false`. That is not a bug in either one. It is the
 * demonstration that the CSS clamp and the JS gate are different mechanisms,
 * and that a component whose motion is driven from JavaScript needs the hook
 * even though the stylesheet already handles the CSS.
 */

// ── The gated sample ────────────────────────────────────────────────────────
//
// One dot, one rule: when `reduce` is true it does not animate at all and the
// state change is instant. `animate-bounce` and the static twin are literal
// class names so Tailwind emits both — a conditional built by template string
// is never scanned and silently emits nothing.

function MotionSample({ reduce }: { reduce: boolean }) {
  return (
    <div
      className="relative h-16 w-full overflow-hidden rounded-md border border-border bg-muted/40"
      data-slot="motion-sample"
      data-reduce={reduce ? 'true' : 'false'}
    >
      <span
        aria-hidden
        data-slot="motion-dot"
        className={
          reduce
            ? 'absolute left-1/2 top-6 block size-6 -translate-x-1/2 rounded-full bg-primary'
            : 'absolute left-1/2 top-6 block size-6 -translate-x-1/2 animate-bounce rounded-full bg-primary'
        }
      />
    </div>
  );
}

// ── Key/value row ───────────────────────────────────────────────────────────

function Fact({
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
    <div className="border-b border-border py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-xs">
        <Typography variant="code" as="code" className="text-muted-foreground">
          {name}
        </Typography>
        <Typography variant="code" as="code" data-slot={slot}>
          {value}
        </Typography>
      </div>
      {note ? (
        <Typography variant="caption" tone="muted">
          {note}
        </Typography>
      ) : null}
    </div>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

type ReducedMotionArgs = {
  /**
   * Which branch the sample starts on.
   * `null` = follow the live hook value.
   */
  forced: boolean | null;
};

function Specimen({ forced }: ReducedMotionArgs) {
  const live = useReducedMotion();
  const [override, setOverride] = React.useState<boolean | null>(forced);

  // Re-seed when the Controls panel changes the arg.
  React.useEffect(() => setOverride(forced), [forced]);

  const reduce = override ?? live;

  return (
    <Stack gap="lg" className="w-full" data-slot="use-reduced-motion-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          useReducedMotion()
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          The hook reads one media query and re-renders when it changes.
          Everything interesting is what you do with the answer — so the dot
          below is gated on it, and both branches are reachable.
        </Typography>
      </Stack>

      <div className="grid gap-md md:grid-cols-2">
        <Box
          border
          radius="md"
          padding="md"
          className="bg-background"
          data-slot="reduced-motion-state"
        >
          <Stack gap="sm">
            <Typography variant="h4" as="h3">
              State
            </Typography>
            <div>
              <Fact
                name="useReducedMotion()"
                value={String(live)}
                note="The real answer for this browser, right now. Nothing on the page can change it — flip 'Reduce motion' in your OS settings and this row moves on its own."
                slot="live-value"
              />
              <Fact
                name="branch taken"
                value={String(reduce)}
                note="What the sample is actually rendering from. Equals the live value until you override it below."
                slot="branch-value"
              />
            </div>
            <div className="flex flex-wrap items-center gap-sm">
              <Button
                variant="outline"
                size="sm"
                aria-pressed={reduce}
                onClick={() => setOverride(!reduce)}
                data-slot="reduce-toggle"
              >
                Simulate reduced motion: {reduce ? 'on' : 'off'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOverride(null)}
                data-slot="reduce-follow"
              >
                Follow the OS
              </Button>
            </div>
            <Typography variant="caption" tone="muted">
              The buttons override the BRANCH, not the preference — the hook
              still reports your system above.
            </Typography>
          </Stack>
        </Box>

        <Box
          border
          radius="md"
          padding="md"
          className="bg-background"
          data-slot="reduced-motion-sample"
        >
          <Stack gap="sm">
            <Typography variant="h4" as="h3">
              The gated animation
            </Typography>
            <MotionSample reduce={reduce} />
            <Typography variant="ui-sm" tone="muted">
              {reduce
                ? 'Reduced: the dot holds its position. Reduced motion is a quieter UI, not a non-functional one — the state it communicates is still there.'
                : 'Full motion: the dot bounces. Duration and easing come from the DS motion scale (see Foundations/Motion).'}
            </Typography>
          </Stack>
        </Box>
      </div>

      <Box
        border
        radius="md"
        padding="md"
        className="border-warning/40 bg-warning/10"
        data-slot="reduced-motion-carriers"
      >
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            Two carriers, and neither covers the other
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            <code className="font-mono">preflight.css</code> clamps every CSS
            animation and transition to 0.01ms under{' '}
            <code className="font-mono">
              @media (prefers-reduced-motion: reduce)
            </code>
            . That is global and has no opt-out — and it is blind to
            JavaScript. A <code className="font-mono">canvas</code> loop, a{' '}
            <code className="font-mono">requestAnimationFrame</code> ticker or
            a spring library keeps running at full amplitude unless something
            reads the preference and stops it. That something is this hook.
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Utilities/useReducedMotion',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The reduced-motion hook with an animation actually wired to it. The `useReducedMotion()` row is the real value for the current browser — nothing in a page can change a media query the OS owns — so the toggle overrides which BRANCH the sample renders rather than pretending the system setting moved; both facts are labelled separately. The `ReducedMotion` story applies the CSS-clamp decorator and shows the hook still reporting `false`, which is the point: the stylesheet clamp covers CSS animations and transitions globally and is blind to JavaScript, so canvas / rAF / spring motion has to read the hook.',
      },
    },
  },
  argTypes: {
    forced: {
      control: 'radio',
      options: [null, false, true],
      description:
        'Which branch the sample starts on. `null` follows the live hook value; `true` / `false` force one side so both are reachable in a screenshot.',
      table: {
        category: 'Demo',
        type: { summary: 'boolean | null' },
        defaultValue: { summary: 'null' },
      },
    },
  },
  args: {
    forced: null,
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The thumbnail, and the interaction gate: pressing the toggle must actually
 * change what the dot renders. A "reduced motion" prop that nothing reads is
 * the most common way this contract is fake, and only a click can catch it.
 */
export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: /simulate reduced/i });
    const dot = () =>
      canvasElement.querySelector('[data-slot="motion-dot"]') as HTMLElement;
    const sample = () =>
      canvasElement.querySelector('[data-slot="motion-sample"]') as HTMLElement;

    await expect(sample().dataset.reduce).toBe('false');
    await expect(dot().className).toContain('animate-bounce');

    await userEvent.click(toggle);

    await waitFor(() => expect(sample().dataset.reduce).toBe('true'));
    await expect(dot().className).not.toContain('animate-bounce');
    await expect(toggle.getAttribute('aria-pressed')).toBe('true');

    // Back, so the story's resting state is the one its thumbnail shows.
    await userEvent.click(toggle);
    await waitFor(() => expect(sample().dataset.reduce).toBe('false'));
  },
};

/** The reduced branch as a still, for the catalogue. */
export const Reduced: Story = {
  args: { forced: true },
};

/**
 * The CSS half of the contract: the decorator injects the same clamp that
 * `@media (prefers-reduced-motion: reduce)` applies in `preflight.css`, so
 * every animation and transition in the story collapses to ~0.
 *
 * The `useReducedMotion()` row stays `false`, and that is correct — injected
 * CSS does not change a media query. Seeing the two disagree is the clearest
 * statement of why both carriers exist.
 */
export const ReducedMotion: Story = {
  decorators: [withReducedMotion],
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
