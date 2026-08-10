/**
 * @interlace/ui — graph layout and traversal
 *
 * The pure half of `NetworkGraph`. Same split as `scale.ts`: the arithmetic is
 * provable and carries the coverage gate, the SVG above it is checked by
 * stories and axe.
 *
 * ## Why concentric-by-rank and not a force simulation
 *
 * A force layout of a few hundred nodes settles into a hairball where position
 * carries no meaning and every render lands somewhere different. That is fatal
 * for the actual job: comparing today's picture against yesterday's.
 *
 * Here **radius IS the metric**. The centre is whoever the network converges
 * on, and the same input always produces the same picture. A reader can point
 * at a node and say "it moved inward", which no force layout permits.
 */

export interface GraphNode {
  id: string;
  /** Ranking metric — ties, links, references. Drives radius and node size. */
  weight: number;
  /** Optional grouping, drives the legend and the node tone. */
  group?: string;
  /** Display name. Falls back to `id`. */
  label?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight?: number;
}

export interface NodePosition {
  x: number;
  y: number;
  /** Painted radius, scaled by weight relative to the heaviest node shown. */
  r: number;
}

/**
 * The golden angle, in radians.
 *
 * Successive ranks placed at a rational fraction of a turn line up into
 * visible spokes — a phantom structure the data does not have. The golden
 * angle is the one rotation that never repeats, which is why sunflowers use
 * it and why this is not an arbitrary magic number.
 */
export const GOLDEN_ANGLE = 2.399963;

/** Heaviest first. Stable for equal weights, so the picture never flickers. */
export const rankNodes = <T extends GraphNode>(nodes: readonly T[]): T[] =>
  [...nodes].sort((a, b) => b.weight - a.weight);

/** The `limit` heaviest nodes. */
export const topNodes = <T extends GraphNode>(nodes: readonly T[], limit: number): T[] =>
  rankNodes(nodes).slice(0, Math.max(0, limit));

/**
 * Place ranked nodes on concentric rings.
 *
 * Radius follows **rank**, not raw weight. Weight distributions in real
 * networks are long-tailed, so a raw scale piles the low-weight majority onto
 * one outer ring and wastes the whole canvas. Rank spreads them evenly, which
 * is the readable choice even though it discards absolute magnitude — magnitude
 * is carried by node size instead.
 */
export function concentricLayout(
  nodes: readonly GraphNode[],
  width: number,
  height: number,
  { innerRadius = 40, margin = 60, minDot = 3, maxDot = 12 } = {},
): Map<string, NodePosition> {
  const ranked = rankNodes(nodes);
  // Clamped once, here, rather than guarded again at the division below: an
  // empty network, an all-zero network and a garbage negative weight all have
  // to land somewhere sane, and one clamp is easier to reason about than two
  // conditionals that have to agree.
  const heaviest = Math.max(1, ranked[0]?.weight ?? 0);
  const cx = width / 2;
  const cy = height / 2;
  const span = Math.min(width, height) / 2 - margin - innerRadius;
  const last = ranked.length - 1;

  return new Map(
    ranked.map((node, index) => {
      const t = last > 0 ? index / last : 0;
      const radius = innerRadius + t * span;
      const angle = index * GOLDEN_ANGLE;
      return [
        node.id,
        {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          r: minDot + (Math.max(0, node.weight) / heaviest) * (maxDot - minDot),
        },
      ] as const;
    }),
  );
}

/** Edges whose BOTH ends are visible. A half-drawn edge points at nothing. */
export const edgesWithin = (
  edges: readonly GraphEdge[],
  visible: ReadonlySet<string>,
): GraphEdge[] => edges.filter((e) => visible.has(e.from) && visible.has(e.to));

/** Every node one hop from `id`, in the given edge set. */
export function neighborsOf(edges: readonly GraphEdge[], id: string): Set<string> {
  const found = new Set<string>();
  for (const edge of edges) {
    if (edge.from === id) found.add(edge.to);
    if (edge.to === id) found.add(edge.from);
  }
  // A self-loop would otherwise report the node as its own neighbour and
  // make the selected node render dimmed against itself.
  found.delete(id);
  return found;
}

/**
 * The accessible name for a graph.
 *
 * Same contract as `describeSeries`: a screen reader handed `role="img"` with
 * no label announces "image". This is the sentence that replaces the picture,
 * and the `<SeriesTable>`-equivalent node listing is what makes it lossless.
 */
export function describeGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  shown: number,
): string {
  if (nodes.length === 0) return 'Network graph: no nodes';
  const ranked = rankNodes(nodes);
  const hidden = nodes.length - shown;
  return (
    `Network graph: ${nodes.length} nodes, ${edges.length} connections. ` +
    `Showing the ${shown} most connected${hidden > 0 ? `, ${hidden} below the display cap` : ''}. ` +
    `Most connected is ${ranked[0].label ?? ranked[0].id} with ${ranked[0].weight}. ` +
    `Distance from the centre is rank by number of connections.`
  );
}
