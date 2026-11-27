/**
 * @interlace/ui — room-goal-model
 *
 * A goal the whole room works toward together: every right answer (or any
 * contribution the app counts) fills one shared meter, with named
 * milestones on the way. It changes the feel of a quiz from "who beat me"
 * to "we got there", which suits a workshop.
 *
 * `tallyRoomGoal` adds up contributions, counting each person once per
 * round however many times a message is delivered (the highest one counts,
 * so every screen gets the same total whatever order messages arrive in),
 * optionally capping what one person can add, so the room gets there
 * together. `roomStreak` counts rounds in a row where enough of the room
 * got it right.
 */

export interface RoomContribution {
  /** Who added it. */
  by: string;
  /** The round it belongs to; one contribution per person per round. */
  round: string;
  points: number;
}

export interface RoomMilestone {
  at: number;
  label: string;
}

export interface RoomGoalTally {
  total: number;
  /** People who added anything. */
  people: number;
  /** Milestones passed, in order. */
  reached: RoomMilestone[];
  /** The next milestone, or null when all are passed. */
  next: RoomMilestone | null;
  /** The total reached the target. */
  done: boolean;
}

export function tallyRoomGoal(
  contributions: readonly RoomContribution[],
  options: { target: number; milestones?: readonly RoomMilestone[]; capPerPerson?: number },
): RoomGoalTally {
  const { target, milestones = [], capPerPerson = Number.POSITIVE_INFINITY } = options;
  // Per person and round, the highest points: order-free, so every screen agrees.
  const best = new Map<string, { by: string; points: number }>();
  for (const c of contributions) {
    if (!c || typeof c.by !== 'string' || typeof c.round !== 'string') continue;
    if (!Number.isFinite(c.points) || c.points <= 0) continue;
    const key = `${c.by}\uE000${c.round}`;
    const had = best.get(key);
    if (!had || c.points > had.points) best.set(key, { by: c.by, points: c.points });
  }
  const perPerson = new Map<string, number>();
  for (const { by, points } of best.values()) perPerson.set(by, (perPerson.get(by) ?? 0) + points);
  let total = 0;
  for (const n of perPerson.values()) total += Math.min(n, capPerPerson);
  const sorted = [...milestones].filter((m) => Number.isFinite(m.at)).sort((a, b) => a.at - b.at);
  return {
    total,
    people: perPerson.size,
    reached: sorted.filter((m) => total >= m.at),
    next: sorted.find((m) => total < m.at) ?? null,
    done: target > 0 && total >= target,
  };
}

/** Rounds in a row (ending with the latest) where at least `threshold` of the room was right, and the best run. */
export function roomStreak(
  rounds: readonly { right: number; answered: number }[],
  options: { threshold?: number } = {},
): { current: number; best: number } {
  const { threshold = 0.7 } = options;
  let current = 0;
  let best = 0;
  for (const r of rounds) {
    const ok = r.answered > 0 && r.right / r.answered >= threshold;
    current = ok ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return { current, best };
}
