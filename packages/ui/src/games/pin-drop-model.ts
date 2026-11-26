/**
 * @interlace/ui — pin-drop-model
 *
 * A pin on a picture: a map, a floor plan, a diagram, a photo. Two games
 * use it. "Where is it?" has an answer, and a pin scores by how close it
 * lands. "Where are you?" (or "where would you go?") has none, and the
 * room's pins are the result.
 *
 * Places are percents of the picture from its top-left corner, `x` across
 * and `y` down, so they mean the same spot on every screen whatever its
 * size. A picture does not mirror for right-to-left readers, so neither do
 * pins. Distances are measured in percents of the picture's width, with
 * `aspect` (width / height) correcting for a picture that is not square.
 */

export interface PinPoint {
  /** Percent across, 0 at the left edge. */
  x: number;
  /** Percent down, 0 at the top edge. */
  y: number;
}

/** A named part of the picture, so a pin can be said in words. */
export interface PinRegion {
  /** A place name that reads after "in", e.g. "the harbour". */
  label: string;
  /** Left, top, right, bottom, in percents. */
  box: readonly [number, number, number, number];
}

export interface PinScoring {
  /** Points for a pin on the spot. @default 1000 */
  max?: number;
  /** Within this distance a pin counts as on the spot. @default 3 */
  exact?: number;
  /** At or past this distance a pin scores nothing. @default 40 */
  radius?: number;
}

export interface PinSpread {
  count: number;
  /** The middle pin, by median of each axis. Null with no pins. */
  middle: PinPoint | null;
  /** With an answer: the median distance from it, and how many landed within `exact`. */
  medianDistance: number | null;
  onSpot: number;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

function finite(p: unknown): p is PinPoint {
  const q = p as PinPoint | null;
  return !!q && Number.isFinite(q.x) && Number.isFinite(q.y);
}

/** Pins that make sense, held to the picture. */
export function cleanPins(pins: readonly PinPoint[]): PinPoint[] {
  return pins.filter(finite).map((p) => ({ x: clamp(p.x), y: clamp(p.y) }));
}

/** How far apart two pins are, in percents of the picture's width. */
export function pinDistance(a: PinPoint, b: PinPoint, aspect = 1): number {
  const k = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  return Math.hypot(a.x - b.x, (a.y - b.y) / k);
}

/** Points for a pin this far from the answer: all of them on the spot, none past `radius`, a straight line between. */
export function pinPoints(distance: number, scoring: PinScoring = {}): number {
  const { max = 1000, exact = 3, radius = 40 } = scoring;
  if (!Number.isFinite(distance) || !(max > 0)) return 0;
  if (distance <= exact) return Math.round(max);
  if (distance >= radius || radius <= exact) return 0;
  return Math.round(max * (1 - (distance - exact) / (radius - exact)));
}

/** The first region holding the pin, or null. */
export function regionOf(p: PinPoint, regions: readonly PinRegion[] = []): PinRegion | null {
  return regions.find(({ box: [l, t, r, b] }) => p.x >= l && p.x <= r && p.y >= t && p.y <= b) ?? null;
}

/** A pin moved by a key: arrows by `step`, Home and End to the side edges, Page Up and Down to the top and bottom. */
export function nudgePin(p: PinPoint, key: string, step = 5): PinPoint | null {
  switch (key) {
    case 'ArrowRight':
      return { x: clamp(p.x + step), y: p.y };
    case 'ArrowLeft':
      return { x: clamp(p.x - step), y: p.y };
    case 'ArrowUp':
      return { x: p.x, y: clamp(p.y - step) };
    case 'ArrowDown':
      return { x: p.x, y: clamp(p.y + step) };
    case 'Home':
      return { x: 0, y: p.y };
    case 'End':
      return { x: 100, y: p.y };
    case 'PageUp':
      return { x: p.x, y: 0 };
    case 'PageDown':
      return { x: p.x, y: 100 };
    default:
      return null;
  }
}

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Where the room put its pins, and, with an answer, how close it came. */
export function pinSpread(
  pins: readonly PinPoint[],
  options: { answer?: PinPoint | null; aspect?: number; exact?: number } = {},
): PinSpread {
  const { answer = null, aspect = 1, exact = 3 } = options;
  const clean = cleanPins(pins);
  if (clean.length === 0) return { count: 0, middle: null, medianDistance: null, onSpot: 0 };
  const xs = clean.map((p) => p.x).sort((a, b) => a - b);
  const ys = clean.map((p) => p.y).sort((a, b) => a - b);
  const target = finite(answer) ? answer : null;
  const ds = target ? clean.map((p) => pinDistance(p, target, aspect)).sort((a, b) => a - b) : [];
  return {
    count: clean.length,
    middle: { x: median(xs), y: median(ys) },
    medianDistance: target ? median(ds) : null,
    onSpot: ds.filter((d) => d <= exact).length,
  };
}
