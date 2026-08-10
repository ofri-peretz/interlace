'use client';

/**
 * @interlace/ui — NetworkGraph
 *
 * Who is connected to whom, and who the network converges on.
 *
 * ## Position means something
 *
 * Radius is rank by connection count: the centre is whoever the network
 * converges on, the rim is the long tail. The same input always produces the
 * same picture, which is the property that makes today's graph comparable
 * against yesterday's — and the property a force simulation destroys. See
 * `graph.ts` for why concentric-by-rank beats a hairball.
 *
 * ## The DS owns the graph; the app owns the meaning
 *
 * Nodes carry `id`, `weight`, an optional `group` and `label` — nothing
 * domain-specific. The detail panel is a render prop, so an app can show
 * whatever a selected node means to it without this component ever learning
 * about authors, packages, services or repos. A graph component that knows
 * about dev.to is a graph component the next site cannot use.
 *
 * ## Ambient edges, meaningful edges
 *
 * Unselected edges are drawn at `--viz-edge` — deliberately below 3:1, because
 * a few hundred edges at full contrast is a grey sheet, not a picture. They are
 * texture. The edges that carry information — the selected node's — switch to
 * `--viz-edge-active` at full opacity. Same split as the slider rail vs knob:
 * the low-contrast element is supplementary, the high-contrast one carries the
 * success criterion.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The plot scales via `viewBox`; the detail panel stacks below it under `md`.
 *
 * | Rule | Concept                    | Where in this file                                      |
 * | ---- | -------------------------- | ------------------------------------------------------- |
 * | R6   | data-slot on every part    | `data-slot="network-graph" / "-plot" / "-detail"`        |
 * | R7   | className merged + ...rest | `cn(...)` + `{...props}`                                 |
 * | R8   | No `isXxx`                 | `selected`, `limit`                                      |
 * | R11  | One variable per part      | plot owns layout; detail owns the app's meaning          |
 * | R13  | Ecosystem first            | no graph library — layout is 20 lines of trigonometry    |
 * | R14  | Declares min viewport      | `data-min-viewport={String(MIN_VIEWPORT)}`               |
 * | R18  | Tailwind only              | zero inline `style`                                      |
 * | R19  | Tokens only                | `fill-viz-node`, `stroke-viz-edge`, `--viz-*` family     |
 * | R20  | AA contrast                | active edge/node ≥9:1; ambient edge documented decorative|
 * | R25  | Client component           | selection state + key handlers                           |
 * | R26  | A11y                       | `role="img"` + label + roving focus + node table         |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Skeleton } from '../primitives/skeleton.js';
import {
  concentricLayout,
  describeGraph,
  edgesWithin,
  neighborsOf,
  topNodes,
  type GraphEdge,
  type GraphNode,
} from './graph.js';

export const MIN_VIEWPORT = 320 as const;

/** Drawing box in user units; the viewBox scales it to any container. */
const W = 900;
const H = 560;

export interface NetworkGraphProps extends Omit<React.ComponentProps<'div'>, 'onSelect'> {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  /** Caption / accessible summary prefix. */
  caption?: string;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** How many of the heaviest nodes to draw. Beyond ~200 the picture stops reading. */
  limit?: number;
  /** Offer the reader other display caps. Pass `[]` to hide the control. */
  limitOptions?: readonly number[];
  /** App-owned detail for the selected node. Omit to render no side panel. */
  renderDetail?: (node: GraphNode) => React.ReactNode;
  /** Render a `<Skeleton variant="chart" />` placeholder. */
  loading?: boolean;
}

