import type { Meta, StoryObj } from '@storybook/react-vite';
import { PricingTable } from '@interlace/ui/patterns/pricing-table';
import { Button } from '@interlace/ui/button';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof PricingTable> = {
  title: 'Blocks/PricingTable',
  component: PricingTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Comparison grid of 2–4 plans, each a card of name / price / description / ' +
          'feature list / CTA, with one optionally `featured` for the "Most popular" ' +
          'ring. `cols` is a DESKTOP track count — the grid collapses to one column on ' +
          'phones regardless, because a 3-up pricing card at 375px overflows its own ' +
          'price. Reach for it on a plans page; for a feature-by-feature matrix use a ' +
          'real table, which this is not.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Section heading above the grid. Omit to render the cards alone.',
      table: { type: { summary: 'ReactNode' } },
    },
    lead: {
      control: 'text',
      description: 'Supporting paragraph under the title, capped at prose width.',
      table: { type: { summary: 'ReactNode' } },
    },
    tiers: {
      control: 'object',
      description:
        'The plans, in display order: `{ name, price, pricePer?, description?, features?, cta?, featured? }`. `cta` and every text field are ReactNode, so the JSON control edits the strings but the CTA elements are opaque here.',
      table: { type: { summary: 'PricingTier[]' }, category: 'Data' },
    },
    cols: {
      control: 'select',
      options: [2, 3, 4],
      description:
        'Desktop column count. Match it to `tiers.length`; a mismatch leaves an empty track.',
      table: {
        type: { summary: '2 | 3 | 4' },
        defaultValue: { summary: '3' },
        category: 'Appearance',
      },
    },
    loading: {
      control: 'boolean',
      description:
        'Render `cols` card skeletons instead of the tiers. Pricing is usually fetched (currency, geo, active promo), so the grid reserves its height first.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the `<section>` — the outer padding seam.',
      table: { category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PricingTable>;

const sampleTiers = [
  {
    name: 'Hobby',
    price: '$0',
    pricePer: '/ forever',
    description: 'Personal projects and weekends.',
    features: ['MIT licensed', 'All primitives', 'Community support'],
    cta: <Button variant="outline">Start free</Button>,
  },
  {
    name: 'Pro',
    price: '$29',
    pricePer: '/ month',
    description: 'Teams shipping production.',
    features: [
      'Everything in Hobby',
      'Priority issues',
      'Private design tokens',
      'Slack support',
    ],
    cta: <Button>Get Pro</Button>,
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'White-glove for large orgs.',
    features: [
      'Everything in Pro',
      'Dedicated solutions engineer',
      'Custom SLAs',
      'On-prem deployment',
    ],
    cta: <Button variant="outline">Contact sales</Button>,
  },
];

export const Default: Story = {
  args: {
    title: 'Simple, transparent pricing',
    lead: 'Pay for what you ship.',
    tiers: sampleTiers,
    cols: 3,
    loading: false,
  },
};

export const Loading: Story = { args: { loading: true, cols: 3 } };

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
