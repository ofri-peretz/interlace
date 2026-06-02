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
          'Pricing-tier grid. 2-4 tiers, each with name + price + features + CTA. Mark one as `featured` for a "Most popular" highlight.',
      },
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
  },
};

export const Loading: Story = { args: { loading: true } };

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
