import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { NetworkGraph } from '@interlace/ui/charts/network-graph';
import { withRtl } from '@/decorators';

import { GRAPH_EDGES, GRAPH_NODES } from './fixtures';

const meta: Meta<typeof NetworkGraph> = {
  title: 'Charts/NetworkGraph',
  component: NetworkGraph,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Who is connected to whom, and who the network converges on.\n\n' +
          '**Position means something.** Radius is rank by connection count — the centre is whoever the network converges on, the rim is the long tail. A force simulation of a few hundred nodes settles into a hairball where position carries no meaning and every render lands somewhere different; this layout is deterministic, which is the property that makes today\'s graph comparable against yesterday\'s.\n\n' +
          '**The DS owns the graph; the app owns the meaning.** Nodes carry `id` / `weight` / `group` / `label` and nothing domain-specific. The detail panel is a render prop — a graph component that knows about one product is a graph component the next site cannot use.\n\n' +
          '**Ambient edges vs meaningful edges.** Unselected edges sit at `--viz-edge`, deliberately below 3:1, because a few hundred edges at full contrast is a grey sheet rather than a picture. The selected node\'s edges switch to `--viz-edge-active`. Same split as the slider rail vs knob: the low-contrast element is supplementary, the high-contrast one carries the success criterion.',
      },
    },
  },
  argTypes: {
    nodes: {
      control: 'object',
      description:
        '`{ id, weight, group?, label? }` and nothing domain-specific. `weight` is the only thing that drives layout: it ranks the node, and the rank becomes the radius. Anything an app knows about a node belongs in `renderDetail`, not here.',
      table: { type: { summary: 'readonly GraphNode[]' }, category: 'Data' },
    },
    edges: {
      control: 'object',
      description:
        '`{ from, to }` pairs of node ids. Edges whose endpoints are both below the display cap are not drawn — they are still counted in the header and reported in the `sr-only` table.',
      table: { type: { summary: 'readonly GraphEdge[]' }, category: 'Data' },
    },
    caption: {
      control: 'text',
      description:
        'Suffix for the header line ("10 nodes · 10 connections · comment ties") and the caption of the `sr-only` node table.',
      table: { type: { summary: 'string' }, category: 'Data' },
    },
    limit: {
      control: { type: 'range', min: 2, max: 200, step: 1 },
      description:
        'How many of the heaviest nodes to draw. Beyond roughly 200 the picture stops reading as a picture. This is the INITIAL cap — the in-chart buttons then own it, so changing this control re-mounts rather than re-renders.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '90' }, category: 'Data' },
    },
    limitOptions: {
      control: 'object',
      description:
        'The caps offered to the reader as buttons. Pass `[]` to hide the control entirely when the caller owns the cap.',
      table: { type: { summary: 'readonly number[]' }, defaultValue: { summary: '[40, 90, 200]' }, category: 'Appearance' },
    },
    selected: {
      control: 'text',
      description:
        'Node id to light up, or `null`. Caller-owned, like MetricTable: type `dana` here to see the selection state without clicking.',
      table: { type: { summary: 'string | null' }, defaultValue: { summary: 'null' }, category: 'State' },
    },
    onSelect: {
      action: 'select',
      description:
        'Called with a node id, or `null` when the same node is toggled off / Escape is pressed. Wired to click, Enter and Space — a graph whose only affordance is hitting a 6px circle is unusable by keyboard and hostile on touch.',
      table: { type: { summary: '(id: string | null) => void' }, category: 'Events' },
    },
    renderDetail: {
      control: false,
      description:
        'Render prop for the side panel — the seam where the app supplies meaning. Omit it and no panel renders. A graph component that knows what a node represents is a graph component the next site cannot use.',
      table: { type: { summary: '(node: GraphNode) => ReactNode' }, category: 'Slots' },
    },
    loading: {
      control: 'boolean',
      description:
        'Render a `<Skeleton variant="chart" />`. Checked before the empty branch: a graph whose data has not arrived is not a graph with no connections.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    className: {
      control: 'text',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    nodes: GRAPH_NODES,
    edges: GRAPH_EDGES,
    caption: 'comment ties',
    limit: 90,
    limitOptions: [40, 90, 200],
    selected: null,
    loading: false,
  },
};

export const WithDetail: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The app supplies the panel. The DS never learns what a node represents.',
      },
    },
  },
  render: function WithDetail() {
    const [selected, setSelected] = React.useState<string | null>('dana');
    return (
      <NetworkGraph
        nodes={GRAPH_NODES}
        edges={GRAPH_EDGES}
        caption="comment ties"
        selected={selected}
        onSelect={setSelected}
        renderDetail={(node) => (
          <div className="flex flex-col gap-2">
            <p className="font-medium">{node.label ?? node.id}</p>
            <dl className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
              <dt>ties</dt>
              <dd className="text-right tabular-nums">{node.weight}</dd>
              <dt>relationship</dt>
              <dd className="text-right">{node.group ?? '—'}</dd>
            </dl>
          </div>
        )}
      />
    );
  },
};

export const KeyboardSelection: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Arrow keys walk the ranking, Enter selects, Escape clears. A graph whose only affordance is clicking a 6px circle is unusable by keyboard AND hostile on touch.',
      },
    },
  },
  render: function KeyboardSelection() {
    const [selected, setSelected] = React.useState<string | null>(null);
    return (
      <NetworkGraph
        nodes={GRAPH_NODES}
        edges={GRAPH_EDGES}
        selected={selected}
        onSelect={setSelected}
        renderDetail={(node) => <p>Selected: {node.label ?? node.id}</p>}
      />
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const plot = canvas.getByRole('img');

    await step('the graph takes focus', async () => {
      plot.focus();
      await expect(document.activeElement).toBe(plot);
    });

    await step('ArrowRight then Enter selects the second-ranked node', async () => {
      await userEvent.keyboard('{ArrowRight}{Enter}');
      await waitFor(() => expect(canvas.getByText(/Selected: dana/)).toBeTruthy());
    });

    await step('Escape clears the selection', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(canvas.queryByText(/Selected:/)).toBeNull());
    });
  },
};

export const Capped: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Nodes below the display cap are reported, not silently dropped. A truncated view that does not say it is truncated reads as a complete one.',
      },
    },
  },
  args: { nodes: GRAPH_NODES, edges: GRAPH_EDGES, limit: 4, limitOptions: [4, 8] },
};

export const Empty: Story = {
  args: { nodes: [], edges: [] },
};

export const Loading: Story = {
  args: { nodes: [], edges: [], loading: true },
};

export const Dark: Story = {
  args: { nodes: GRAPH_NODES, edges: GRAPH_EDGES, caption: 'comment ties' },
  globals: { theme: 'dark' },
};

export const Rtl: Story = {
  args: { nodes: GRAPH_NODES, edges: GRAPH_EDGES },
  decorators: [withRtl],
};
