import { Reveal } from '@interlace/ui/effects/reveal';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type * as React from 'react';
import { expect, waitFor } from 'storybook/test';

const meta: Meta<typeof Reveal> = {
  title: 'Effects/Reveal',
  component: Reveal,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Any block that arrives as it scrolls into view: it fades in and, by `effect`, rises, sharpens or grows to size, once. The content is in the server HTML; the motion only decides when it becomes visible. Focus inside shows it at once. Under reduced motion it is simply there.',
      },
    },
  },
  argTypes: {
    effect: {
      control: 'inline-radio',
      options: ['fade', 'rise', 'blur', 'scale'],
      table: { defaultValue: { summary: 'rise' } },
    },
    delay: { control: { type: 'number', min: 0, step: 50 }, table: { defaultValue: { summary: '0' } } },
    duration: { control: { type: 'number', min: 0, step: 50 }, table: { defaultValue: { summary: '600' } } },
    amount: { control: { type: 'range', min: 0, max: 1, step: 0.05 }, table: { defaultValue: { summary: '0.2' } } },
  },
  // Every block on screen arrives and ends fully visible, so the accessibility
  // scan reads the page as people will, not a frame from the middle of a fade.
  play: async ({ canvasElement }) => {
    const blocks = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="reveal"]')];
    await expect(blocks.length).toBeGreaterThan(0);
    const first = blocks[0]!;
    await waitFor(() => expect(first.dataset.revealed).toBe('true'));
    await Promise.all(first.getAnimations().map((a) => a.finished));
    await expect(getComputedStyle(first).opacity).toBe('1');
  },
};

export default meta;
type Story = StoryObj<typeof Reveal>;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card text-card-foreground border-border max-w-prose rounded-xl border p-6 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2">{children}</p>
    </div>
  );
}

export const Default: Story = {
  args: { effect: 'rise' },
  render: (args) => (
    <Reveal {...args}>
      <Panel title="A block that arrives">It fades in and lifts a little the first time it scrolls into view.</Panel>
    </Reveal>
  ),
};

/** Scroll the canvas: each section arrives with a different effect as it enters. */
export const Effects: Story = {
  render: () => (
    <div className="flex flex-col gap-[60vh] pb-[40vh]">
      {(['rise', 'fade', 'blur', 'scale'] as const).map((effect) => (
        <Reveal key={effect} effect={effect}>
          <Panel title={`effect="${effect}"`}>
            {
              {
                rise: 'Fades in and lifts by a line height.',
                fade: 'Fades in where it stands.',
                blur: 'Fades in and comes into focus.',
                scale: 'Fades in and grows to its size.',
              }[effect]
            }
          </Panel>
        </Reveal>
      ))}
    </div>
  ),
};

/** A row of siblings sequenced with `delay`. */
export const Sequenced: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-3">
      {['Ask', 'Read', 'Answer'].map((title, i) => (
        <Reveal key={title} delay={i * 120}>
          <Panel title={title}>Arrives {i * 120} ms after the row comes into view.</Panel>
        </Reveal>
      ))}
    </div>
  ),
};
