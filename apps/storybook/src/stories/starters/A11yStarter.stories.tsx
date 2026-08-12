'use client';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { SkipLink } from '@interlace/ui/skip-link';
import { VisuallyHidden } from '@interlace/ui/visually-hidden';
import { FocusRing } from '@interlace/ui/focus-ring';
import { useReducedMotion } from '@interlace/ui/use-reduced-motion';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';
import { Button } from '@interlace/ui/button';

import { withRtl } from '@/decorators';

/**
 * `a11y-starter` — what one install actually gives you.
 *
 * ```sh
 * npx shadcn add @interlace/a11y-starter
 * ```
 *
 * The bundle is a meta-item: its `registryDependencies` pull `skip-link`,
 * `visually-hidden`, `focus-ring`, `use-reduced-motion` and the `theme` CSS
 * baseline, and the shadcn CLI walks the graph. A file list is what the
 * README already prints; what a file list cannot show is that these four
 * are a SET — each one covers a failure the others cannot reach, and a page
 * with three of them still fails.
 *
 * So this story is the composed result: a small page wired the way the
 * bundle expects, with each part labelled where it sits.
 *
 *   `SkipLink`         the first tab stop. WCAG 2.4.1 Bypass Blocks — a
 *                      keyboard user must be able to get past the header
 *                      and nav without tabbing through them on every page.
 *   `<main tabIndex={-1}>`  the other half of that: without the negative
 *                      tabindex the browser scrolls and leaves focus
 *                      stranded on the link, which looks like the skip link
 *                      doing nothing.
 *   `FocusRing`        the composable SC 2.4.13 focus contract, for the
 *                      cases where the element's own ring is clipped or
 *                      obscured by a parent.
 *   `VisuallyHidden`   text that only assistive tech reads — the carrier
 *                      for anything a sighted user gets from position,
 *                      colour or an icon.
 *   `useReducedMotion` the JS gate. CSS clamps CSS; anything driven from
 *                      JavaScript has to ask.
 *
 * Tab through it. The tab ORDER is the demonstration.
 */

// ── The composed page ───────────────────────────────────────────────────────

