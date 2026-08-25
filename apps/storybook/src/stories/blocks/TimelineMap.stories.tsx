import { TimelineMap } from '@interlace/ui/patterns/timeline-map';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

/**
 * Fixture: a release territory — three lanes of shipped work across two
 * years, weights encoding relative impact. Dates are static so the axis
 * ticks (and therefore the story snapshot) never drift.
 */
const items = [
  { id: 'r1', href: '#jwt', label: 'eslint-plugin-jwt v1', category: 'Security', date: '2024-09-12', weight: 0.6 },
  { id: 'r2', href: '#nestjs', label: 'nestjs-security launch', category: 'Security', date: '2025-01-20', weight: 0.9 },
  { id: 'r3', href: '#lambda', label: 'lambda-security launch', category: 'Security', date: '2025-03-02', weight: 0.7 },
  { id: 'r4', href: '#mongodb', label: 'mongodb-security launch', category: 'Security', date: '2025-03-02', weight: 0.5 },
  { id: 'r5', href: '#import', label: 'import-next fast tier', category: 'Performance', date: '2025-05-18', weight: 0.8 },
  { id: 'r6', href: '#oxlint', label: 'Oxlint parity milestone', category: 'Performance', date: '2025-11-07', weight: 1 },
  { id: 'r7', href: '#a11y', label: 'react-a11y rewrite', category: 'Quality', date: '2025-08-30', weight: 0.4 },
  { id: 'r8', href: '#modern', label: 'modernization preset', category: 'Quality', date: '2026-02-14', weight: 0.3 },
  { id: 'r9', href: '#devkit', label: 'eslint-devkit', date: '2026-04-01', weight: 0.5 },
];

const meta: Meta<typeof TimelineMap> = {
  title: 'Blocks/TimelineMap',
  component: TimelineMap,
  // Width-filling figure, same reasoning as ArticleCard: `centered` would
  // resolve the strip against an indefinite container.
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Data as explorable territory: items become dots on category lanes over a time ' +
          'axis, with a center-first beeswarm fan for same-quarter clusters. Compound — ' +
          '`TimelineMap.Filter` (aria-pressed category chips), `TimelineMap.Chart` (the ' +
          'lanes), `TimelineMap.Detail` (fixed-height preview strip, CLS=0). One tab stop: ' +
          'dots are a roving-tabindex composite (Arrow keys traverse, Home/End jump), per ' +
          'the APG grid pattern. Marks paint in the strand-a brand token only.',
      },
    },
  },
  argTypes: {
    items: {
      control: 'object',
      description: 'The territory. Items without a parseable `date` are not rendered.',
      table: { category: 'Content', type: { summary: 'TimelineMapItem[]' } },
    },
    'data-testid': {
      control: 'text',
      description: 'Stable E2E selector; consumer provides — no default.',
      table: { category: 'Contract', type: { summary: 'string' } },
    },
    uncategorizedLabel: {
      control: 'text',
      description: 'Lane label for items without a category. That lane always sorts last.',
      table: { category: 'Content', type: { summary: 'string' }, defaultValue: { summary: 'Other' } },
    },
    filter: {
      control: 'object',
      description: 'Controlled set of visible categories. Omit for uncontrolled.',
      table: { category: 'Behavior', type: { summary: 'string[]' } },
    },
    defaultFilter: {
      control: 'object',
      description: 'Uncontrolled initial visible categories.',
      table: { category: 'Behavior', type: { summary: 'string[]' } },
    },
    onFilterChange: {
      action: 'filterChange',
      description: 'Next visible-category set when a chip is toggled.',
      table: { category: 'Events' },
    },
    linkComponent: {
      control: false,
      description: 'Framework link injected for dot anchors (R10 `xxxComponent`).',
      table: { category: 'Injection', type: { summary: 'React.ElementType' }, defaultValue: { summary: '"a"' } },
    },
  },
};
export default meta;

type Story = StoryObj<typeof TimelineMap>;

const renderCompound: Story['render'] = (args) => (
  <TimelineMap {...args}>
    <TimelineMap.Filter />
    <TimelineMap.Chart />
    <TimelineMap.Detail />
  </TimelineMap>
);

/** The full compound: chips, lanes, and the fixed-height detail strip. */
export const Default: Story = {
  args: { items, 'data-testid': 'timeline-map' },
  render: renderCompound,
};

/**
 * Keyboard contract (R26): the dot composite is ONE tab stop; ArrowRight
 * moves the roving tabindex to the next dot chronologically.
 */
export const KeyboardTraversal: Story = {
  args: { items, 'data-testid': 'timeline-map-kbd' },
  render: (args) => (
    <TimelineMap {...args}>
      <TimelineMap.Chart />
      <TimelineMap.Detail />
    </TimelineMap>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dots = canvas.getAllByRole('link');
    // Exactly one dot is in the tab order at rest.
    expect(dots.filter((d) => d.tabIndex === 0)).toHaveLength(1);
    const first = dots.find((d) => d.tabIndex === 0)!;
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).not.toBe(first);
    // The roving tabindex moved WITH focus — still exactly one tab stop.
    expect(dots.filter((d) => d.tabIndex === 0)).toHaveLength(1);
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
  },
};

/** Controlled filter: only the named lanes render, chips reflect state. */
export const FilteredLanes: Story = {
  args: {
    items,
    'data-testid': 'timeline-map-filtered',
    filter: ['Security'],
  },
  render: renderCompound,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('button', { name: 'Security' })).toHaveAttribute('aria-pressed', 'true');
    expect(canvas.getByRole('button', { name: 'Performance' })).toHaveAttribute('aria-pressed', 'false');
  },
};
