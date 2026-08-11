'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import {
  SCHEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  THEME_SCRIPT,
} from '@interlace/ui/theme-script';
import { Button } from '@interlace/ui/button';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `THEME_SCRIPT` — the bootstrap, its inputs, and the flash it prevents.
 *
 * A theme applied after hydration is a repaint the user watches happen. The
 * document paints `:root` (Interlace · light) first, React mounts, an effect
 * reads `localStorage`, and only THEN does the page become the theme the
 * user actually chose. On a fast connection that is one wrong frame; on a
 * slow one it is half a second of the wrong brand — and no amount of
 * correctness in `useTheme` fixes it, because by the time any React code
 * runs the wrong paint has already happened.
 *
 * The only fix is to write the attributes before first paint, which means a
 * synchronous blocking inline `<script>` in `<head>`. That is why this
 * registry item is a STRING and not a component: it has to be inlined by the
 * host document, and the host is the only thing that can put it there.
 *
 * ─── What is real here and what is a model ────────────────────────
 *
 * Real: the bytes in the "What ships" panel are `THEME_SCRIPT` itself,
 * rendered from the import — not a transcription. The "Inputs" panel reads
 * the same three values the script reads, live, from this browser.
 *
 * A model: the flash panel is ONE COMPONENT standing in for one DOCUMENT.
 * It cannot be anything else — a story cannot reload the page it is inside —
 * so it reproduces the mechanism at component scale: identical subtrees,
 * one of which learns the stored theme before its first paint and one of
 * which learns it after. The delay is exaggerated to 600ms so the frame you
 * would otherwise miss is watchable. It is labelled as a model in the panel
 * itself, not only here.
 *
 * The demo flips the THEME axis (Interlace → Harbor) rather than the scheme,
 * because both are contract-checked light palettes: the flash is equally
 * real either way, and this way the specimen cannot be mistaken for a
 * contrast bug.
 */

const STORED_THEME_DEMO = 'harbor';
const FLASH_DELAY_MS = 600;

// ── A mini "page" ───────────────────────────────────────────────────────────
//
// `data-theme` on a wrapper is not a story trick: the brand tokens are
// declared as `[data-theme='harbor'] { --interlace-*: … }`, which is
// attribute matching on ANY element, and custom properties inherit. This is
// the same cascade the real bootstrap triggers on `<html>`.

function MiniPage({
  theme,
  caption,
}: {
  theme: string | null;
  caption: string;
}) {
  return (
    <div data-theme={theme ?? undefined} data-slot="mini-page-root">
      <div className="rounded-md border border-border bg-background p-md text-foreground">
        <Stack gap="sm">
          <div className="flex items-center gap-sm">
            <span
              aria-hidden
              className="block size-6 rounded-md bg-primary"
              data-slot="mini-page-swatch"
            />
            <Typography variant="ui" className="font-semibold">
              {caption}
            </Typography>
          </div>
          <div className="h-2 w-full rounded-full bg-primary" aria-hidden />
          <div className="h-2 w-2/3 rounded-full bg-muted" aria-hidden />
          <Typography variant="caption" tone="muted">
            data-theme = {theme ?? '(absent — the default)'}
          </Typography>
        </Stack>
      </div>
    </div>
  );
}

// ── The flash model ─────────────────────────────────────────────────────────

