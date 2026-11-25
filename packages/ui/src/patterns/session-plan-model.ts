/**
 * @interlace/ui — session-plan-model
 *
 * The rules for building a session out of modules: which ones are in, in
 * what order, how long it runs, and whether one more fits. Pure, so the
 * composer a host clicks through, the booking form that sends the plan and
 * the server that checks it agree on every minute.
 *
 * A plan is an ordered list of module ids. `required` ids (an opening, a
 * close) are always in and cannot be removed; the rest are the host's.
 */

export interface PlanModule {
  id: string;
  /** How long the module runs. */
  minutes: number;
}

export interface PlanOptions {
  /** The most minutes the session may run. Omit for no limit. */
  maxMinutes?: number | null;
  /** Ids that are always in the plan. */
  required?: readonly string[];
}

export interface PlanSummary {
  /** The plan, cleaned: known ids only, no repeats, required ones included. */
  ids: string[];
  minutes: number;
  /** Minutes left under `maxMinutes`; null with no limit. Never below 0. */
  remaining: number | null;
  /** Minutes past `maxMinutes`; 0 when it fits. */
  over: number;
}

const minutesOf = (m: PlanModule | undefined) =>
  m && Number.isFinite(m.minutes) && m.minutes > 0 ? m.minutes : 0;

const limitOf = (max: number | null | undefined) =>
  typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : null;

/** Drops unknown and repeated ids and puts missing required ones where they belong. */
export function cleanPlan(modules: readonly PlanModule[], ids: readonly string[], { required = [] }: PlanOptions = {}): string[] {
  const known = new Set(modules.map((m) => m.id));
  const out: string[] = [];
  for (const id of ids) if (known.has(id) && !out.includes(id)) out.push(id);
  // A missing required module goes back in the place the catalogue gives it.
  const order = new Map(modules.map((m, i) => [m.id, i]));
  for (const id of required) {
    if (!known.has(id) || out.includes(id)) continue;
    const at = out.findIndex((x) => order.get(x)! > order.get(id)!);
    if (at === -1) out.push(id);
    else out.splice(at, 0, id);
  }
  return out;
}

export function summarizePlan(modules: readonly PlanModule[], ids: readonly string[], options: PlanOptions = {}): PlanSummary {
  const clean = cleanPlan(modules, ids, options);
  const byId = new Map(modules.map((m) => [m.id, m]));
  const minutes = clean.reduce((sum, id) => sum + minutesOf(byId.get(id)), 0);
  const max = limitOf(options.maxMinutes);
  return {
    ids: clean,
    minutes,
    remaining: max === null ? null : Math.max(0, max - minutes),
    over: max === null ? 0 : Math.max(0, minutes - max),
  };
}

/** Whether `id` can be added without running past `maxMinutes`. */
export function fitsPlan(modules: readonly PlanModule[], ids: readonly string[], id: string, options: PlanOptions = {}): boolean {
  const { ids: clean, remaining } = summarizePlan(modules, ids, options);
  const m = modules.find((x) => x.id === id);
  if (!m || clean.includes(id)) return false;
  return remaining === null || minutesOf(m) <= remaining;
}

/** Adds `id` at the end, or before the first required module that closes the plan. */
export function addToPlan(modules: readonly PlanModule[], ids: readonly string[], id: string, options: PlanOptions = {}): string[] {
  const clean = cleanPlan(modules, ids, options);
  if (!modules.some((m) => m.id === id) || clean.includes(id)) return clean;
  // After the last module the host chose, so a required close stays last. With only
  // required modules in, the catalogue's order places it (after an opening, before a close).
  const required = new Set(options.required ?? []);
  let at = -1;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (!required.has(clean[i]!)) {
      at = i + 1;
      break;
    }
  }
  if (at === -1) {
    const order = new Map(modules.map((m, i) => [m.id, i]));
    const own = order.get(id)!;
    at = clean.findIndex((x) => order.get(x)! > own);
    if (at === -1) at = clean.length;
  }
  return [...clean.slice(0, at), id, ...clean.slice(at)];
}

export function removeFromPlan(modules: readonly PlanModule[], ids: readonly string[], id: string, options: PlanOptions = {}): string[] {
  if ((options.required ?? []).includes(id)) return cleanPlan(modules, ids, options);
  return cleanPlan(
    modules,
    ids.filter((x) => x !== id),
    options,
  );
}

/** Moves `id` by `delta` places (−1 up, +1 down), clamped to the ends. Required modules stay put. */
export function movePlan(
  modules: readonly PlanModule[],
  ids: readonly string[],
  id: string,
  delta: number,
  options: PlanOptions = {},
): string[] {
  const clean = cleanPlan(modules, ids, options);
  const required = new Set(options.required ?? []);
  const from = clean.indexOf(id);
  if (from === -1 || required.has(id)) return clean;
  let to = from + Math.trunc(delta);
  to = Math.max(0, Math.min(clean.length - 1, to));
  // A free module never jumps over a required one.
  const step = to > from ? 1 : -1;
  for (let i = from + step; step > 0 ? i <= to : i >= to; i += step) {
    if (required.has(clean[i]!)) {
      to = i - step;
      break;
    }
  }
  if (to === from) return clean;
  const out = clean.filter((x) => x !== id);
  out.splice(to, 0, id);
  return out;
}

/** Whether `id` can move by `delta` at all. */
export function canMove(modules: readonly PlanModule[], ids: readonly string[], id: string, delta: number, options: PlanOptions = {}): boolean {
  const before = cleanPlan(modules, ids, options);
  const after = movePlan(modules, before, id, delta, options);
  return after.indexOf(id) !== before.indexOf(id);
}
