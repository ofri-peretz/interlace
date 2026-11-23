import { StaggerList } from '@interlace/ui/effects/stagger-list';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

const meta: Meta<typeof StaggerList> = {
  title: 'Effects/StaggerList',
  component: StaggerList,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A real `ul` or `ol` whose items arrive one after another the first time it scrolls into view. Every item is in the server HTML; the motion only decides when each becomes visible, once. An item that receives focus early shows at once. Under reduced motion the items are simply there.',
      },
    },
  },
  argTypes: {
    as: { control: 'inline-radio', options: ['ul', 'ol'], table: { defaultValue: { summary: 'ul' } } },
    step: { control: { type: 'number', min: 0, step: 10 }, table: { defaultValue: { summary: '90' } } },
    duration: { control: { type: 'number', min: 0, step: 20 }, table: { defaultValue: { summary: '420' } } },
    gap: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'], table: { defaultValue: { summary: 'md' } } },
  },
  args: {
    children: [
      'Read the question as it was asked.',
      'Find three sources that agree, and one that does not.',
      'Quote the other side in its own words.',
      'Say what is still contested.',
    ].map((text) => <span key={text}>{text}</span>),
  },
  // Every item arrives, once, and ends fully visible. Waiting for the arrival
  // also means the accessibility scan reads the list as people will, not a
  // frame from the middle of a fade.
  play: async ({ canvasElement }) => {
    const items = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="stagger-list-item"]')];
    await expect(items.length).toBeGreaterThan(0);
    await waitFor(() => expect(items.every((item) => item.dataset.revealed === 'true')).toBe(true));
    await Promise.all(items.flatMap((item) => item.getAnimations()).map((a) => a.finished));
    for (const item of items) await expect(getComputedStyle(item).opacity).toBe('1');
  },
};

export default meta;
type Story = StoryObj<typeof StaggerList>;

export const Default: Story = {};
export const Numbered: Story = { args: { as: 'ol' } };