function FlashModel() {
  const [run, setRun] = React.useState(0);
  // `null` = still painting the default theme; the string = corrected.
  const [lateTheme, setLateTheme] = React.useState<string | null>(
    STORED_THEME_DEMO,
  );

  const replay = React.useCallback(() => {
    setLateTheme(null);
    setRun((n) => n + 1);
  }, []);

  React.useEffect(() => {
    if (run === 0) return;
    const id = window.setTimeout(
      () => setLateTheme(STORED_THEME_DEMO),
      FLASH_DELAY_MS,
    );
    return () => window.clearTimeout(id);
  }, [run]);

  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="theme-script-flash"
    >
      <Stack gap="md">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            The flash it prevents
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            A <strong>scale model</strong>: two identical subtrees standing in
            for two page loads, with the stored theme set to{' '}
            <code className="font-mono">{STORED_THEME_DEMO}</code>. The left
            one learns it after mount — the delay is stretched to{' '}
            {FLASH_DELAY_MS}ms so the wrong frame is watchable instead of
            subliminal. The right one has it before its first paint. A story
            cannot reload the document it lives in, so this is the mechanism
            at component scale, not a screen recording of a page load.
          </Typography>
        </Stack>

        <div className="grid gap-md md:grid-cols-2">
          <Stack gap="xs">
            <Typography variant="ui" className="font-semibold">
              Without <code className="font-mono">THEME_SCRIPT</code>
            </Typography>
            <div data-slot="flash-late" data-settled={lateTheme ? '' : undefined}>
              <MiniPage
                theme={lateTheme}
                caption={lateTheme ? 'corrected' : 'wrong theme, painted'}
              />
            </div>
            <Typography variant="caption" tone="muted">
              Applied from an effect, after hydration.
            </Typography>
          </Stack>

          <Stack gap="xs">
            <Typography variant="ui" className="font-semibold">
              With <code className="font-mono">THEME_SCRIPT</code>
            </Typography>
            <div data-slot="flash-early">
              <MiniPage theme={STORED_THEME_DEMO} caption="correct, first paint" />
            </div>
            <Typography variant="caption" tone="muted">
              Applied by a blocking <code className="font-mono">
                &lt;head&gt;
              </code>{' '}
              script, before anything paints.
            </Typography>
          </Stack>
        </div>

        <div>
          <Button variant="outline" size="sm" onClick={replay} data-slot="flash-replay">
            Replay the load
          </Button>
        </div>
      </Stack>
    </Box>
  );
}

// ── Live inputs ─────────────────────────────────────────────────────────────

type Inputs = {
  storedTheme: string | null;
  storedScheme: string | null;
  prefersDark: boolean;
};

function useLiveInputs(): Inputs | null {
  const [inputs, setInputs] = React.useState<Inputs | null>(null);
  React.useEffect(() => {
    const read = (key: string) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    };
    setInputs({
      storedTheme: read(THEME_STORAGE_KEY),
      storedScheme: read(SCHEME_STORAGE_KEY),
      prefersDark:
        Boolean(window.matchMedia) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches,
    });
  }, []);
  return inputs;
}

function InputsPanel() {
  const inputs = useLiveInputs();

  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="theme-script-inputs"
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            The three values it reads, in this browser
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            Read live, with the same keys and the same media query the script
            uses. An unrecognised stored theme is ignored rather than written
            through: <code className="font-mono">localStorage</code> outlives
            any theme we ever remove, and{' '}
            <code className="font-mono">data-theme=&quot;ember&quot;</code>{' '}
            pointing at a selector no stylesheet defines is a page that
            renders half-default and half-nothing.
          </Typography>
        </Stack>
        <dl className="grid gap-xs">
          {[
            [THEME_STORAGE_KEY, inputs?.storedTheme ?? '(absent)'],
            [SCHEME_STORAGE_KEY, inputs?.storedScheme ?? '(absent)'],
            [
              'matchMedia(prefers-color-scheme: dark)',
              inputs === null ? '…' : String(inputs.prefersDark),
            ],
          ].map(([key, value]) => (
            <div
              key={key}
              className="flex flex-wrap items-baseline justify-between gap-xs border-b border-border py-2 last:border-b-0"
            >
              <dt>
                <Typography
                  variant="code"
                  as="code"
                  className="text-muted-foreground"
                >
                  {key}
                </Typography>
              </dt>
              <dd>
                <Typography variant="code" as="code">
                  {value}
                </Typography>
              </dd>
            </div>
          ))}
        </dl>
        <Typography variant="caption" tone="muted">
          Absence is meaningful for the scheme key — it is how the script
          knows to consult the OS, which is why choosing
          &ldquo;system&rdquo; REMOVES it rather than storing the word.
        </Typography>
      </Stack>
    </Box>
  );
}

