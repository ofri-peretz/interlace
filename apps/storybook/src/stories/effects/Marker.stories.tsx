import { Marker } from '@interlace/ui/effects/marker';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

const meta: Meta<typeof Marker> = {
  title: 'Effects/Marker',
  component: Marker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A highlighter stroke across the one phrase a reader should not miss. It is a `<mark>`; the stroke sweeps in from the inline-start edge the first time the phrase scrolls into view, and wraps across lines with the text. The text never changes colour. In forced colours it becomes an underline; under reduced motion the stroke is simply there.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['band', 'full', 'underline'],
      table: { defaultValue: { summary: 'band' } },
    },
    tone: {
      control: 'inline-radio',
      options: ['highlight', 'primary'],
      table: { defaultValue: { summary: 'highlight' } },
    },
    duration: { control: { type: 'number', min: 0, step: 50 }, table: { defaultValue: { summary: '700' } } },
    delay: { control: { type: 'number', min: 0, step: 50 }, table: { defaultValue: { summary: '150' } } },
  },
  // Every stroke is down before the accessibility scan and the screenshot.
  play: async ({ canvasElement }) => {
    const marks = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="marker"]')];
    await expect(marks.length).toBeGreaterThan(0);
    await waitFor(() => expect(marks[0]!.dataset.marked).toBe('true'));
    await Promise.all(marks.flatMap((m) => m.getAnimations()).map((a) => a.finished.catch(() => undefined)));
  },
};

export default meta;
type Story = StoryObj<typeof Marker>;

export const Default: Story = {
  args: { variant: 'band', tone: 'highlight' },
  render: (args) => (
    <p className="text-foreground max-w-prose text-lg leading-relaxed">
      The bridge took eleven years to build. Most of that time went into the foundations, and{' '}
      <Marker {...args}>the river moved twice before the first pier was set</Marker>, so the plans were drawn three
      times.
    </p>
  ),
};

/** The three shapes, in both tones. */
export const Variants: Story = {
  render: () => (
    <div className="flex max-w-prose flex-col gap-4 text-lg">
      {(['band', 'full', 'underline'] as const).map((variant) => (
        <p key={variant} className="text-foreground">
          <Marker variant={variant}>variant=&quot;{variant}&quot;</Marker> and{' '}
          <Marker variant={variant} tone="primary">
            tone=&quot;primary&quot;
          </Marker>
        </p>
      ))}
    </div>
  ),
};

/** In a right-to-left paragraph the stroke starts on the right. */
export const RightToLeft: Story = {
  render: () => (
    <p dir="rtl" lang="ar" className="text-foreground max-w-prose text-lg leading-relaxed">
      استغرق بناء الجسر أحد عشر عامًا، و<Marker>تغيّر مجرى النهر مرتين</Marker> قبل وضع الركيزة الأولى.
    </p>
  ),
};
