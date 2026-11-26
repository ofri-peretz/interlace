import type * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { DirectionProvider } from '@interlace/ui/direction';
import { SimpleSlider } from '@interlace/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@interlace/ui/tabs';

const meta = {
  title: 'Primitives/Direction',
  component: DirectionProvider,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Sets the reading direction once for both the CSS and the keyboard. `dir="rtl"` alone flips layout but not behaviour: Base UI reads direction from React context, so without this provider a slider still grows to the right and ArrowRight still moves to the next tab. Put it at the app root next to `<html dir>`, or around a subtree in the other direction. It renders a `display: contents` wrapper, so it never changes layout.',
      },
    },
  },
  argTypes: {
    direction: {
      control: 'inline-radio',
      options: ['ltr', 'rtl'],
      description: 'The reading direction of everything inside.',
      table: {
        category: 'Behaviour',
        type: { summary: "'ltr' | 'rtl'" },
        defaultValue: { summary: "'ltr'" },
      },
    },
  },
  args: { direction: 'rtl' },
} satisfies Meta<typeof DirectionProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

const Demo = (args: React.ComponentProps<typeof DirectionProvider>) => (
  <DirectionProvider {...args}>
    <div className="flex max-w-prose flex-col gap-6">
      <SimpleSlider label="Volume" defaultValue={30} />
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
          <TabsTrigger value="three">Three</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First panel</TabsContent>
        <TabsContent value="two">Second panel</TabsContent>
        <TabsContent value="three">Third panel</TabsContent>
      </Tabs>
    </div>
  </DirectionProvider>
);

/** In a right-to-left page the slider fills from the right and ArrowLeft moves to the next tab. */
export const RightToLeft: Story = {
  render: (args) => <Demo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('tab', { name: 'One' });
    await userEvent.click(first);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('tab', { name: 'Two' })).toHaveFocus();
  },
};

/** The default: left to right, the same as no provider at all. */
export const LeftToRight: Story = {
  args: { direction: 'ltr' },
  render: (args) => <Demo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'One' }));
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Two' })).toHaveFocus();
  },
};
