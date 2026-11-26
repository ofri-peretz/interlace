/**
 * @interlace/ui — games/duel-model
 *
 * Two players, one game, no accounts and no server round: the first player
 * plays, sends a link, and the second plays the same game (same seed, same
 * questions) and sees both results side by side. The challenge travels in
 * the link itself as a short base64url token.
 *
 *   encodeDuel(challenge) → "eyJ2IjoxLC…"   (put it in ?duel=…)
 *   decodeDuel(token)     → the challenge, or null for anything malformed
 *   compareDuel(a, b)     → per-round winners, totals, the winner and margin
 *
 * ## Trust
 *
 * A link is a friendly claim, not a proof: anyone can edit the score in it.
 * That is fine between friends. Where it matters (a prize, a public board),
 * store the challenge on a server and put its id in the link, or pass a
 * server signature in `sig`; this model carries it and never checks it.
 *
 * `decodeDuel` treats the token as untrusted input: it caps every length,
 * drops what it does not know, and returns null rather than throwing.
 */

export interface DuelPlayer {
  /** Display name, as the player typed it. */
  name: string;
  /** Points per round, in order. */
  rounds: number[];
}

export interface DuelChallenge {
  /** Format version. */
  v: 1;
  /** Which game, e.g. "closer". */
  game: string;
  /** What makes the second game the same as the first: a seed, a day key, a puzzle id. */
  seed: string;
  /** The player who sends the challenge. */
  from: DuelPlayer;
  /** When it was played, in ms. */
  at?: number;
  /** An optional server signature, carried and never checked here. */
  sig?: string;
}

export const DUEL_LIMITS = {
  game: 40,
  seed: 80,
  name: 24,
  rounds: 50,
  sig: 200,
  token: 4096,
} as const;

// --- base64url over UTF-8, without Buffer, so it runs in any runtime ---------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = [B64[(n >>> 18) & 63], B64[(n >>> 12) & 63], B64[(n >>> 6) & 63], B64[n & 63]];
    out += chars.slice(0, Math.min(4, bytes.length - i + 1)).join('');
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk[j]!) : 0);
    bytes.push((n >>> 16) & 255);
    if (chunk.length > 2) bytes.push((n >>> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return new Uint8Array(bytes);
}

// --- Encode / decode ------------------------------------------------------------

const clip = (s: string, max: number) => Array.from(s.trim()).slice(0, max).join('');

/** A challenge, cleaned to the limits: what `encodeDuel` writes and `decodeDuel` returns. */
function clean(input: unknown): DuelChallenge | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const from = o.from as Record<string, unknown> | undefined;
  if (o.v !== 1 || typeof o.game !== 'string' || typeof o.seed !== 'string') return null;
  if (!from || typeof from !== 'object' || typeof from.name !== 'string' || !Array.isArray(from.rounds)) return null;
  if (from.rounds.length > DUEL_LIMITS.rounds) return null;
  if (!from.rounds.every((r) => typeof r === 'number' && Number.isFinite(r))) return null;
  const game = clip(o.game, DUEL_LIMITS.game);
  const name = clip(from.name, DUEL_LIMITS.name);
  if (!game || !name) return null;
  const out: DuelChallenge = {
    v: 1,
    game,
    seed: clip(o.seed, DUEL_LIMITS.seed),
    from: { name, rounds: (from.rounds as number[]).slice() },
  };
  if (typeof o.at === 'number' && Number.isFinite(o.at)) out.at = o.at;
  if (typeof o.sig === 'string' && o.sig) out.sig = clip(o.sig, DUEL_LIMITS.sig);
  return out;
}

/** The challenge as a URL-safe token. Throws a TypeError for an invalid challenge. */
export function encodeDuel(challenge: DuelChallenge): string {
  const c = clean(challenge);
  if (!c) throw new TypeError('Not a valid duel challenge.');
  return toBase64Url(new TextEncoder().encode(JSON.stringify(c)));
}

/** The challenge in a token, or null when the token is missing, too long or malformed. */
export function decodeDuel(token: string | null | undefined): DuelChallenge | null {
  if (!token || token.length > DUEL_LIMITS.token) return null;
  const bytes = fromBase64Url(token);
  if (!bytes) return null;
  try {
    return clean(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch {
    return null;
  }
}

/** `base` with the token in its query (`?duel=…` by default), keeping what is there. */
export function duelHref(base: string, token: string, param = 'duel'): string {
  const [path, hash = ''] = base.split('#');
  const sep = path!.includes('?') ? '&' : '?';
  return `${path}${sep}${encodeURIComponent(param)}=${encodeURIComponent(token)}${hash ? `#${hash}` : ''}`;
}

// --- Compare ----------------------------------------------------------------------

export type DuelSide = 'a' | 'b' | 'tie';

export interface DuelRoundResult {
  /** 1-based. */
  round: number;
  /** Points, or null when that player has no such round. */
  a: number | null;
  b: number | null;
  winner: DuelSide;
}

export interface DuelResult {
  rounds: DuelRoundResult[];
  totals: { a: number; b: number };
  /** Rounds each side won. */
  won: { a: number; b: number };
  winner: DuelSide;
  /** How far ahead the winner is; 0 on a tie. */
  margin: number;
}

const sum = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0);

/**
 * Both players' rounds side by side. The winner is the higher total
 * (`order: 'asc'` for games where less is better, like time); a round with
 * a missing side goes to the side that played it.
 */
export function compareDuel(
  a: Pick<DuelPlayer, 'rounds'>,
  b: Pick<DuelPlayer, 'rounds'>,
  options: { order?: 'desc' | 'asc' } = {},
): DuelResult {
  const better = options.order === 'asc' ? -1 : 1;
  const pick = (x: number, y: number): DuelSide => (x === y ? 'tie' : (x - y) * better > 0 ? 'a' : 'b');
  const n = Math.max(a.rounds.length, b.rounds.length);
  const rounds: DuelRoundResult[] = [];
  const won = { a: 0, b: 0 };
  for (let i = 0; i < n; i++) {
    const ra = i < a.rounds.length ? a.rounds[i]! : null;
    const rb = i < b.rounds.length ? b.rounds[i]! : null;
    const winner: DuelSide = ra === null ? 'b' : rb === null ? 'a' : pick(ra, rb);
    if (winner !== 'tie') won[winner]++;
    rounds.push({ round: i + 1, a: ra, b: rb, winner });
  }
  const totals = { a: sum(a.rounds), b: sum(b.rounds) };
  const winner = pick(totals.a, totals.b);
  return { rounds, totals, won, winner, margin: Math.abs(totals.a - totals.b) };
}
