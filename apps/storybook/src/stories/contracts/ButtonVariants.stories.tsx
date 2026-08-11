'use client';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { PlusIcon } from 'lucide-react';

import { buttonVariants, type VariantProps } from '@interlace/ui/button-variants';
import { Box } from '@interlace/ui/box';
import { Stack } from '@interlace/ui/stack';
import { Typography } from '@interlace/ui/typography';

import { withRtl } from '@/decorators';

/**
 * `button-variants` — the catalogue IS the demonstration.
 *
 * `buttonVariants` is a pure CVA function: class strings in, class string
 * out, no React and no client APIs. It ships as its own registry item —
 * separate from `button` — for one concrete reason: `button.tsx` is
 * `'use client'` (Base UI `useRender`), and a server component that wants a
 * link to LOOK like a button must not drag a client component in to get the
 * classes. `<Link className={buttonVariants({ variant: 'outline' })}>` is the
 * whole use case, and it is server-safe.
 *
 * Which makes the full grid the only honest picture of it. A single sample
 * shows one of forty-eight cells; the surface is 6 variants × 8 sizes, and
 * the thing a consumer needs to see is all of it at once — which sizes are
 * icon-only, which variants carry their own surface, which one is a link in
 * disguise.
 *
 * ─── The `outline` note is a bug this repo shipped ────────────────
 *
 * `outline` paints an opaque surface (`bg-background`) but was the only such
 * variant that did NOT also set a foreground, so it inherited one. Dropped
 * inside a section that flips the text colour — `<CTASection tone="primary">`
 * is `bg-primary text-primary-foreground` — the button kept the page
 * background and took the section's white text: **1.05:1, invisible.** The
 * fix was one class, `text-foreground`, and the rule it encodes is general:
 * an opaque surface owns its foreground; anything else is a colour that
 * depends on where you put it.
 *
 * The tinted panel below is that composition — with the CTA it should
 * actually use. Declaring a foreground is only half the contract: in the
 * dark scheme `outline` is `dark:bg-input/30`, 30% translucent, so the
 * branded background shows through and `text-foreground` lands on it at
 * **2:1**. The theme-matrix sweep measures that, which is why the panel
 * renders `secondary` — opaque in both schemes — and states the
 * `outline`-in-dark result in text rather than painting a failure.
 */

// ── The axes ────────────────────────────────────────────────────────────────
//
// Listed rather than introspected: CVA does not expose its config at
// runtime. Typing them against `VariantProps<typeof buttonVariants>` is what
// keeps the list honest — renaming or removing a variant in the source turns
// these arrays into a compile error rather than a silently short catalogue.

type Variant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type Size = NonNullable<VariantProps<typeof buttonVariants>['size']>;

const VARIANTS: readonly Variant[] = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
];

const SIZES: readonly Size[] = [
  'default',
  'xs',
  'sm',
  'lg',
  'icon',
  'icon-xs',
  'icon-sm',
  'icon-lg',
];

const isIconSize = (size: Size): boolean => String(size).startsWith('icon');

// ── A cell ──────────────────────────────────────────────────────────────────
//
// A real `<button>` with the generated className and nothing else — no
// `Button` component — because what is under test is the class string, not
// the primitive that usually consumes it.

function Cell({ variant, size }: { variant: Variant; size: Size }) {
  const icon = isIconSize(size);
  return (
    <button
      type="button"
      className={buttonVariants({ variant, size })}
      aria-label={icon ? `Add — ${variant} ${size}` : undefined}
      data-slot="variant-cell"
      data-variant={variant}
      data-size={size}
    >
      {icon ? <PlusIcon aria-hidden /> : String(size)}
    </button>
  );
}

// ── The grid ────────────────────────────────────────────────────────────────

