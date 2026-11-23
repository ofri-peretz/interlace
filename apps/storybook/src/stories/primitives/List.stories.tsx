import type { Meta, StoryObj } from '@storybook/react-vite';
import { List, ListItem } from '@interlace/ui/list';
import { Typography } from '@interlace/ui/typography';
import { Citation } from '@interlace/ui/patterns/citation';
import { expect, within } from 'storybook/test';

// Placeholder content: the publishers are fictional and every URL points at
// example.com.
const SOURCE = [{ publisher: 'Example Gazette', url: 'https://example.com/a', quote: 'The quoted line.' }];

const meta: Meta<typeof List> = {
  title: 'Primitives/List',
  component: List,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A list whose markers carry the voice of the page. `bullet` for plain lists, `number` (a real `ol`, numbered by the browser) for claims read in order, `check` for what is true or included, `cross` for what is not claimed. Markers are drawn in CSS and centre on the first line, whatever the item holds. They are decoration: put a heading above a list of crosses that says what the crosses mean.',
      },
    },
  },
  argTypes: {
    marker: {
      control: 'inline-radio',
      options: ['bullet', 'number', 'check', 'cross'],
      table: { defaultValue: { summary: 'bullet' } },
    },
    density: {
      control: 'inline-radio',
      options: ['compact', 'default', 'relaxed'],
      table: { defaultValue: { summary: 'default' } },
    },
  },
  args: { marker: 'bullet', density: 'default' },
  render: (args) => (
    <List {...args} aria-label="Example list">
      <ListItem>The bridge reopened on Monday.</ListItem>
      <ListItem>Traffic is expected to be back to normal by Friday, after six weeks of repairs.</ListItem>
      <ListItem>The city will publish the final cost next month.</ListItem>
    </List>
  ),
};

export default meta;
type Story = StoryObj<typeof List>;

export const Default: Story = {};

/** Claims read in order, each with a source chip after it. */
export const NumberedClaims: Story = {
  args: { marker: 'number' },
  render: (args) => (
    <List {...args} aria-label="The claims" className="max-w-prose">
      <ListItem>The bridge has been closed for different reasons over the years.</ListItem>
      <ListItem>
        <Citation marker="chip" sources={SOURCE}>
          The 2019 closure was for a safety inspection; the city reopened it after two weeks, though
          residents disputed how thorough the inspection was.
        </Citation>
      </ListItem>
      <ListItem>
        <Citation marker="chip" sources={SOURCE}>
          This year&apos;s closure was for repairs.
        </Citation>
      </ListItem>
    </List>
  ),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'The claims' });
    await expect(list.tagName).toBe('OL');
  },
};

/** A heading says what the crosses mean; the crosses only repeat it. */
export const Crosses: Story = {
  args: { marker: 'cross' },
  render: (args) => (
    <section aria-labelledby="not-saying" className="max-w-prose space-y-3">
      <Typography variant="h4" as="h2" id="not-saying">
        What we&apos;re not saying
      </Typography>
      <List {...args} aria-labelledby="not-saying">
        <ListItem>That the repairs were unnecessary, or that they were.</ListItem>
        <ListItem>That everyone who complained wanted the bridge closed for good.</ListItem>
      </List>
    </section>
  ),
};

export const Checks: Story = { args: { marker: 'check' } };

/** The marker stays on the first line at every text size. */
export const Sizes: Story = {
  render: () => (
    <div className="space-y-6">
      {(['text-sm', 'text-base', 'text-xl'] as const).map((size) => (
        <List key={size} marker="number" className={size} aria-label={size}>
          <ListItem>One line at {size}.</ListItem>
          <ListItem>A longer item that wraps onto a second line so the marker stays put on the first.</ListItem>
        </List>
      ))}
    </div>
  ),
};
