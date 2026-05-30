import type { Meta, StoryObj } from '@storybook/react-vite';
import { Callout, MIN_VIEWPORT } from '@interlace/ui/callout';
import { withDark, withRtl } from '@/decorators';

const meta = {
  title: 'Primitives/Callout',
  component: Callout,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Inline-prose annotation — the "stop and read this" surface that punctuates long-form content (docs, MDX). Five tones (info / note / success / warn / danger), each fixed to a lucide icon and a semantic-token left border. Distinct from `Alert` (out-of-band runtime banner). Server component; MIN_VIEWPORT = 320px so callouts work inside body prose on a 320 CSS-px iPhone SE.',
      },
    },
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['info', 'note', 'success', 'warn', 'danger'],
    },
    title: { control: 'text' },
  },
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tone: 'info',
    title: 'Type-aware rule',
    children:
      'This rule needs TypeScript type information to flag the violation. Enable parserOptions.project in your ESLint config.',
  },
  render: (args) => (
    <div className="w-[640px]">
      <Callout {...args} />
    </div>
  ),
};

/**
 * Full tone matrix — every tone with and without a title, so the grid
 * doubles as a visual regression sheet for the cva variants and the
 * Typography title slot.
 */
export const Variants: Story = {
  render: () => {
    const tones = ['info', 'note', 'success', 'warn', 'danger'] as const;
    const copy: Record<(typeof tones)[number], string> = {
      info: 'Heads-up context that runs parallel to the body prose.',
      note: 'Author tip — usually a shortcut or a non-obvious pairing.',
      success: 'The happy path landed; no further action required.',
      warn: 'Non-blocking caution — read before continuing.',
      danger: 'Destructive or blocking consequence; review carefully.',
    };

    return (
      <div className="flex w-[640px] flex-col gap-md">
        {tones.map((tone) => (
          <Callout
            key={`${tone}-titled`}
            tone={tone}
            title={`tone="${tone}" (titled)`}
          >
            {copy[tone]}
          </Callout>
        ))}
        {tones.map((tone) => (
          <Callout key={`${tone}-bare`} tone={tone}>
            tone=&quot;{tone}&quot; — body-only, no title slot.
          </Callout>
        ))}
      </div>
    );
  },
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  args: {
    tone: 'warn',
    title: 'تنبيه',
    children:
      'هذا التحذير يتدفق من اليمين إلى اليسار؛ يجب أن ينعكس الأيقونة والحدود تلقائياً.',
  },
  decorators: [withRtl],
};

/**
 * Below-min-viewport demo — wrap in a (MIN_VIEWPORT - 1)px container with
 * the `data-interlace-dev` flag so preflight's dashed warning outline
 * appears. The callout still renders (graceful degradation).
 */
export const BelowMinViewport: Story = {
  render: () => (
    <div data-interlace-dev style={{ width: MIN_VIEWPORT - 1 }}>
      <Callout tone="warn" title={`< ${MIN_VIEWPORT}px — dev outline`}>
        Below MIN_VIEWPORT — preflight flags the container in dev; the
        callout itself still reflows and stays readable.
      </Callout>
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