function StarterPage() {
  const reduce = useReducedMotion();

  return (
    <Box
      border
      radius="md"
      className="overflow-hidden bg-background"
      data-slot="a11y-starter-page"
    >
      {/* First element in the document order — the whole point of a skip
          link is that it is the FIRST tab stop, not merely present. */}
      <SkipLink href="#a11y-starter-main">Skip to main content</SkipLink>

      <div className="border-b border-border bg-card px-md py-sm">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <Typography variant="ui" className="font-semibold">
            A page assembled from the bundle
          </Typography>
          <Typography variant="caption" tone="muted">
            Press Tab — the skip link appears first, top-left.
          </Typography>
        </div>
      </div>

      <nav
        aria-label="Bundle demo"
        className="flex flex-wrap gap-sm border-b border-border px-md py-sm"
      >
        {['Overview', 'Install', 'Contract'].map((item) => (
          <a
            key={item}
            href="#a11y-starter-main"
            className="rounded-md px-2 py-1 text-ui-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item}
          </a>
        ))}
      </nav>

      <main
        id="a11y-starter-main"
        tabIndex={-1}
        className="px-md py-md"
        data-slot="a11y-starter-main"
      >
        <Stack gap="md">
          <Stack gap="xs">
            <Typography variant="h4" as="h2">
              Main content
            </Typography>
            <Typography variant="ui-sm" tone="muted" className="max-w-prose">
              <code className="font-mono">{'tabIndex={-1}'}</code> is what
              makes the skip link land here instead of scrolling and leaving
              focus behind. It is the half everyone forgets, and the symptom —
              &ldquo;the skip link does nothing&rdquo; — points at the link.
            </Typography>
          </Stack>

          <div className="grid gap-md md:grid-cols-3">
            <Box border radius="md" padding="sm" data-slot="part-focus-ring">
              <Stack gap="xs">
                <Typography variant="code" as="code" className="font-semibold">
                  FocusRing
                </Typography>
                <FocusRing offset="md">
                  <Button variant="outline" size="sm">
                    Tab to me
                  </Button>
                </FocusRing>
                <Typography variant="caption" tone="muted">
                  A composable ring for elements whose own indicator is
                  clipped or sits against a surface that swallows it.
                </Typography>
              </Stack>
            </Box>

            <Box border radius="md" padding="sm" data-slot="part-visually-hidden">
              <Stack gap="xs">
                <Typography variant="code" as="code" className="font-semibold">
                  VisuallyHidden
                </Typography>
                {/* The visible text is a fragment; the hidden span carries
                    the rest of the sentence for a screen reader. Sighted
                    users get the meaning from context, and this is how
                    everyone else does. */}
                <Typography variant="ui-sm">
                  Coverage 96%
                  <VisuallyHidden data-slot="starter-sr-text">
                    {' '}
                    of 412 rules, measured on the last CI run
                  </VisuallyHidden>
                </Typography>
                <Typography variant="caption" tone="muted">
                  Anything a sighted reader gets from position, colour or an
                  icon needs a text carrier. This is it.
                </Typography>
              </Stack>
            </Box>

            <Box border radius="md" padding="sm" data-slot="part-reduced-motion">
              <Stack gap="xs">
                <Typography variant="code" as="code" className="font-semibold">
                  useReducedMotion
                </Typography>
                <div className="flex items-center gap-xs">
                  <span
                    aria-hidden
                    className={
                      reduce
                        ? 'block size-4 rounded-full bg-primary'
                        : 'block size-4 animate-pulse rounded-full bg-primary'
                    }
                  />
                  <Typography variant="ui-sm" data-slot="starter-motion-state">
                    {reduce ? 'reduced — static' : 'full motion'}
                  </Typography>
                </div>
                <Typography variant="caption" tone="muted">
                  The CSS clamp in preflight covers CSS. Canvas, rAF and
                  spring motion have to read this hook.
                </Typography>
              </Stack>
            </Box>
          </div>
        </Stack>
      </main>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

function Specimen() {
  return (
    <Stack gap="lg" className="w-full" data-slot="a11y-starter-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          a11y-starter — the composed result
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          One install, four parts, and the reason they ship together: each
          covers a failure the others cannot reach. Below is a page wired the
          way the bundle expects — tab through it, and the tab ORDER is the
          demonstration.
        </Typography>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
          <code className="font-mono text-code">
            npx shadcn add @interlace/a11y-starter
          </code>
        </pre>
      </Stack>

      <StarterPage />

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="a11y-starter-manifest"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            What the CLI resolves
          </Typography>
          <ul className="grid gap-xs pl-0">
            {[
              ['skip-link', 'WCAG 2.4.1 — a keyboard path past the chrome.'],
              [
                'visually-hidden',
                'A text carrier for meaning that is otherwise only visual.',
              ],
              [
                'focus-ring',
                'WCAG 2.2 SC 2.4.13 — composable, for rings the element cannot paint itself.',
              ],
              [
                'use-reduced-motion',
                'The JS gate. The stylesheet clamp is blind to JavaScript.',
              ],
              [
                'theme',
                'The CSS baseline. preflight.css is where the default focus ring lives — without it every focusable element loses its indicator.',
              ],
            ].map(([name, why]) => (
              <li
                key={name}
                className="rounded-md border border-border p-sm"
              >
                <Typography variant="code" as="code" className="font-semibold">
                  {name}
                </Typography>
                <Typography variant="ui-sm" tone="muted">
                  {why}
                </Typography>
              </li>
            ))}
          </ul>
          <Typography variant="caption" tone="muted" className="max-w-prose">
            The bundle is a meta-item: it carries one README file and pulls
            the rest through <code className="font-mono">
              registryDependencies
            </code>
            , which the shadcn CLI walks transitively.
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Starters/A11y Starter',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The composed result of `npx shadcn add @interlace/a11y-starter`, rather than the file list its README already prints. The four parts ship together because each covers a failure the others cannot reach, and a page with three of them still fails — so the demo is a page wired the way the bundle expects, with the tab order as the proof. It includes the half everyone forgets: `<main tabIndex={-1}>`, without which the browser scrolls on a skip-link activation and leaves focus stranded, a symptom that reads as "the skip link does nothing".',
      },
    },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The thumbnail, and the keyboard gate. Axe cannot press a key: it renders
 * the skip link `sr-only`, finds no violation, and reports green on a page
 * where the bypass never worked. Only a Tab can catch that.
 */
export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('The skip link is the first tab stop', async () => {
      const link = canvas.getByRole('link', { name: /skip to main content/i });
      await userEvent.tab();
      await waitFor(() => expect(document.activeElement).toBe(link));

      // sr-only until focused, then a real, hit-testable target.
      const box = link.getBoundingClientRect();
      await expect(box.width).toBeGreaterThan(40);
      await expect(box.height).toBeGreaterThan(16);
    });

    await step('Its target can actually RECEIVE focus', async () => {
      const link = canvas.getByRole('link', { name: /skip to main content/i });
      const id = (link.getAttribute('href') ?? '').slice(1);
      const target = canvasElement.querySelector(`#${id}`) as HTMLElement;

      // The failure this catches: a skip link whose target is a plain
      // <main> with no tabindex. The browser scrolls, focus stays on the
      // link, and the next Tab continues from the header — "the skip link
      // does nothing". Asserted on the target rather than by pressing
      // Enter, because driving a hash navigation inside the Storybook
      // iframe changes the frame's own URL, not the story's.
      await expect(target).toBeTruthy();
      await expect(target.tabIndex).toBe(-1);

      target.focus();
      await waitFor(() => expect(document.activeElement).toBe(target));
    });

    await step('The hidden text is in the accessibility tree', async () => {
      const hidden = canvasElement.querySelector(
        '[data-slot="starter-sr-text"]',
      ) as HTMLElement;
      await expect(hidden.textContent).toContain('412 rules');
      // Present for assistive tech, absent from the visual layout.
      await expect(hidden.getBoundingClientRect().width).toBeLessThan(2);
    });
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
