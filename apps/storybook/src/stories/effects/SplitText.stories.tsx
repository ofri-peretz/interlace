import { SplitText } from '@interlace/ui/effects/split-text';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

import { withRtl } from '@/decorators';

const meta: Meta<typeof SplitText> = {
  title: 'Effects/SplitText',
  component: SplitText,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A headline that arrives a word, or a letter, at a time the first time it scrolls into view. The whole line is read once from a visually hidden copy; the pieces are hidden from assistive tech, so nothing is spelled out. Under reduced motion the line is simply there.',
      },
    },
  },
  argTypes: {
    as: { control: 'select', options: ['h1', 'h2', 'h3', 'h4', 'p', 'span'], table: { defaultValue: { summary: 'span' } } },
    by: { control: 'inline-radio', options: ['word', 'letter'], table: { defaultValue: { summary: 'word' } } },
    effect: { control: 'inline-radio', options: ['fade', 'rise', 'blur'], table: { defaultValue: { summary: 'rise' } } },
    step: { control: { type: 'number', min: 0, step: 10 } },
    duration: { control: { type: 'number', min: 0, step: 50 }, table: { defaultValue: { summary: '500' } } },
    delay: { control: { type: 'number', min: 0, step: 50 }, table: { defaultValue: { summary: '0' } } },
  },
  args: {
    as: 'h2',
    children: 'Small steps make long journeys',
    className: 'text-4xl font-semibold tracking-tight text-balance max-w-[18ch] text-center',
  },
  // Every piece arrives and ends fully visible; the heading's name is the whole line.
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-slot="split-text"]')!;
    await waitFor(() => expect(root.dataset.revealed).toBe('true'));
    const pieces = [...root.querySelectorAll<HTMLElement>('[data-slot="split-text-piece"]')];
    await Promise.all(pieces.flatMap((p) => p.getAnimations()).map((a) => a.finished));
    for (const p of pieces) await expect(getComputedStyle(p).opacity).toBe('1');
    const heading = canvasElement.querySelector('h1, h2, h3, h4');
    if (heading) await expect(heading.textContent).toContain(root.querySelector('.sr-only')!.textContent!);
  },
};

export default meta;
type Story = StoryObj<typeof SplitText>;

export const Default: Story = {};
export const ByLetter: Story = { args: { by: 'letter', effect: 'blur' } };
export const Fade: Story = { args: { effect: 'fade', step: 120 } };
/** In RTL the first word is on the right, so the line arrives from the right. */
export const RTL: Story = {
  args: { children: 'צעדים קטנים עושים מסע ארוך', by: 'word' },
  decorators: [withRtl],
};
