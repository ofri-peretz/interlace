import { InterlaceWeave } from '@interlace/ui/effects/interlace-weave';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

/**
 * InterlaceWeave stories
 *
 * The brand gesture (BRAND_PHILOSOPHY.md): two strands — strand-a (the
 * mark's burnt orange) and strand-b (its cool counter) — draw from
 * opposite corners and pass each other on hover/focus-within. Purely
 * decorative overlay: `aria-hidden`, `pointer-events-none`, CSS-only
 * motion that `prefers-reduced-motion` stills via `motion-reduce:`.
 *
 * The component is an absolute overlay, so every story hosts it the way
 * consumers do: a `group/weave relative` interactive card.
 */

const HostCard = ({ children }: { children: React.ReactNode }) => (
  <a
    href="#weave-demo"
    className="group/weave relative block w-72 rounded-xl border border-border bg-card p-6 text-card-foreground"
  >
    <InterlaceWeave data-testid="weave-demo" className="z-10 rounded-xl" />
    {children}
  </a>
);

const meta: Meta<typeof InterlaceWeave> = {
  title: 'Effects/InterlaceWeave',
  component: InterlaceWeave,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The border-scale member of the woven signature kit: hover or focus the host ' +
          'and two brand strands draw around it from opposite corners. Rest state is ' +
          'truly blank (the dash gap exceeds pathLength + dash — a 100-period pattern ' +
          'is modular, so a naive offset ships fully drawn). Attach to any ' +
          '`group/weave relative` host; strokes use only the strand tokens.',
      },
    },
  },
  argTypes: {
    'data-testid': {
      control: 'text',
      description: 'Stable E2E selector; consumer provides — no default.',
      table: { category: 'Contract', type: { summary: 'string' } },
    },
    radius: {
      control: 'number',
      description: 'Corner radius of the outer strand rect, in viewBox units.',
      table: { category: 'Geometry', type: { summary: 'number' } },
    },
  },
};
export default meta;

type Story = StoryObj<typeof InterlaceWeave>;

/** Hover (or keyboard-focus) the card to draw the weave. */
export const OnACard: Story = {
  render: () => (
    <HostCard>
      <p className="text-sm font-medium">Hover or focus me</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Two strands, opposite corners, one crossing.
      </p>
    </HostCard>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const svg = canvas.getByTestId('weave-demo');
    // Decorative contract: hidden from AT, inert to the pointer.
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.getAttribute('class')).toContain('pointer-events-none');
    // Brand contract: strand tokens only.
    expect(svg.innerHTML).toContain('stroke-strand-a');
    expect(svg.innerHTML).toContain('stroke-strand-b');
  },
};
