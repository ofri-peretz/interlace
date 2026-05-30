import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  NewsletterForm,
  MIN_VIEWPORT,
} from '@interlace/ui/blocks/newsletter-form';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/NewsletterForm',
  component: NewsletterForm,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Canonical email-signup pattern. Composes Form + Field + Input + Button + Checkbox. Includes an sr-only honeypot field (`website`) — the server handler rejects any submission where it is non-empty. Server component; MIN_VIEWPORT = 320px so the form works inside narrow footers and sidebars.',
      },
    },
  },
} satisfies Meta<typeof NewsletterForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default — minimal newsletter signup. Title + email + consent + submit.
 * No description, no footer; the shortest path through the block.
 */
export const Default: Story = {
  args: {},
};

/**
 * Variants — the same block with description + custom labels + footer.
 * Shows how the optional slots stack and how `submitLabel` / `consentLabel`
 * carry brand voice.
 */
export const Variants: Story = {
  args: {
    title: 'Get the weekly digest',
    description:
      'One email each Sunday: new rules, ecosystem news, and the occasional rant.',
    submitLabel: 'Sign me up',
    consentLabel:
      'Yes, send me the digest. I can unsubscribe with one click.',
    footer: (
      <>
        We never sell your address. Read our{' '}
        <a href="#" className="underline">
          privacy policy
        </a>
        .
      </>
    ),
  },
};

export const Dark: Story = {
  ...Variants,
  decorators: [withDark],
};

export const RTL: Story = {
  args: {
    title: 'اشترك في النشرة الإخبارية',
    description: 'بريد إلكتروني واحد كل أسبوع. يمكنك إلغاء الاشتراك في أي وقت.',
    submitLabel: 'اشترك',
    consentLabel: 'أوافق على تلقي رسائل بريد إلكتروني عرضية.',
  },
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap the form in a (MIN_VIEWPORT - 1)px
 * container with `data-interlace-dev` so preflight's dashed warning outline
 * fires. The form still renders + still works; the outline simply flags
 * that the consumer is asking the block to operate under its declared
 * floor (R14).
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <NewsletterForm
        description={`< ${MIN_VIEWPORT}px — dev outline fires; form still works.`}
      />
    </div>
  ),
  decorators: [
    (Story) => (
      <div
        ref={(node) => {
          if (node && typeof document !== 'undefined') {
            document.body.setAttribute('data-interlace-dev', '');
          }
        }}
      >
        <Story />
      </div>
    ),
  ],
};
