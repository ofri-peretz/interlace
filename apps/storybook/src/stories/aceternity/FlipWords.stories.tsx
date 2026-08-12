import type { Meta, StoryObj } from '@storybook/react-vite';
import { FlipWords } from '@interlace/ui/aceternity/flip-words';

/**
 * FlipWords stories
 *
 * An inline headline word that flips through a list of alternatives, entering
 * letter-by-letter with a soft blur-and-rise. Color is inherited via
 * currentColor, so the surrounding text color drives it rather than a prop.
 * The component already announces the active word through its own polite
 * live region, so no story adds a second one. Under prefers-reduced-motion
 * it renders the active word statically with no cycling.
 */

const meta: Meta<typeof FlipWords> = {
  title: 'Aceternity/FlipWords',
  component: FlipWords,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single flipping word or phrase meant to sit inline inside a real headline. Controlled via index/onIndexChange or left uncontrolled with defaultIndex. Honors prefers-reduced-motion by stopping cycling and dropping the enter/exit animation.',
      },
    },
  },
  argTypes: {
    words: {
      control: 'object',
      description: 'Ordered list of words or short phrases to cycle through.',
      table: { type: { summary: 'string[]' }, category: 'Content' },
    },
    duration: {
      control: { type: 'number', min: 500, max: 6000, step: 100 },
      description: 'Milliseconds a word stays on screen before flipping to the next.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '3000' }, category: 'Motion' },
    },
    defaultIndex: {
      control: { type: 'number', min: 0 },
      description: 'Index of the word shown on first render when uncontrolled. Ignored when index is provided.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' }, category: 'State' },
    },
    pauseOnHover: {
      control: 'boolean',
      description: 'Pause cycling while the pointer is over the component.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'Behavior' },
    },
    wordStagger: {
      control: { type: 'number', min: 0, max: 1, step: 0.05 },
      description: 'Stagger between each word in a multi-word entry, in seconds.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.3' }, category: 'Motion' },
    },
    letterStagger: {
      control: { type: 'number', min: 0, max: 0.3, step: 0.01 },
      description: 'Stagger between each letter within a word, in seconds.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0.05' }, category: 'Motion' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FlipWords>;

export const Default: Story = {
  args: {
    'data-testid': 'flip-words',
    words: ['faster', 'safer', 'cleaner', 'smarter'],
  },
};

export const Headline: Story = {
  tags: ['preview'],
  args: {
    'data-testid': 'flip-words-headline',
    words: ['faster', 'safer', 'cleaner', 'smarter'],
  },
  render: (args) => (
    <div className="rounded-lg border border-border bg-background p-6 text-2xl font-semibold text-foreground">
      Ship <FlipWords {...args} /> with the Interlace design system
    </div>
  ),
};

export const Dark: Story = {
  ...Headline,
  globals: { theme: 'dark' },
};

export const LongDwell: Story = {
  name: 'Long dwell (duration=5000)',
  args: { ...Default.args, duration: 5000 },
};

export const PauseOnHover: Story = {
  name: 'Pause on hover',
  args: { ...Default.args, pauseOnHover: true },
};
