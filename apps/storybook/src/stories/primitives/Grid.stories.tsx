import type { Meta, StoryObj } from '@storybook/react-vite';
import { Grid, GridItem } from '@interlace/ui/grid';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof Grid> = {
  title: 'Primitives/Grid',
  component: Grid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The 2-D sibling of `Stack`: a thin CSS-grid container whose column count and gap are both closed token sets, so no call site can invent an off-system track or spacing. Responsiveness lives on the cells — `GridItem` takes `span` / `mdSpan` / `lgSpan` — not on the container. Reach for it when content genuinely occupies rows *and* columns; a single row of equal items is a `Stack`, and a page-level width constraint is `Container`.',
      },
    },
  },
  argTypes: {
    cols: {
      control: 'select',
      options: [1, 2, 3, 4, 6, 12],
      description:
        'Column track count. Closed set (R21) — 12 is the base track most layouts span against.',
      table: {
        category: 'Appearance',
        type: { summary: '1 | 2 | 3 | 4 | 6 | 12' },
        defaultValue: { summary: '12' },
      },
    },
    gap: {
      control: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      description:
        'Gutter from the foundation `--spacing` scale (8 / 16 / 24 / 40 / 64 / 96px). Applies to both axes.',
      table: {
        category: 'Appearance',
        type: { summary: "'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'" },
        defaultValue: { summary: 'md' },
      },
    },
    as: {
      control: 'select',
      options: ['div', 'section'],
      description:
        'Render as a different element so the grid can also carry the semantics of the region it lays out. Any `React.ElementType` is accepted — `ul`/`ol` are valid too, provided the cells render as `li` (`<GridItem as="li">`).',
      table: {
        category: 'Appearance',
        type: { summary: 'React.ElementType' },
        defaultValue: { summary: 'div' },
      },
    },
    className: {
      control: 'text',
      description:
        'Merged via `cn()` after the variant classes — the seam for row sizing (`auto-rows-fr`) or alignment, which the closed variant API deliberately does not cover.',
      table: { category: 'Appearance' },
    },
    children: {
      control: false,
      description: 'The cells. Plain elements, or `GridItem` when a cell must span.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Grid>;

const Cell = ({ label }: { label: string }) => (
  <div className="rounded-md border border-fd-border bg-fd-card/40 px-4 py-3 text-sm">
    {label}
  </div>
);

export const Default: Story = {
  args: { cols: 3, gap: 'md', as: 'div', className: '' },
  render: (args) => (
    <Grid {...args}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Cell key={`cell-${i}`} label={`Cell ${i + 1}`} />
      ))}
    </Grid>
  ),
};

/**
 * Responsiveness is a CELL concern, not a container one — `Grid` has no
 * `mdCols`/`lgCols`. Keep the track at 12 and let each `GridItem` restate its
 * span per breakpoint: full width on phones, halves from `md`, quarters from
 * `lg`. Resize the canvas to see it move.
 */
export const Responsive: Story = {
  render: () => (
    <Grid cols={12} gap="md">
      {Array.from({ length: 8 }).map((_, i) => (
        <GridItem key={`responsive-cell-${i}`} span="full" mdSpan={6} lgSpan={3}>
          <Cell label={`Cell ${i + 1}`} />
        </GridItem>
      ))}
    </Grid>
  ),
};

export const WithSpan: Story = {
  render: () => (
    <Grid cols={6} gap="md">
      <GridItem span={2}><Cell label="span 2" /></GridItem>
      <GridItem span={4}><Cell label="span 4" /></GridItem>
      <GridItem span={3}><Cell label="span 3" /></GridItem>
      <GridItem span={3}><Cell label="span 3" /></GridItem>
    </Grid>
  ),
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