function Matrix() {
  return (
    <Stack gap="md" data-slot="button-variants-matrix">
      {VARIANTS.map((variant) => (
        <Box
          key={variant}
          border
          radius="md"
          padding="sm"
          className="bg-background"
          data-slot="variant-row"
        >
          <Stack gap="sm">
            <Typography variant="code" as="code" className="font-semibold">
              variant=&quot;{variant}&quot;
            </Typography>
            <div className="flex flex-wrap items-center gap-sm">
              {SIZES.map((size) => (
                <Cell key={String(size)} variant={variant} size={size} />
              ))}
            </div>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

// ── The server-component case ───────────────────────────────────────────────

function LinkPanel() {
  const className = buttonVariants({ variant: 'outline', size: 'sm' });
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="bg-background"
      data-slot="button-variants-link"
    >
      <Stack gap="sm">
        <Typography variant="h4" as="h3">
          Why it is its own item
        </Typography>
        <Typography variant="ui-sm" tone="muted" className="max-w-prose">
          The <code className="font-mono">Button</code> component is{' '}
          <code className="font-mono">&apos;use client&apos;</code>. This
          function is not — so a server-rendered page can paint an anchor,
          a <code className="font-mono">next/link</code>, or a form submit as
          a button without shipping any component JS for it.
        </Typography>
        <div className="flex flex-wrap items-center gap-sm">
          <a href="#button-variants" className={className}>
            An anchor that looks like a button
          </a>
        </div>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
          <code
            className="font-mono text-code whitespace-pre-wrap break-all"
            data-slot="button-variants-classes"
          >
            {className}
          </code>
        </pre>
      </Stack>
    </Box>
  );
}

// ── The composition bug ─────────────────────────────────────────────────────

function TintedPanel() {
  return (
    <Box
      border
      radius="md"
      padding="md"
      className="border-warning/40 bg-warning/10"
      data-slot="button-variants-tinted"
    >
      <Stack gap="sm">
        <Stack gap="xs">
          <Typography variant="h4" as="h3">
            An opaque surface owns its foreground
          </Typography>
          <Typography variant="ui-sm" tone="muted" className="max-w-prose">
            The block below is{' '}
            <code className="font-mono">bg-primary text-primary-foreground</code>
            , exactly like{' '}
            <code className="font-mono">
              &lt;CTASection tone=&quot;primary&quot;&gt;
            </code>
            . A variant dropped in here inherits that light text unless it
            sets its own — which is how{' '}
            <code className="font-mono">outline</code> once rendered at{' '}
            <strong>1.05:1</strong>: it painted{' '}
            <code className="font-mono">bg-background</code> and never declared
            a foreground. One class,{' '}
            <code className="font-mono">text-foreground</code>, fixed it.
          </Typography>
        </Stack>

        <div className="rounded-md bg-primary p-md text-primary-foreground">
          <div className="flex flex-wrap items-center gap-sm">
            <span className="text-ui-sm">Ready to install?</span>
            <a
              href="#button-variants"
              className={buttonVariants({ variant: 'secondary' })}
              data-slot="tinted-safe-cta"
            >
              Copy the command
            </a>
          </div>
        </div>

        <Typography variant="ui-sm" tone="muted" className="max-w-prose">
          <strong>
            And the reason the button in that block is{' '}
            <code className="font-mono">secondary</code>, not{' '}
            <code className="font-mono">outline</code>.
          </strong>{' '}
          Declaring a foreground is only half the contract — the surface has to
          be opaque for it to mean anything. In the dark scheme{' '}
          <code className="font-mono">outline</code> is{' '}
          <code className="font-mono">dark:bg-input/30</code>, i.e. 30%
          translucent, so on this branded background the section&rsquo;s
          primary colour shows through and{' '}
          <code className="font-mono">text-foreground</code> lands on it at{' '}
          <strong>2:1</strong> — measured by the theme-matrix sweep, which is
          why this panel does not render that composition.{' '}
          <code className="font-mono">secondary</code> is opaque in both
          schemes and carries its own pair, so it is the correct CTA on a
          tinted section.
        </Typography>
      </Stack>
    </Box>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

type ButtonVariantsArgs = {
  variant: Variant;
  size: Size;
};

function Specimen({ variant, size }: ButtonVariantsArgs) {
  const picked = buttonVariants({ variant, size });

  return (
    <Stack
      gap="lg"
      className="w-full"
      id="button-variants"
      data-slot="button-variants-specimen"
    >
      <Stack gap="xs">
        <Typography variant="h3" as="h2">
          buttonVariants — {VARIANTS.length} variants × {SIZES.length} sizes
        </Typography>
        <Typography variant="long" tone="muted" className="max-w-prose">
          A pure CVA function, so the catalogue is the documentation: every
          cell below is a bare{' '}
          <code className="font-mono">&lt;button&gt;</code> carrying nothing
          but the generated class string.
        </Typography>
      </Stack>

      <Box
        border
        radius="md"
        padding="md"
        className="bg-card"
        data-slot="button-variants-picked"
      >
        <Stack gap="sm">
          <Typography variant="h4" as="h3">
            <code className="font-mono">
              buttonVariants({'{'} variant: &quot;{variant}&quot;, size:
              &quot;{String(size)}&quot; {'}'})
            </code>
          </Typography>
          <div>
            <button
              type="button"
              className={picked}
              aria-label={isIconSize(size) ? 'Add' : undefined}
            >
              {isIconSize(size) ? <PlusIcon aria-hidden /> : 'The picked combo'}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-sm">
            <code className="font-mono text-code whitespace-pre-wrap break-all">
              {picked}
            </code>
          </pre>
        </Stack>
      </Box>

      <Matrix />
      <TintedPanel />
      <LinkPanel />
    </Stack>
  );
}

// ── Storybook meta + stories ────────────────────────────────────────────────

const meta = {
  title: 'Contracts/Button Variants',
  component: Specimen,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The whole 6 × 8 surface at once, because a variant function has no single representative sample. Every cell is a bare `<button>` carrying only the generated class string — no `Button` component — since what is documented is the string. It ships as a registry item separate from `button` because `button.tsx` is `\'use client\'` and a server component must be able to paint `<Link className={buttonVariants(...)}>` without pulling a client component in for it. The "opaque surface owns its foreground" panel reproduces a defect this repo shipped: `outline` paints `bg-background` and inherited its text colour, so inside a `bg-primary text-primary-foreground` section it rendered at 1.05:1 — invisible. It also records the half of that contract the fix does not reach: in the dark scheme `outline` is `dark:bg-input/30`, 30% translucent, so on the same branded surface `text-foreground` measures 2:1, which is why the panel renders `secondary` there.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: VARIANTS,
      description:
        'Surface + intent. `link` is the odd one out — no surface at all, it is a text link wearing the button geometry.',
      table: {
        category: 'Variants',
        type: { summary: VARIANTS.join(' | ') },
        defaultValue: { summary: 'default' },
      },
    },
    size: {
      control: 'select',
      options: SIZES,
      description:
        'Geometry. The four `icon*` sizes are square and expect a lone icon — give them an `aria-label`, since the glyph is the only content.',
      table: {
        category: 'Variants',
        type: { summary: SIZES.map(String).join(' | ') },
        defaultValue: { summary: 'default' },
      },
    },
  },
  args: {
    variant: 'default',
    size: 'default',
  },
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full catalogue — the thumbnail, because no single cell represents it. */
export const Variants: Story = {
  tags: ['preview'],
  play: async ({ canvasElement }) => {
    const cells = canvasElement.querySelectorAll('[data-slot="variant-cell"]');
    await expect(cells.length).toBe(VARIANTS.length * SIZES.length);

    // The defect that shipped: a variant on a branded surface must carry its
    // own foreground, or it inherits the section's. Read the computed colour
    // of the CTA inside the primary block and compare it to the block's own
    // text colour — they must differ, in whichever scheme this story runs.
    const tinted = canvasElement.querySelector(
      '[data-slot="button-variants-tinted"]',
    ) as HTMLElement;
    const surface = tinted.querySelector('.bg-primary') as HTMLElement;
    const cta = tinted.querySelector(
      '[data-slot="tinted-safe-cta"]',
    ) as HTMLElement;
    await expect(getComputedStyle(cta).color).not.toBe(
      getComputedStyle(surface).color,
    );
    // …and its surface is opaque, which is the half of the contract the
    // colour comparison alone cannot see: a translucent variant passes the
    // test above and still fails contrast, because the section shows through.
    await expect(getComputedStyle(cta).backgroundColor).not.toContain('rgba');
  },
};

export const Dark: Story = {
  ...Variants,
  tags: [],
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  decorators: [withRtl],
};
