import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typography } from '@interlace/ui/typography';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Typography> = {
  title: 'Primitives/Typography',
  component: Typography,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One component for every row of the type scale, so a size is always a named step from the `--text-*` tokens rather than an ad-hoc class. The variant set encodes the reading-vs-UI split (`body`/`long` for prose, `ui`/`ui-sm`/`caption` for chrome) and each variant carries a natural element — which is a VISUAL default, not a semantic one: keep the document outline correct with `as` (`variant="h2" as="h3"`). Server component. Do not use it inside `Prose`, which already styles raw markup.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'long', 'ui', 'ui-sm', 'caption', 'code'],
      description:
        'Row of the type scale — size, leading, weight and family together. `long` is the sustained-reading step (17/28); `ui-sm` is for dense tables and meta.',
      table: {
        category: 'Appearance',
        type: { summary: "'h1'…'h6' | 'body' | 'long' | 'ui' | 'ui-sm' | 'caption' | 'code'" },
        defaultValue: { summary: "'body'" },
      },
    },
    tone: {
      control: 'select',
      options: ['default', 'foreground', 'muted', 'primary', 'destructive'],
      description:
        'Semantic colour. `default` inherits from the surrounding surface — pick it when the parent already sets the colour, and `foreground` when you need to pin it back to the page token.',
      table: {
        category: 'Appearance',
        type: { summary: "'default' | 'foreground' | 'muted' | 'primary' | 'destructive'" },
        defaultValue: { summary: "'default'" },
      },
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: 'Text alignment. Logical-free: `start`/`end` map to left/right.',
      table: {
        category: 'Appearance',
        type: { summary: "'start' | 'center' | 'end'" },
      },
    },
    as: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'code', 'label'],
      description:
        'Rendered element, independent of the visual variant. This is the seam that keeps the heading outline honest when the design calls for a size that does not match the level.',
      table: {
        category: 'Semantics',
        type: { summary: 'ElementType' },
        defaultValue: { summary: "variant's natural tag" },
      },
    },
    lineClamp: {
      control: 'select',
      options: [undefined, 1, 2, 3, 4, 5, 6],
      description:
        'Truncate to N lines with an ellipsis — the single truncation contract in the DS. Only 1–6 exist, because the classes are statically enumerated for Tailwind.',
      table: {
        category: 'Appearance',
        type: { summary: '1 | 2 | 3 | 4 | 5 | 6' },
      },
    },
    children: {
      control: 'text',
      description: 'The text itself.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
    className: {
      control: 'text',
      description: 'Merged last — use it for measure (`max-w-prose`) and margins, not for size.',
      table: { category: 'Appearance', type: { summary: 'string' } },
    },
  },
  args: {
    variant: 'body',
    tone: 'default',
    align: 'start',
  },
};

export default meta;
type Story = StoryObj<typeof Typography>;

export const Default: Story = {
  args: {
    variant: 'body',
    children:
      'The quick brown fox jumps over the lazy dog. Type at this size is meant to be read in paragraphs, so the measure is capped rather than left to fill the canvas — set lineClamp to watch the truncation contract take over.',
  },
  // Constrained to a reading measure so `lineClamp` and `align` are legible;
  // a full-bleed paragraph never wraps enough to show either.
  render: (args) => (
    <div className="max-w-prose">
      <Typography {...args} />
    </div>
  ),
};

export const Headings: Story = {
  render: () => (
    <div className="space-y-3">
      <Typography variant="h1">Heading 1 — the display top of the scale</Typography>
      <Typography variant="h2">Heading 2 — section break</Typography>
      <Typography variant="h3">Heading 3 — sub-section</Typography>
      <Typography variant="h4">Heading 4 — block heading</Typography>
      <Typography variant="h5">Heading 5 — inline heading</Typography>
      <Typography variant="h6">Heading 6 — caption-sized heading</Typography>
    </div>
  ),
};

export const Body: Story = {
  render: () => (
    <div className="space-y-3 max-w-prose">
      <Typography variant="body">
        Body text is the default reading surface — 16/24, comfortable measure (~65ch), and the line-height
        balances dense UI against long-form prose.
      </Typography>
      <Typography variant="long">
        Long-form text bumps to 17/28 for sustained reading. Use it for article bodies, philosophy
        documents, and anything the reader is expected to scan deeply rather than glance at.
      </Typography>
      <Typography variant="ui">UI text — labels, buttons, controls.</Typography>
      <Typography variant="ui-sm">UI small — dense tables, meta info.</Typography>
      <Typography variant="caption">Caption — secondary metadata or attribution.</Typography>
      <Typography variant="code">const code = &quot;mono inline&quot;;</Typography>
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="space-y-2">
      <Typography tone="default">Default tone.</Typography>
      <Typography tone="muted">Muted tone — for secondary content.</Typography>
      <Typography tone="primary">Primary tone — for accent emphasis.</Typography>
      <Typography tone="destructive">Destructive tone — for warnings.</Typography>
    </div>
  ),
};

export const Dark: Story = {
  ...Headings,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Headings,
  decorators: [withRtl],
};
