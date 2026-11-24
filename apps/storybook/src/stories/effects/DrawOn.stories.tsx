import { DrawOn } from '@interlace/ui/effects/draw-on';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

const meta: Meta<typeof DrawOn> = {
  title: 'Effects/DrawOn',
  component: DrawOn,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A line drawing that draws itself as it scrolls into view. Wrap any inline SVG: every stroked shape traces its line in document order, then fills fade in. The finished drawing is in the server HTML and the SVG keeps its own semantics. Focus inside shows it at once; under reduced motion it is simply there.',
      },
    },
  },
  argTypes: {
    order: {
      control: 'inline-radio',
      options: ['sequence', 'together'],
      table: { defaultValue: { summary: 'sequence' } },
    },
    duration: { control: { type: 'number', min: 0, step: 100 }, table: { defaultValue: { summary: '1200' } } },
    stagger: { control: { type: 'number', min: 0, step: 50 }, table: { defaultValue: { summary: '150' } } },
    delay: { control: { type: 'number', min: 0, step: 50 }, table: { defaultValue: { summary: '0' } } },
    amount: { control: { type: 'range', min: 0, max: 1, step: 0.05 }, table: { defaultValue: { summary: '0.3' } } },
  },
  // The drawing finishes before the accessibility scan and the screenshot.
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-slot="draw-on"]');
    await expect(root).not.toBeNull();
    await waitFor(() => expect(root!.dataset.drawn).toBe('true'));
    const shapes = [...root!.querySelectorAll<SVGElement>('*')];
    await Promise.all(shapes.flatMap((s) => s.getAnimations()).map((a) => a.finished.catch(() => undefined)));
  },
};

export default meta;
type Story = StoryObj<typeof DrawOn>;

/** A small bridge over water, drawn the way a pen would: deck, arch, cables, then the river. */
function Bridge() {
  return (
    <svg
      viewBox="0 0 320 160"
      role="img"
      aria-label="A line drawing of an arched bridge over a river"
      className="text-foreground h-auto w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 90 H310" />
      <path d="M40 90 Q160 10 280 90" />
      {[70, 100, 130, 160, 190, 220, 250].map((x) => (
        // The cables hang from the arch: the curve's height at x, as t runs 0 to 1 across the span.
        <path key={x} d={`M${x} 90 V${Math.round(90 - 160 * ((x - 40) / 240) * (1 - (x - 40) / 240))}`} />
      ))}
      <path d="M40 90 V130 M280 90 V130" />
      <path className="text-primary" stroke="currentColor" d="M10 140 Q50 132 90 140 T170 140 T250 140 T310 140" />
      <circle cx="270" cy="30" r="12" className="text-primary" stroke="currentColor" />
    </svg>
  );
}

export const Default: Story = {
  args: { order: 'sequence' },
  render: (args) => (
    <div className="max-w-prose">
      <DrawOn {...args}>
        <Bridge />
      </DrawOn>
    </div>
  ),
};

/** Every line at once, for a simple icon or an arrow. */
export const Together: Story = {
  args: { order: 'together', duration: 800 },
  render: (args) => (
    <div className="flex max-w-prose items-center gap-4">
      <DrawOn {...args} className="text-primary size-16">
        <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
          <path d="M6 24 H40" />
          <path d="M28 12 L40 24 L28 36" />
        </svg>
      </DrawOn>
      <p className="text-muted-foreground">An arrow that points at the next step.</p>
    </div>
  ),
};

/** Scroll the canvas: the drawing waits until it is in view. */
export const OnScroll: Story = {
  render: () => (
    <div className="flex max-w-prose flex-col gap-[80vh] pb-[20vh]">
      <p className="text-muted-foreground">Scroll down.</p>
      <DrawOn>
        <Bridge />
      </DrawOn>
    </div>
  ),
};
