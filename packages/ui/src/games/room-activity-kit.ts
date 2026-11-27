/**
 * @interlace/ui — games/room-activity-kit
 *
 * The few guards every room activity's decoder uses to read what the room holds as untrusted
 * data. A slice can come from a save, a restored host or a phone's last message, so each field is
 * checked, never assumed.
 */

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** A non-empty string of at most `max` characters. */
export const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
/** A key that is safe on a plain object (`__proto__` would set its prototype). */
export const safeKey = (k: string) => k !== '__proto__';
/** An id a host may choose: short, and made of letters, digits, `-` and `_`. */
export const isId = (v: unknown, max = 24): v is string => isStr(v, max) && /^[A-Za-z0-9_-]+$/.test(v) && safeKey(v);

/** A host's text: trimmed, and null when empty or longer than `max`. */
export function cleanLabel(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t.length > 0 && t.length <= max ? t : null;
}

/** The players' ids now in a room, for dropping what a removed player left behind. */
export const presentIds = (room: { players: readonly { id: string }[] }): Set<string> => new Set(room.players.map((p) => p.id));
