'use client';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { twMerge } from 'tailwind-merge';

import { cn, DS_FONT_SIZES } from '@interlace/ui/cn';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `cn` — the merge, shown.
 *
 * `cn()` is one line of code and the least interesting file in the design
 * system right up until it deletes a class you wrote. Classes in, resolved
 * classes out: the only honest way to document it is to run it and print
 * both sides, which is what every panel below does. Nothing here is a
 * hard-coded "expected output" string — every `after` cell is the live
 * return value of the function the consumer installs.
 *
 * ─── The defect this story exists to show ─────────────────────────
 *
 * Tailwind v4 emits a `text-<name>` utility for every `--text-<name>` theme
 * key, and this DS registers a twelve-step type scale that way (`text-ui-sm`,
 * `text-body`, `text-code`, …). From the class name alone `text-ui-sm` is
 * indistinguishable from `text-red-500`, so **stock tailwind-merge files our
 * size tokens under `text-color` and deletes them whenever a real colour
 * utility is present on the same element.**
 *
 * `twMerge('text-ui-sm font-medium text-foreground')` returns
 * `'font-medium text-foreground'`. The size is gone, silently, in the
 * rendered DOM — it shipped that way in at least eight places
 * (ProgressLabel, ProgressValue, ToastTitle, ToastDescription, the CodeBlock
 * header, its copy button, its `<pre>`, and `<Typography variant="ui">`,
 * which lost the size that is the entire point of the variant).
 *
 * The fix is `extendTailwindMerge` registering `DS_FONT_SIZES` as a
 * `font-size` group, which makes the tokens mutually exclusive with each
 * other and orthogonal to colour. `Default` runs BOTH mergers on the same
 * input and renders both results, so the deleted size is visible as pixels
 * rather than described as a bug report.
 *
 * Client-side because the panels re-run the merge on whatever the Controls
 * panel currently holds.
 */

// ── Stock tailwind-merge, for the comparison ────────────────────────────────
//
// The unconfigured merger, imported directly rather than reconstructed, so
// the "before" column is genuinely what a consumer gets without this file
// and not our imitation of it.
const stockMerge = (input: string): string => twMerge(input);

// ── Case table ──────────────────────────────────────────────────────────────

type MergeCase = {
  /** What the caller wrote. */
  input: string;
  /** What the merge is for, in one line. */
  note: string;
};

const CONFLICT_CASES: MergeCase[] = [
  {
    input: 'px-2 px-4',
    note: 'Later wins. The whole reason a merge exists.',
  },
  {
    input: 'p-4 px-8',
    note: 'A narrower utility overrides the axis of a broader one.',
  },
  {
    input: 'text-ui text-body',
    note: 'Two DS sizes are mutually exclusive — the last one survives.',
  },
  {
    input: 'text-ui-sm text-muted-foreground',
    note: 'A size and a colour are orthogonal — BOTH must survive.',
  },
  {
    input: 'rounded-md rounded-none',
    note: 'Radius, same rule. Nothing DS-specific about this one.',
  },
];

/** The input that used to lose its size. */
const REGRESSION_INPUT = 'text-ui-sm font-medium text-foreground';

// ── One before/after row ────────────────────────────────────────────────────
//
// `code` elements rather than a table: the values are class lists, they wrap,
// and a two-column table of wrapping monospace is unreadable below ~700px.

