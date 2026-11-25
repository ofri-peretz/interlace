/**
 * @interlace/ui — recap-model
 *
 * A per-person recap that fits in a link. After a session, each person gets
 * an address with what they did in it (the session, when, what they picked,
 * what they asked more about, their points), so the recap page needs no
 * account and no lookup, and nothing about them is stored anywhere else.
 *
 * The token is base64url JSON, versioned, and checked field by field on the
 * way back in: a hand-edited or truncated link decodes to null, never to a
 * half-filled recap. It is NOT signed. Use it for the person's own view of
 * their own session, never for anything a score or a prize depends on.
 */

export interface RecapData {
  /** Which session, as your app names it. */
  session: string;
  /** When it ran, ms since the epoch. */
  at?: number;
  /** The one thing they picked for this week. */
  commitment?: string;
  /** Topic ids they asked for more on. */
  interests?: string[];
  /** Points, when the session kept score. */
  points?: number;
}

const VERSION = 1;
/** Long links break in chat apps and QR codes; past this the encoder refuses. */
export const MAX_RECAP_TOKEN = 1500;

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (token: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

const isText = (x: unknown, max: number): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

/** Checks a decoded object, keeping only fields that pass. Null when `session` is missing. */
export function validRecap(x: unknown): RecapData | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!isText(o.session, 120)) return null;
  const out: RecapData = { session: o.session };
  if (isCount(o.at)) out.at = o.at;
  if (isText(o.commitment, 280)) out.commitment = o.commitment;
  if (Array.isArray(o.interests) && o.interests.length <= 50 && o.interests.every((i) => isText(i, 80))) {
    out.interests = [...new Set(o.interests as string[])];
  }
  if (isCount(o.points)) out.points = o.points;
  return out;
}

/** The token for a recap link, or null when the data is invalid or too long for a link. */
export function encodeRecap(data: RecapData): string | null {
  const clean = validRecap(data);
  if (!clean) return null;
  const token = toBase64Url(new TextEncoder().encode(JSON.stringify({ v: VERSION, ...clean })));
  return token.length <= MAX_RECAP_TOKEN ? token : null;
}

/** The recap a token holds, or null for anything malformed, unknown or tampered into nonsense. */
export function decodeRecap(token: string | null | undefined): RecapData | null {
  if (!token || token.length > MAX_RECAP_TOKEN) return null;
  const bytes = fromBase64Url(token);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || (parsed as { v?: unknown }).v !== VERSION) return null;
  return validRecap(parsed);
}
