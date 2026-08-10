import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { NetworkGraph } from '@interlace/ui/charts/network-graph';
import { withDark, withRtl } from '@/decorators';

import { GRAPH_EDGES, GRAPH_NODES } from './fixtures';

const meta: Meta<typeof NetworkGraph> = {
  title: 'Charts/NetworkGraph',
  component: NetworkGraph,
  tags: ['autodocs'],
  parameters: {
    // Opt out of the global `layout: 'centered'`. A centered story sits in a
    // fit-content parent, and a chart sized from its container via `viewBox` +
    // `w-full` resolves to ZERO width there — it renders, paints nothing, and
    // looks like a broken component. Charts are full-width surfaces.
    layout: 'padded',
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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { nodes: GRAPH_NODES, edges: GRAPH_EDGES, caption: 'comment ties' },
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
  decorators: [withDark],
};

export const Rtl: Story = {
  args: { nodes: GRAPH_NODES, edges: GRAPH_EDGES },
  decorators: [withRtl],
};
