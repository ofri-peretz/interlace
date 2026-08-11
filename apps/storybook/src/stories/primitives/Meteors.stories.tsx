import type { Meta, StoryObj } from '@storybook/react-vite';
import { Meteors } from '@interlace/ui/meteors';
import { withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Meteors> = {
  title: 'Primitives/Meteors',
  component: Meteors,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A decorative meteor shower for hero surfaces. It is `absolute inset-0`, `aria-hidden` and `pointer-events-none`, so it only works inside a `relative` ancestor that has real height and `overflow-hidden` — every story below supplies one. `number` is the whole API: trail length, opacity, duration and origin are randomised per meteor at mount, because a shower of identical streaks reads as a CSS animation rather than a sky. Emits `null` under `prefers-reduced-motion: reduce`.',
      },
    },
  },
  argTypes: {
    number: {
      control: { type: 'range', min: 1, max: 60, step: 1 },
      description:
        'Total meteors rendered. Above ~40 the field stops reading as a night sky and starts reading as rain; 15–25 is the usable band for a full-bleed hero.',
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '22' },
      },
    },
    className: {
      control: 'text',
      description:
        'Merged onto `pointer-events-none absolute inset-0 overflow-hidden`. The seam for masking the field (e.g. `[mask-image:linear-gradient(to_bottom,black,transparent)]`) — not for positioning it.',
      table: { category: 'Appearance' },
    },
    'data-testid': {
      control: 'text',
      description:
        'Stable E2E selector. Deliberately has no default — the consumer names it (R6 carve-out).',
      table: { category: 'Appearance' },
    },
  },
  args: {
    number: 22,
    className: '',
    'data-testid': 'meteors',
  },
};

export default meta;
type Story = StoryObj<typeof Meteors>;

export const Default: Story = {
  // key: origins/trails/durations are randomised once per mount, so remount on
  // every arg change — otherwise raising `number` only appends meteors.
  render: (args) => (
    <div className="relative h-[480px] w-full overflow-hidden rounded-xl bg-slate-950">
      <Meteors key={args.number} {...args} />
      <div className="relative z-10 flex h-full items-center justify-center text-slate-100">
        <span className="text-xs uppercase tracking-widest">
          Meteors — {args.number} over a 480px hero
        </span>
      </div>
    </div>
  ),
};

export const LightSurface: Story = {
  render: () => (
    <div className="relative h-[480px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-sky-50 to-sky-200">
      <Meteors number={15} />
      <div className="relative z-10 flex h-full items-center justify-center text-slate-700">
        <span className="text-xs uppercase tracking-widest">
          Meteors over a daylit hero
        </span>
      </div>
    </div>
  ),
};

export const Sparse: Story = {
  render: () => (
    <div className="relative h-[480px] w-full overflow-hidden rounded-xl bg-slate-950">
      <Meteors number={6} />
      <div className="relative z-10 flex h-full items-center justify-center text-slate-100">
        <span className="text-xs uppercase tracking-widest">
          6 meteors — quiet sky
        </span>
      </div>
    </div>
  ),
};

/**
 * The density band, side by side. Origins are viewport-relative (`vw`/`vh`), so
 * a short container catches only the top slice of each trajectory — this is why
 * the primitive belongs in a full-height hero, not a 120px strip.
 */
export const Density: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-md md:grid-cols-3">
      {[8, 22, 45].map((n) => (
        <div
          key={n}
          className="relative h-[360px] overflow-hidden rounded-xl bg-slate-950"
        >
          <Meteors number={n} />
          <div className="relative z-10 flex h-full items-end justify-center p-4 text-slate-100">
            <span className="text-xs uppercase tracking-widest">
              number={n}
            </span>
          </div>
        </div>
      ))}
    </div>
  ),
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Default,
  decorators: [withReducedMotion],
};