function MergeRow({
  input,
  output,
  note,
  lost,
}: {
  input: string;
  output: string;
  note?: string;
  lost?: string[];
}) {
  return (
    <Box
      border
      radius="md"
      padding="sm"
      className="bg-background"
      data-slot="merge-row"
      data-input={input}
    >
      <Stack gap="xs">
        <Typography variant="caption" tone="muted" as="p">
          in
        </Typography>
        <Typography variant="code" as="code" className="break-all">
          {input}
        </Typography>
        <Typography variant="caption" tone="muted" as="p">
          out
        </Typography>
        <Typography
          variant="code"
          as="code"
          className="break-all"
          data-slot="merge-output"
        >
          {output}
        </Typography>
        {lost && lost.length > 0 ? (
          <Typography variant="caption" tone="destructive" as="p">
            dropped: {lost.join(', ')}
          </Typography>
        ) : null}
        {note ? (
          <Typography variant="ui-sm" tone="muted">
            {note}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

/** Classes present in `input` that did not survive into `output`. */
const droppedFrom = (input: string, output: string): string[] => {
  const kept = new Set(output.split(/\s+/).filter(Boolean));
  return input.split(/\s+/).filter((token) => token && !kept.has(token));
};

// ── The regression panel ────────────────────────────────────────────────────

function RegressionPanel({ input }: { input: string }) {
  const stock = stockMerge(input);
  const ours = cn(input);
  const lost = droppedFrom(input, stock);

  return (
    <Box
      border
      radius="md"
      padding="md"
      className="border-warning/40 bg-warning/10"
      data-slot="cn-regression"
    >
      <Stack gap="md">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            A real defect, reproduced live
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            Both columns merge the same input. The left one is stock{' '}
            <code className="font-mono">tailwind-merge</code>; the right one is
            this design system&rsquo;s{' '}
            <code className="font-mono">cn()</code>. The sample sentence under
            each is rendered with that column&rsquo;s exact output, so the
            deleted font size is visible rather than asserted.
          </Typography>
        </Stack>

        <div className="grid gap-md md:grid-cols-2">
          <Stack gap="sm">
            <Typography variant="ui" className="font-semibold">
              stock <code className="font-mono">twMerge()</code>
            </Typography>
            <MergeRow input={input} output={stock} lost={lost} />
            <Box
              border
              radius="md"
              padding="sm"
              className="bg-background"
              data-slot="cn-sample-stock"
            >
              <span className={stock}>The quick brown fox — 12 tokens.</span>
            </Box>
          </Stack>

          <Stack gap="sm">
            <Typography variant="ui" className="font-semibold">
              Interlace <code className="font-mono">cn()</code>
            </Typography>
            <MergeRow input={input} output={ours} />
            <Box
              border
              radius="md"
              padding="sm"
              className="bg-background"
              data-slot="cn-sample-ours"
            >
              <span className={ours}>The quick brown fox — 12 tokens.</span>
            </Box>
          </Stack>
        </div>
      </Stack>
    </Box>
  );
}

// ── The registered scale ────────────────────────────────────────────────────
//
// `DS_FONT_SIZES` is the list `extendTailwindMerge` registers. Rendering it
// from the export (not a copy) means a token added to the scale shows up here
// on the next reload — and `cn-type-scale-lock.test.ts` is what stops the
// list drifting from `foundation.css` in the first place.

function ScalePanel() {
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="cn-scale"
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            The {DS_FONT_SIZES.length} sizes registered as{' '}
            <code className="font-mono">font-size</code>
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            Read from the <code className="font-mono">DS_FONT_SIZES</code>{' '}
            export, not copied. Each is declared as{' '}
            <code className="font-mono">--text-*</code> in{' '}
            <code className="font-mono">styles/foundation.css</code>; a token
            added there and forgotten here does not error, it silently loses
            its size at the first <code className="font-mono">cn()</code> that
            also sets a colour.
          </Typography>
        </Stack>
        <ul className="flex flex-wrap gap-xs pl-0">
          {DS_FONT_SIZES.map((size) => (
            <li
              key={size}
              className="rounded-md border border-border px-2 py-1 font-mono text-caption text-muted-foreground"
            >
              text-{size}
            </li>
          ))}
        </ul>
      </Stack>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

type CnArgs = {
  /** Class list handed to both mergers. */
  input: string;
};

function Specimen({ input }: CnArgs) {
  return (
    <Stack gap="lg" className="w-full" data-slot="cn-specimen">
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          cn() — the merge, shown
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          <code className="font-mono">cn(...inputs)</code> is{' '}
          <code className="font-mono">clsx</code> for conditionals wrapped in a
          Tailwind-aware merge for conflicts. Everything below is the live
          return value of the installed function — edit{' '}
          <code className="font-mono">input</code> in Controls and every panel
          re-runs.
        </Typography>
      </Stack>

      <RegressionPanel input={input} />

      <Box
        border
        radius="md"
        padding="md"
        className="bg-background"
        data-slot="cn-conflicts"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            Conflict resolution
          </Typography>
          <div className="grid gap-sm md:grid-cols-2">
            {CONFLICT_CASES.map((item) => (
              <MergeRow
                key={item.input}
                input={item.input}
                output={cn(item.input)}
                note={item.note}
              />
            ))}
          </div>
        </Stack>
      </Box>

      <ScalePanel />
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Utilities/cn',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The class-name merge, run rather than described: every `out` cell is the live return value of the installed `cn()`. The first panel reproduces a defect this repo actually shipped — with stock `tailwind-merge`, `text-ui-sm font-medium text-foreground` loses `text-ui-sm`, because Tailwind v4 emits DS type-scale tokens as `text-*` utilities that are indistinguishable from colour utilities by name. Eight components rendered at the wrong size in production before `extendTailwindMerge` registered `DS_FONT_SIZES` as a `font-size` group. The two sample sentences are painted with the two merge results, so the deletion is visible as pixels.',
      },
    },
  },
  argTypes: {
    input: {
      control: 'text',
      description:
        'Class list handed to both mergers. Try adding a second size (`text-body`) or a second colour — sizes collapse against each other, sizes and colours do not.',
      table: {
        category: 'Input',
        type: { summary: 'string' },
        defaultValue: { summary: REGRESSION_INPUT },
      },
    },
  },
  args: {
    input: REGRESSION_INPUT,
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The thumbnail: stock merge vs DS merge on the input that regressed, with
 * both results rendered as text.
 */
export const Default: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    // Queried by `data-slot`, not by text: the INPUT cell also contains
    // `font-medium`, so a text matcher picks it up first and the assertion
    // silently checks the wrong string.
    const outputs = canvasElement.querySelectorAll(
      '[data-slot="cn-regression"] [data-slot="merge-output"]',
    );

    // The claim the panel makes, asserted rather than trusted: the stock
    // merge deletes the size token, ours keeps it. If tailwind-merge ever
    // fixes this upstream the story stops being true and this fails loudly.
    await expect(outputs.length).toBe(2);
    const stock = outputs[0].textContent ?? '';
    const ours = outputs[1].textContent ?? '';

    await expect(stock).not.toContain('text-ui-sm');
    await expect(ours).toContain('text-ui-sm');
    await expect(ours).toContain('text-foreground');

    // The size actually reaches the DOM, not just the class string: the
    // sample painted with our output must be smaller than the one painted
    // with the stock output, which inherited the ambient body size.
    const stockSample = canvasElement.querySelector(
      '[data-slot="cn-sample-stock"] span',
    ) as HTMLElement;
    const oursSample = canvasElement.querySelector(
      '[data-slot="cn-sample-ours"] span',
    ) as HTMLElement;
    const px = (el: HTMLElement) =>
      Number.parseFloat(getComputedStyle(el).fontSize);
    await expect(px(oursSample)).toBeLessThan(px(stockSample));
  },
};

/**
 * Two DS sizes on one element. Unlike the colour case these SHOULD collapse —
 * registering them as a `font-size` group is what makes both behaviours
 * correct at once.
 */
export const CompetingSizes: Story = {
  args: { input: 'text-ui text-body text-muted-foreground' },
};

export const Dark: Story = {
  ...Default,
  tags: [],
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