export const NetworkGraph = React.forwardRef<HTMLDivElement, NetworkGraphProps>(
  function NetworkGraph(
    {
      nodes,
      edges,
      caption,
      selected = null,
      onSelect,
      limit: limitProp = 90,
      limitOptions = [40, 90, 200],
      renderDetail,
      loading = false,
      className,
      ...props
    },
    ref,
  ) {
    const [limit, setLimit] = React.useState(limitProp);
    const [cursor, setCursor] = React.useState(0);

    const shown = React.useMemo(() => topNodes(nodes, limit), [nodes, limit]);
    const visible = React.useMemo(() => new Set(shown.map((n) => n.id)), [shown]);
    const positions = React.useMemo(() => concentricLayout(shown, W, H), [shown]);
    const drawn = React.useMemo(() => edgesWithin(edges, visible), [edges, visible]);
    const related = React.useMemo(
      () => (selected ? neighborsOf(drawn, selected) : new Set<string>()),
      [drawn, selected],
    );

    const hidden = nodes.length - shown.length;

    const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
      const lastIndex = shown.length - 1;
      let next = cursor;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = Math.min(lastIndex, cursor + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = Math.max(0, cursor - 1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = lastIndex;
          break;
        case 'Enter':
        case ' ':
          // Toggle, so a keyboard user can deselect without a mouse.
          onSelect?.(shown[cursor]?.id === selected ? null : (shown[cursor]?.id ?? null));
          event.preventDefault();
          return;
        case 'Escape':
          onSelect?.(null);
          return;
        default:
          return;
      }
      setCursor(next);
      event.preventDefault();
    };

    // Before the empty branch: a graph whose data has not arrived is not a graph
    // with no connections, and saying the second while the first is true is a lie
    // the reader has no way to detect.
    if (loading) {
      return (
        <Skeleton
          variant="chart"
          data-slot="network-graph"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={className}
        />
      );
    }

    if (shown.length === 0) {
      return (
        <div
          ref={ref}
          data-slot="network-graph-empty"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={cn('w-full rounded-lg border border-border p-6', className)}
          {...props}
        >
          <p className="text-sm text-muted-foreground">
            No connections observed yet. A network needs at least one node to plot.
          </p>
        </div>
      );
    }

    const focused = shown[Math.min(cursor, shown.length - 1)];
    const detail = selected ? shown.find((n) => n.id === selected) : undefined;

    return (
      <div
        ref={ref}
        data-slot="network-graph"
        data-min-viewport={String(MIN_VIEWPORT)}
        // See the note in time-series.tsx: the plot is viewBox-sized, so a
        // container that collapses paints nothing.
        className={cn('w-full overflow-hidden rounded-lg border border-border bg-card', className)}
        {...props}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {nodes.length} nodes · {edges.length} connections
            {caption ? ` · ${caption}` : ''}
          </span>
          {limitOptions.length > 0 && (
            <span className="flex items-center gap-1.5">
              {limitOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={limit === option}
                  onClick={() => setLimit(option)}
                  className={cn(
                    'rounded border px-2 py-0.5',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    limit === option
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  top {option}
                </button>
              ))}
            </span>
          )}
        </div>

        <div className={cn('grid grid-cols-1', renderDetail && 'md:grid-cols-[minmax(0,1fr)_260px]')}>
          <svg
            data-slot="network-graph-plot"
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            role="img"
            aria-label={`${describeGraph(nodes, drawn, shown.length)} Focus this graph and use the arrow keys to move between nodes, Enter to select.`}
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            {drawn.map((edge) => {
              const a = positions.get(edge.from)!;
              const b = positions.get(edge.to)!;
              const lit = selected !== null && (edge.from === selected || edge.to === selected);
              return (
                <line
                  key={`${edge.from}~${edge.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={lit ? 1.4 : 0.5}
                  className={cn(
                    lit ? 'stroke-viz-edge-active opacity-90' : 'stroke-viz-edge',
                    !lit && selected !== null && 'opacity-20',
                  )}
                  aria-hidden
                />
              );
            })}

            {shown.map((node) => {
              const position = positions.get(node.id)!;
              const dimmed = selected !== null && node.id !== selected && !related.has(node.id);
              const isFocused = node.id === focused.id;
              return (
                <g key={node.id}>
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={position.r}
                    strokeWidth={1.2}
                    className={cn(
                      'stroke-card',
                      node.id === selected ? 'fill-viz-node-active' : 'fill-viz-node',
                      dimmed && 'opacity-20',
                      onSelect && 'cursor-pointer',
                    )}
                    onClick={onSelect ? () => onSelect(node.id === selected ? null : node.id) : undefined}
                  >
                    <title>{`${node.label ?? node.id} — ${node.weight} connections`}</title>
                  </circle>
                  {/* The keyboard cursor is a ring, not a fill change: it has to
                      be visible on a node that is already selected. */}
                  {isFocused && (
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r={position.r + 4}
                      fill="none"
                      strokeWidth={1.5}
                      className="stroke-ring"
                      aria-hidden
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {renderDetail && (
            <aside
              data-slot="network-graph-detail"
              className="border-t border-border p-4 text-sm md:border-l md:border-t-0"
            >
              {detail ? (
                renderDetail(detail)
              ) : (
                <p className="text-muted-foreground">
                  Select a node. Distance from the centre is rank by number of connections —
                  the centre is who this network converges on.
                </p>
              )}
            </aside>
          )}
        </div>

        {/* The lossless equivalent. Same contract as SeriesTable: a picture is
            where numbers stop being readable by anything that is not an eye. */}
        <div className="sr-only">
          <table>
            <caption>{caption ?? 'Network nodes by connection count'}</caption>
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Connections</th>
                <th scope="col">Group</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((node) => (
                <tr key={node.id}>
                  <th scope="row">{node.label ?? node.id}</th>
                  <td>{node.weight}</td>
                  <td>{node.group ?? 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hidden > 0 && (
            <p>
              {hidden} lower-ranked nodes are below the display cap of {limit}. They are not
              filtered out.
            </p>
          )}
        </div>
      </div>
    );
  },
);
