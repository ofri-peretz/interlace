import { DecodeText } from '@interlace/ui/effects/decode-text';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';

/**
 * DecodeText stories
 *
 * The label-scale member of the woven signature kit: monospace
 * micro-labels resolve left-to-right out of code-glyph noise — terminal
 * decode, native to a lint brand. SSR-honest: static markup always
 * carries the final text, so crawlers and JS-off visitors never see
 * noise. `prefers-reduced-motion` skips the animation entirely (rAF
 * motion is gated by the DS `useReducedMotion` hook, since the preflight
 * CSS clamp cannot reach JS-driven motion).
 */

const meta: Meta<typeof DecodeText> = {
  title: 'Effects/DecodeText',
  component: DecodeText,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A once-per-view (or per-hover) glyph-resolve on a plain `<span>`. Reach for ' +
          'it on category chips, section eyebrows and stat labels — a label, not a ' +
          'scene (600ms cap). Pass a plain string child; the decode is per-character.',
      },
    },
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'The final text. Plain string only — the decode is per-character.',
      table: { category: 'Content', type: { summary: 'string' } },
    },
    'data-testid': {
      control: 'text',
      description: 'Stable E2E selector; consumer provides — no default.',
      table: { category: 'Contract', type: { summary: 'string' } },
    },
    trigger: {
      control: 'radio',
      options: ['visible', 'hover'],
      description:
        '`"visible"` decodes once via IntersectionObserver; `"hover"` re-arms on each pointer-enter.',
      table: { category: 'Behavior', type: { summary: '"visible" | "hover"' }, defaultValue: { summary: '"visible"' } },
    },
  },
};
export default meta;

type Story = StoryObj<typeof DecodeText>;

/** The native habitat: a monospace eyebrow label. */
export const Eyebrow: Story = {
  args: {
    children: 'SECURITY — CWE-798',
    'data-testid': 'decode-eyebrow',
    trigger: 'visible',
  },
  render: (args) => (
    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
      <DecodeText {...args} />
    </span>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const el = canvas.getByTestId('decode-eyebrow');
    // SSR-honesty: whatever the animation is doing, the element resolves
    // to the real text — and it began life carrying it in static markup.
    await waitFor(() => expect(el.textContent).toBe('SECURITY — CWE-798'), {
      timeout: 2000,
    });
  },
};

/** Re-armable variant for interactive chips. */
export const OnHover: Story = {
  args: {
    children: 'npm install --save-dev',
    'data-testid': 'decode-hover',
    trigger: 'hover',
  },
  render: (args) => (
    <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-sm">
      <DecodeText {...args} />
    </span>
  ),
};
