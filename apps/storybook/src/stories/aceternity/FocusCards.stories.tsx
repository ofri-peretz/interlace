import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusCard, FocusCards } from '@interlace/ui/aceternity/focus-cards';

/**
 * FocusCards stories
 *
 * A responsive grid where pointing at or keyboard-focusing a card keeps it
 * sharp while its siblings dim and blur. Data-shape agnostic: pass any array
 * plus a renderItem function that returns a FocusCard. Media here is an
 * inline SVG data URI (no network in CI / a11y runs) with descriptive alt
 * text on every card.
 */

interface DemoItem {
  id: string;
  title: string;
  color: string;
  alt: string;
}

function swatch(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const items: DemoItem[] = [
  { id: 'ocean', title: 'Ocean', color: '#2563eb', alt: 'Solid blue placeholder image for the Ocean card' },
  { id: 'forest', title: 'Forest', color: '#16a34a', alt: 'Solid green placeholder image for the Forest card' },
  { id: 'sunset', title: 'Sunset', color: '#ea580c', alt: 'Solid orange placeholder image for the Sunset card' },
];

const meta: Meta<typeof FocusCards<DemoItem>> = {
  title: 'Aceternity/FocusCards',
  component: FocusCards,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A grid that spotlights one card at a time: pointing at or keyboard-focusing a card keeps it sharp while every sibling dims and blurs. Controlled via activeIndex/onActiveChange or left uncontrolled. Reduced-motion users get the dim/sharpen contrast without the blur or scale transition.',
      },
    },
  },
  argTypes: {
    items: {
      control: false,
      description: 'Data for each card. Any array works; each entry is rendered via renderItem.',
      table: { type: { summary: 'readonly TItem[]' }, category: 'Content' },
    },
    columns: {
      control: 'select',
      options: [1, 2, 3, 4],
      description: 'Column count at the largest breakpoint. Mobile is always a single column.',
      table: { type: { summary: '1 | 2 | 3 | 4' }, defaultValue: { summary: '3' }, category: 'Layout' },
    },
    defaultActiveIndex: {
      control: { type: 'number', min: 0 },
      description: 'Initial active card index for uncontrolled usage.',
      table: { type: { summary: 'number | null' }, defaultValue: { summary: 'null' }, category: 'State' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FocusCards<DemoItem>>;

export const Default: Story = {
  args: {
    'data-testid': 'focus-cards',
    items,
    columns: 3,
    renderItem: (item, index) => (
      <FocusCard
        key={item.id}
        data-testid={`focus-cards-card-${index}`}
        caption={<span className="text-sm font-semibold">{item.title}</span>}
      >
        <img src={swatch(item.color)} alt={item.alt} />
      </FocusCard>
    ),
  },
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const TwoColumns: Story = {
  name: 'Two columns',
  args: { ...Default.args, columns: 2 },
};

export const PreselectedActive: Story = {
  name: 'Preselected active card (defaultActiveIndex=1)',
  args: { ...Default.args, defaultActiveIndex: 1 },
};
