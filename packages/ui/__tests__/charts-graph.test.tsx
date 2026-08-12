/**
 * charts/graph + NetworkGraph.
 *
 * The layout is deterministic by design — that is the whole reason it is not a
 * force simulation — so it can be asserted exactly rather than approximately.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GOLDEN_ANGLE,
  concentricLayout,
  describeGraph,
  edgesWithin,
  neighborsOf,
  rankNodes,
  topNodes,
  type GraphEdge,
  type GraphNode,
} from '../src/charts/graph.js';
import { NetworkGraph } from '../src/charts/network-graph.js';

afterEach(cleanup);

const nodes: GraphNode[] = [
  { id: 'a', weight: 10, group: 'core', label: 'Ada' },
  { id: 'b', weight: 6, group: 'core' },
  { id: 'c', weight: 3 },
  { id: 'd', weight: 1 },
];
const edges: GraphEdge[] = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c' },
  { from: 'c', to: 'd' },
];

/* ── graph.ts ───────────────────────────────────────────────────────────── */

describe('rankNodes / topNodes', () => {
  it('orders heaviest first without mutating the caller array', () => {
    const input = [...nodes];
    expect(rankNodes(input).map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(input.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the heaviest when capped', () => {
    expect(topNodes(nodes, 2).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('treats a negative cap as zero rather than slicing from the end', () => {
    // `slice(-3)` would silently return the THREE LIGHTEST nodes — the exact
    // opposite of what a cap means.
    expect(topNodes(nodes, -3)).toEqual([]);
  });
});

describe('concentricLayout', () => {
  it('places the heaviest node on the inner ring and the lightest on the outer', () => {
    const positions = concentricLayout(nodes, 900, 560);
    const centre = { x: 450, y: 280 };
    const radius = (id: string) => {
      const p = positions.get(id)!;
      return Math.hypot(p.x - centre.x, p.y - centre.y);
    };
    expect(radius('a')).toBeLessThan(radius('b'));
    expect(radius('b')).toBeLessThan(radius('c'));
    expect(radius('c')).toBeLessThan(radius('d'));
  });

  it('is deterministic — the same input always draws the same picture', () => {
    // The property a force simulation destroys, and the reason today's graph
    // can be compared against yesterday's.
    expect(concentricLayout(nodes, 900, 560)).toEqual(concentricLayout([...nodes].reverse(), 900, 560));
  });

  it('separates successive ranks by the golden angle so no phantom spokes appear', () => {
    const positions = concentricLayout(nodes, 900, 560);
    const angle = (id: string) => Math.atan2(positions.get(id)!.y - 280, positions.get(id)!.x - 450);
    const step = angle('b') - angle('a');
    // Compare modulo a full turn.
    expect(Math.abs(((step - GOLDEN_ANGLE) % (2 * Math.PI)))).toBeLessThan(1e-6);
  });

  it('puts a lone node on the inner ring instead of dividing by zero', () => {
    const positions = concentricLayout([{ id: 'solo', weight: 5 }], 900, 560);
    expect(Math.hypot(positions.get('solo')!.x - 450, positions.get('solo')!.y - 280)).toBeCloseTo(40);
  });

  it('still paints dots when every weight is zero', () => {
    // A brand-new network has no connections yet; it must not vanish.
    const positions = concentricLayout(
      [
        { id: 'x', weight: 0 },
        { id: 'y', weight: 0 },
      ],
      900,
      560,
    );
    expect(positions.get('x')!.r).toBe(3);
  });

  it('scales node size by weight relative to the heaviest shown', () => {
    const positions = concentricLayout(nodes, 900, 560);
    expect(positions.get('a')!.r).toBe(12);
    expect(positions.get('d')!.r).toBeLessThan(positions.get('a')!.r);
  });

  it('returns nothing for an empty network', () => {
    expect(concentricLayout([], 900, 560).size).toBe(0);
  });
});

describe('edgesWithin', () => {
  it('drops an edge with only one visible end — a half-drawn edge points at nothing', () => {
    expect(edgesWithin(edges, new Set(['a', 'b']))).toEqual([{ from: 'a', to: 'b' }]);
  });
});

describe('neighborsOf', () => {
  it('finds neighbours in both directions', () => {
    expect([...neighborsOf(edges, 'b')].sort()).toEqual(['a', 'c']);
  });

  it('does not report a node as its own neighbour through a self-loop', () => {
    // Otherwise the selected node renders dimmed against itself.
    expect([...neighborsOf([{ from: 'a', to: 'a' }], 'a')]).toEqual([]);
  });

  it('returns empty for an isolated node', () => {
    expect([...neighborsOf(edges, 'zzz')]).toEqual([]);
  });
});

describe('describeGraph — the sentence that replaces the picture', () => {
  it('says so when the network is empty', () => {
    expect(describeGraph([], [], 0)).toBe('Network graph: no nodes');
  });

  it('names the counts, the most connected node, and what radius means', () => {
    const text = describeGraph(nodes, edges, 4);
    expect(text).toContain('4 nodes, 3 connections');
    expect(text).toContain('Most connected is Ada with 10');
    expect(text).toContain('rank by number of connections');
  });

  it('reports how many are below the cap, rather than pretending they do not exist', () => {
    expect(describeGraph(nodes, edges, 2)).toContain('2 below the display cap');
  });

  it('falls back to the id when a node has no label', () => {
    expect(describeGraph([{ id: 'raw', weight: 1 }], [], 1)).toContain('Most connected is raw');
  });
});

/* ── NetworkGraph ───────────────────────────────────────────────────────── */

describe('NetworkGraph', () => {
  it('says the network is empty rather than rendering a blank box', () => {
    render(<NetworkGraph nodes={[]} edges={[]} />);
    expect(screen.getByText(/No connections observed yet/)).toBeTruthy();
  });

  it('keeps the caller className on the empty state', () => {
    const { container } = render(<NetworkGraph nodes={[]} edges={[]} className="mt-2" />);
    expect(container.querySelector('[data-slot="network-graph-empty"]')?.className).toContain('mt-2');
  });

  it('tells the reader the keyboard works, in the accessible name', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('arrow keys');
  });

  it('ships every node as a table, so the picture is lossless', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} caption="Comment ties" />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Ada' })).toBeTruthy();
    // An unlabelled node still appears, under its id.
    expect(within(table).getByRole('rowheader', { name: 'c' })).toBeTruthy();
    expect(within(table).getAllByText('None').length).toBeGreaterThan(0);
  });

  it('says how many nodes are below the cap instead of silently truncating', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} limit={2} />);
    expect(screen.getByText(/2 lower-ranked nodes are below the display cap of 2/)).toBeTruthy();
  });

  it('appends the caption to the header summary', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} caption="Comment ties" />);
    expect(screen.getByText(/4 nodes · 3 connections · Comment ties/)).toBeTruthy();
  });

  it('renders no cap control when the caller passes no options', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} limitOptions={[]} />);
    expect(screen.queryByRole('button', { name: /top/ })).toBeNull();
  });

  it('marks the active cap with aria-pressed, not only with a fill', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} limit={40} />);
    expect(screen.getByRole('button', { name: 'top 40' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('changes the cap when a control is pressed', async () => {
    const user = userEvent.setup();
    render(<NetworkGraph nodes={nodes} edges={edges} limit={90} />);
    await user.click(screen.getByRole('button', { name: 'top 40' }));
    expect(screen.getByRole('button', { name: 'top 40' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('selects a node on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(<NetworkGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    await user.click(container.querySelectorAll('circle')[0]);
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('deselects when the selected node is clicked again', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(
      <NetworkGraph nodes={nodes} edges={edges} selected="a" onSelect={onSelect} />,
    );
    await user.click(container.querySelectorAll('circle')[0]);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders no click affordance when selection is not offered', () => {
    const { container } = render(<NetworkGraph nodes={nodes} edges={edges} />);
    expect(container.querySelector('circle')?.getAttribute('class')).not.toContain('cursor-pointer');
  });

  it('lights the selected node\'s edges and dims the rest', () => {
    const { container } = render(<NetworkGraph nodes={nodes} edges={edges} selected="a" />);
    const lines = [...container.querySelectorAll('line')];
    expect(lines[0].getAttribute('class')).toContain('stroke-viz-edge-active');
    expect(lines[2].getAttribute('class')).toContain('opacity-20');
  });

  it('moves the keyboard cursor with arrows and selects with Enter — the path a click handler alone misses', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('accepts vertical arrows as well, so the graph does not demand a mental model of left/right', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('treats ArrowLeft as a step back, matching ArrowUp', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('clamps at the ends rather than wrapping around the ranking', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('jumps to either end of the ranking with Home and End', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard('{End}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('d');
    await user.keyboard('{Home}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('a');
  });

  it('toggles off with Enter on the already-selected node', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} selected="a" onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('selects with Space as well as Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('clears the selection on Escape', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} selected="a" onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard('{Escape}');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('leaves unrelated keys to the page', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    screen.getByRole('img').focus();
    await user.keyboard('q');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('survives the cursor pointing past the end after the cap shrinks', async () => {
    // Move to the last node at cap 90, then drop to cap 40 with fewer nodes
    // shown: the cursor now indexes past the array.
    const many: GraphNode[] = Array.from({ length: 50 }, (_, i) => ({ id: `n${i}`, weight: 50 - i }));
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NetworkGraph nodes={many} edges={[]} onSelect={onSelect} limitOptions={[40, 90]} limit={90} />);
    screen.getByRole('img').focus();
    await user.keyboard('{End}');
    await user.click(screen.getByRole('button', { name: 'top 40' }));
    screen.getByRole('img').focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders no side panel unless the app supplies one', () => {
    const { container } = render(<NetworkGraph nodes={nodes} edges={edges} />);
    expect(container.querySelector('[data-slot="network-graph-detail"]')).toBeNull();
  });

  it('prompts for a selection before one is made', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} renderDetail={(n) => <b>{n.id}</b>} />);
    expect(screen.getByText(/Select a node/)).toBeTruthy();
  });

  it('hands the selected node to the app rather than knowing what it means', () => {
    render(
      <NetworkGraph
        nodes={nodes}
        edges={edges}
        selected="a"
        renderDetail={(node) => <b>detail for {node.label}</b>}
      />,
    );
    expect(screen.getByText('detail for Ada')).toBeTruthy();
  });

  it('shows a placeholder while loading rather than claiming the network is empty', () => {
    const { container } = render(<NetworkGraph nodes={[]} edges={[]} loading />);
    expect(container.querySelector('[data-slot="network-graph"]')).not.toBeNull();
    expect(screen.queryByText(/No connections observed yet/)).toBeNull();
  });

  it('forwards a ref and merges className', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<NetworkGraph ref={ref} className="mt-8" nodes={nodes} edges={edges} />);
    expect(ref.current?.className).toContain('mt-8');
  });
});

describe('NetworkGraph — a failed fetch is not an empty network', () => {
  it('says the network is unknown rather than accusing the reader of having none', () => {
    // "No connections observed yet" is a statement about the reader's network.
    // A failed request says nothing about it at all.
    render(<NetworkGraph nodes={[]} edges={[]} error={new Error('ECONNRESET')} />);
    expect(screen.getByRole('alert').textContent).toMatch(/unknown, not empty/i);
    expect(screen.queryByText(/No connections observed yet/)).toBeNull();
  });

  it('folds the caller noun into the sentence', () => {
    render(<NetworkGraph nodes={[]} edges={[]} error="x" announce={{ noun: 'connections' }} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Connections could not be loaded/);
  });

  it('keeps loading above error — nothing is known yet', () => {
    const { container } = render(<NetworkGraph nodes={[]} edges={[]} loading error="x" />);
    expect(container.querySelector('[data-slot="network-graph"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('merges className and forwards a ref on the error state', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<NetworkGraph nodes={[]} edges={[]} error="x" className="mt-4" ref={ref} />);
    expect(ref.current?.className).toContain('mt-4');
    expect(ref.current?.getAttribute('data-slot')).toBe('network-graph-error');
  });
});
