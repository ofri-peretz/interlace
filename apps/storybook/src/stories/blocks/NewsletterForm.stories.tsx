import type { FormEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  NewsletterForm,
  MIN_VIEWPORT,
} from '@interlace/ui/patterns/newsletter-form';
import { withRtl } from '@/decorators';

const meta = {
  title: 'Blocks/NewsletterForm',
  component: NewsletterForm,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Single-field email capture with a required consent checkbox and an sr-only ' +
          'honeypot (`website`) that the server handler must reject when non-empty. ' +
          'Use it anywhere a list signup is a side quest — footers, sidebars, the end ' +
          'of an article — which is why MIN_VIEWPORT is 320. It does not own the ' +
          'subscription itself: wire `action` or `onSubmit`, and render success / ' +
          'error messaging yourself.',
      },
    },
  },
  args: {
    // Real spy so submitting in the canvas shows up in Actions / Interactions.
    // preventDefault keeps the preview iframe from navigating away on submit.
    onSubmit: fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    }),
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Headline above the form.',
      table: {
        type: { summary: 'ReactNode' },
        defaultValue: { summary: "'Subscribe to the newsletter'" },
      },
    },
    description: {
      control: 'text',
      description: 'Supporting copy under the title — what lands in the inbox, how often.',
      table: { type: { summary: 'ReactNode' } },
    },
    submitLabel: {
      control: 'text',
      description: 'Label on the submit button.',
      table: { type: { summary: 'ReactNode' }, defaultValue: { summary: "'Subscribe'" } },
    },
    consentLabel: {
      control: 'text',
      description:
        'Text beside the required consent checkbox. This is the GDPR-visible string — keep it specific about frequency and unsubscribe.',
      table: {
        type: { summary: 'ReactNode' },
        defaultValue: {
          summary: "'I agree to receive occasional emails. Unsubscribe any time.'",
        },
      },
    },
    footer: {
      control: false,
      description:
        'Slot below the form — typically a privacy-policy link. Elements only; see the Variants story.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
    loading: {
      control: 'boolean',
      description:
        'Swap the whole block for a `<Skeleton variant="newsletter-form" />` silhouette while the copy streams in from a CMS.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    onSubmit: {
      description:
        "Native form submit. Inherited from `React.ComponentProps<'form'>` and passed straight through to the underlying `<form>`.",
      table: { type: { summary: 'FormEventHandler<HTMLFormElement>' }, category: 'Events' },
    },
    action: {
      control: false,
      description: 'Server-action / classic POST target. Use instead of `onSubmit` in RSC apps.',
      table: {
        type: { summary: 'string | ((formData: FormData) => void)' },
        category: 'Events',
      },
    },
    className: {
      control: 'text',
      description: 'Merged onto the inner `<form>` — the width / spacing seam.',
      table: { category: 'Appearance' },
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
  args: {
    title: 'Subscribe to the newsletter',
    description: '',
    submitLabel: 'Subscribe',
    consentLabel: 'I agree to receive occasional emails. Unsubscribe any time.',
    loading: false,
  },
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

/**
 * `loading` reserves the block's footprint before the strings arrive, so a
 * footer signup does not shove the page contents up when the CMS resolves.
 */
export const Loading: Story = {
  args: { loading: true },
};

export const Dark: Story = {
  ...Variants,
  globals: { theme: 'dark' },
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