// ── The bytes ───────────────────────────────────────────────────────────────

const INSTALL_SNIPPET = `import { THEME_SCRIPT } from '@interlace/ui/theme-script';

<html lang="en" suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
  </head>`;

function BytesPanel() {
  const bytes = React.useMemo(
    () => new TextEncoder().encode(THEME_SCRIPT).length,
    [],
  );

  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="theme-script-bytes"
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            What ships — {bytes} bytes, in every page&rsquo;s{' '}
            <code className="font-mono">&lt;head&gt;</code>
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            Rendered from the <code className="font-mono">THEME_SCRIPT</code>{' '}
            export, so this is the literal string a consumer inlines. It is
            hand-minified because no bundler will ever see it, and derived
            from the theme registry so adding a theme cannot leave the
            bootstrap behind. The whole body sits in one{' '}
            <code className="font-mono">try</code> and fails silently: a
            blocking head script that throws is worse than a page in the
            default theme.
          </Typography>
        </Stack>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
          <code className="font-mono text-code whitespace-pre-wrap break-all">
            {THEME_SCRIPT}
          </code>
        </pre>

        <Typography variant="h4" as="h3">
          Where it goes
        </Typography>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
          <code className="font-mono text-code">{INSTALL_SNIPPET}</code>
        </pre>
        <Typography variant="ui-sm" tone="muted" className="max-w-prose">
          <code className="font-mono">suppressHydrationWarning</code> on{' '}
          <code className="font-mono">&lt;html&gt;</code> is required, and is
          the same thing next-themes asks for: the script deliberately mutates
          the element React is about to hydrate, so server markup and client
          DOM differ by design.
        </Typography>
      </Stack>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

function Specimen() {
  return (
    <Stack gap="lg" className="w-full" data-slot="theme-script-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          THEME_SCRIPT — the no-flash bootstrap
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          One blocking inline script, written before first paint. Not a
          component, because a component cannot run before the document does.
        </Typography>
      </Stack>

      <FlashModel />
      <InputsPanel />
      <BytesPanel />
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Utilities/Theme Script',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The inline `<head>` bootstrap that applies the stored theme before first paint — shown as its real bytes (rendered from the `THEME_SCRIPT` export), the three values it reads live from this browser, and the flash it exists to prevent. The flash panel is explicitly a scale model: a story cannot reload the document it lives in, so two identical subtrees stand in for two page loads, one learning the stored theme after mount and one before its first paint, with the delay stretched to 600ms so the wrong frame is watchable. It flips the THEME axis (Interlace → Harbor) rather than the scheme, because both are contract-checked light palettes and the specimen therefore cannot be misread as a contrast bug.',
      },
    },
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The thumbnail, and the gate on the model actually modelling something. */
export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const late = () =>
      canvasElement.querySelector('[data-slot="flash-late"]') as HTMLElement;
    const early = () =>
      canvasElement.querySelector('[data-slot="flash-early"] [data-slot="mini-page-root"]') as HTMLElement;

    // The bootstrapped side is never in the wrong theme, at any point.
    await expect(early().getAttribute('data-theme')).toBe('harbor');

    await userEvent.click(canvas.getByRole('button', { name: /replay/i }));

    // …and the un-bootstrapped side genuinely paints the default first.
    await expect(
      late().querySelector('[data-slot="mini-page-root"]')
        ?.getAttribute('data-theme'),
    ).toBe(null);

    await waitFor(
      () =>
        expect(
          late()
            .querySelector('[data-slot="mini-page-root"]')
            ?.getAttribute('data-theme'),
        ).toBe('harbor'),
      { timeout: 4000 },
    );
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
