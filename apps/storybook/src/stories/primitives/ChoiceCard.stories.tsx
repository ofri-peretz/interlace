import { ChoiceCard, ChoiceCardGroup } from '@interlace/ui/choice-card';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompassIcon, LandmarkIcon, MapIcon, UtensilsIcon } from 'lucide-react';
import * as React from 'react';
import { expect, userEvent, within } from 'storybook/test';

const meta: Meta<typeof ChoiceCardGroup> = {
  title: 'Primitives/ChoiceCard',
  component: ChoiceCardGroup,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Big, tappable tiles for picking: an answer, the topics a reader cares about, the kind of session a group wants. The whole tile is the control.\n\n' +
          '**One or several.** `type="single"` is a radio group (arrow keys move the pick); `type="multiple"` is a group of checkboxes (Space toggles each). Both take `value` / `onValueChange` / `defaultValue` and post with a form through `name`.\n\n' +
          '**Accessible.** The title is the accessible name and the description line is the accessible description. The pick never rests on colour alone: the border thickens and the indicator fills with a check.\n\n' +
          '**Layout.** `layout="grid"` fills the row with tiles at least `--choice-card-min` (12rem) wide, one per row on a phone; `layout="list"` stacks full-width rows. A tile presses in while held, and stays still under reduced motion.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChoiceCardGroup>;

/** Several picks, with icons: Space or a tap toggles each tile. */
export const Default: Story = {
  render: () => (
    <div className="flex max-w-prose flex-col gap-3">
      <p id="topics-label" className="font-medium">
        What would you like to explore?
      </p>
      <ChoiceCardGroup type="multiple" aria-labelledby="topics-label" name="topics" defaultValue={['maps']}>
        <ChoiceCard value="history" title="History" description="How places came to be" media={<LandmarkIcon />} />
        <ChoiceCard value="maps" title="Maps" description="Where things are, and why" media={<MapIcon />} />
        <ChoiceCard value="food" title="Food" description="What people eat, and when" media={<UtensilsIcon />} />
        <ChoiceCard value="travel" title="Travel" description="Getting around" media={<CompassIcon />} />
      </ChoiceCardGroup>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const history = canvas.getByRole('checkbox', { name: 'History' });
    await userEvent.click(history);
    await expect(history).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByRole('checkbox', { name: 'Maps' })).toHaveAttribute('aria-checked', 'true');
  },
};

function Answers() {
  const [value, setValue] = React.useState<string | null>(null);
  return (
    <div className="flex max-w-prose flex-col gap-3">
      <p id="sides-label" className="font-medium">
        How many sides does a hexagon have?
      </p>
      <ChoiceCardGroup layout="list" aria-labelledby="sides-label" value={value} onValueChange={setValue}>
        <ChoiceCard value="5" title="Five" />
        <ChoiceCard value="6" title="Six" />
        <ChoiceCard value="7" title="Seven" />
        <ChoiceCard value="8" title="Eight" disabled />
      </ChoiceCardGroup>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {value ? `You picked ${value}.` : 'Pick one answer.'}
      </p>
    </div>
  );
}

/** One pick, stacked like quiz answers: arrow keys move the pick. */
export const OnePick: Story = {
  render: () => <Answers />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Five' }));
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('radio', { name: 'Six' })).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByText('You picked 6.')).toBeInTheDocument();
  },
};
