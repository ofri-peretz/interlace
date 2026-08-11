import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandLogo, BrandMark } from '@interlace/ui/patterns/brand-logo';

const meta: Meta<typeof BrandLogo> = {
  title: 'Blocks/BrandLogo',
  component: BrandLogo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The Interlace lockup: the two-bar mark plus the wordmark. The bars read ' +
          'their fills from `--brand-mark-bar-o` / `--brand-mark-bar-g`, which is the ' +
          'cross-repo contract — a site outside this monorepo can define just those two ' +
          'custom properties and render an identical lockup. Both flip to a brighter ' +
          'pair in dark mode, so check this story in both themes.',
      },
    },
  },
  argTypes: {
    markSize: {
      control: { type: 'range', min: 12, max: 64, step: 1 },
      description:
        'Mark edge length in px (width = height), forwarded to `BrandMark`. The wordmark does NOT scale with it — it inherits the surrounding font size, so a large mark next to small text is on you.',
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '22' },
      },
    },
    children: {
      control: 'text',
      description:
        'Rendered after the wordmark inside the same inline row — the seam for a product suffix such as "/ docs" or a version chip. Leave empty for the bare lockup.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description:
        'Merged onto the root `<span>`. This is where the wordmark size comes from: set a type utility here (e.g. `text-lg`) and the word scales, the mark does not.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    markSize: 22,
    className: 'text-ui',
    children: '',
  },
};

export const MarkOnly: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The mark without the wordmark — what a favicon, an avatar slot, or a ' +
          'collapsed mobile nav gets.',
      },
    },
  },
  render: () => <BrandMark />,
};

export const Sizes: Story = {
  // The registry's thumbnail for this component — see the preview policy in
  // apps/registry/scripts/build-story-map.mjs. Default renders too small to
  // read at thumbnail size.
  tags: ['preview'],
  parameters: {
    docs: {
      description: {
        story:
          'The mark is geometry, not a bitmap, so it holds its proportions at every ' +
          'size. 16px is the favicon floor; 48px is the marketing-header ceiling.',
      },
    },
  },
  render: () => (
    <div className="flex items-end gap-6">
      {[16, 24, 32, 48].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <BrandMark size={size} />
          <span className="text-caption text-muted-foreground tabular-nums">
            {size}px
          </span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Both bar fills are theme-paired custom properties, so the lockup flips to the
 * brighter dark-mode pair on its own. This story is the check that the pairing
 * is actually wired — the mark should stay legible, not just invert.
 *
 * Declared after `Sizes` because it spreads it: a story that spreads a later
 * `const` throws on module evaluation, and Storybook reports that as the whole
 * file failing to load.
 */
export const Dark: Story = {
  ...Sizes,
  globals: { theme: 'dark' },
};

export const InNavContext: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The lockup where it actually lives — left-aligned in a bordered top bar, ' +
          'sized against nav links.',
      },
    },
  },
  render: () => (
    <div className="flex w-full max-w-content items-center justify-between rounded-lg border border-border px-4 py-3">
      <BrandLogo />
      <nav aria-label="Example navigation" className="flex gap-4">
        {['Docs', 'Plugins', 'Blog'].map((item) => (
          <span key={item} className="text-ui text-muted-foreground">
            {item}
          </span>
        ))}
      </nav>
    </div>
  ),
};
