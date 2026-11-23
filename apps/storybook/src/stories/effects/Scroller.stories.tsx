import { Scroller } from '@interlace/ui/effects/scroller';
import type { Meta, StoryObj } from '@storybook/react-vite';

const NAMES = ['Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Woodgrove', 'Litware', 'Proseware', 'Adatum'];

const meta: Meta<typeof Scroller> = {
  title: 'Effects/Scroller',
  component: Scroller,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A row of items that glides past on a loop. The items render once as a list; the loop copy is hidden and inert, so each item is announced and tabbed to once. A visible Pause button sits beside it (WCAG 2.2.2), and hover or focus inside pauses it too. Under reduced motion nothing moves and the row simply scrolls.',
      },
    },
  },
  argTypes: {
    direction: { control: 'inline-radio', options: ['left', 'right', 'up', 'down'], table: { defaultValue: { summary: 'left' } } },
    duration: { control: { type: 'number', min: 5, step: 5 }, table: { defaultValue: { summary: '40' } } },
    gap: { control: 'inline-radio', options: ['sm', 'md', 'lg'], table: { defaultValue: { summary: 'md' } } },
    edges: { control: 'inline-radio', options: ['fade', 'none'], table: { defaultValue: { summary: 'fade' } } },
    pauseOnHover: { control: 'boolean', table: { defaultValue: { summary: 'true' } } },
    label: { control: 'text' },
  },
  args: {
    label: 'Organisations we work with',
    children: NAMES.map((name) => (
      <span key={name} className="text-muted-foreground font-heading text-xl font-semibold">
        {name}
      </span>
    )),
  },
};

export default meta;
type Story = StoryObj<typeof Scroller>;

export const Default: Story = {};
export const Right: Story = { args: { direction: 'right' } };
export const Links: Story = {
  args: {
    children: NAMES.map((name) => (
      <a key={name} href={`#${name}`} className="text-foreground underline underline-offset-4">
        {name}
      </a>
    )),
  },
};
export const Vertical: Story = {
  args: { direction: 'up', duration: 20 },
  render: (args) => (
    <div className="h-64">
      <Scroller {...args} className="h-full" />
    </div>
  ),
};
