/**
 * @interlace/ui — games/exit-ticket-model
 *
 * A few quick questions as people leave: a 0 to 10 "would you recommend" (grouped the standard way
 * into promoters, passives and detractors, with the score), a rating on a short scale, and a choice.
 * Each person sends their answers once and may send again until the host closes it. Pure, so a
 * server and a recap page compute the same numbers; `exitTicketActivity` is the same thing as a rule
 * a live room runs, and `readExitTicket` reads what the room holds back as untrusted data.
 *
 * Answers are kept for the session by player id so one person's second send replaces their first;
 * nothing here ever shows who said what (`summarizeTicket` takes answers, not names).
 */

import type { ActivityReducer, RoomState } from './room-model.js';
import { readShared } from './room-model.js';
import { cleanLabel, finite, isId, isRecord, isStr, presentIds } from './room-activity-kit.js';

export const EXIT_TICKET_KEY = 'exit-ticket';
export const MAX_QUESTIONS = 5;
const MAX_PROMPT = 160;
const MAX_LABEL = 60;

export type TicketQuestion =
  | { id: string; kind: 'nps'; prompt: string }
  | { id: string; kind: 'scale'; prompt: string; min: number; max: number }
  | { id: string; kind: 'choice'; prompt: string; options: { id: string; label: string }[] };

/** A question's answer: a number for `nps` and `scale`, an option id for `choice`. */
export type TicketAnswers = Record<string, number | string>;

export type NpsBand = 'promoter' | 'passive' | 'detractor';

/** 9 and 10 promote, 7 and 8 are passive, 0 to 6 detract. */
export function npsBand(score: number): NpsBand {
  return score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor';
}

export interface NpsSummary {
  count: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** Promoters minus detractors, as a whole number from -100 to 100; null with no answers. */
  score: number | null;
}

export function summarizeNps(scores: readonly number[]): NpsSummary {
  const clean = scores.filter((s) => Number.isInteger(s) && s >= 0 && s <= 10);
  const bands = { promoter: 0, passive: 0, detractor: 0 };
  for (const s of clean) bands[npsBand(s)] += 1;
  return {
    count: clean.length,
    promoters: bands.promoter,
    passives: bands.passive,
    detractors: bands.detractor,
    score: clean.length === 0 ? null : Math.round(((bands.promoter - bands.detractor) / clean.length) * 100),
  };
}

/** A host's questions: one to five, each with its own id. Null when any is not usable. */
export function cleanQuestions(raw: unknown): TicketQuestion[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_QUESTIONS) return null;
  const seen = new Set<string>();
  const out: TicketQuestion[] = [];
  for (const q of raw) {
    if (!isRecord(q) || !isId(q.id) || seen.has(q.id)) return null;
    const prompt = cleanLabel(q.prompt, MAX_PROMPT);
    if (prompt === null) return null;
    seen.add(q.id);
    if (q.kind === 'nps') out.push({ id: q.id, kind: 'nps', prompt });
    else if (q.kind === 'scale') {
      const min = q.min === undefined ? 1 : q.min;
      const max = q.max === undefined ? 5 : q.max;
      if (!Number.isInteger(min) || !Number.isInteger(max) || (min as number) < 0 || (max as number) > 10 || (max as number) - (min as number) < 1) return null;
      out.push({ id: q.id, kind: 'scale', prompt, min: min as number, max: max as number });
    } else if (q.kind === 'choice') {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) return null;
      const ids = new Set<string>();
      const options: { id: string; label: string }[] = [];
      for (const o of q.options) {
        if (!isRecord(o) || !isId(o.id) || ids.has(o.id)) return null;
        const label = cleanLabel(o.label, MAX_LABEL);
        if (label === null) return null;
        ids.add(o.id);
        options.push({ id: o.id, label });
      }
      out.push({ id: q.id, kind: 'choice', prompt, options });
    } else return null;
  }
  return out;
}

/**
 * A person's answers, checked against the questions. A question left out stays unanswered; an answer
 * to a question that is not there, or out of range, makes the whole ticket unusable (null), and so
 * does a ticket with no answer at all.
 */
export function cleanAnswers(questions: readonly TicketQuestion[], raw: unknown): TicketAnswers | null {
  if (!isRecord(raw)) return null;
  const out: TicketAnswers = {};
  for (const [id, v] of Object.entries(raw)) {
    const q = questions.find((x) => x.id === id);
    if (!q) return null;
    if (q.kind === 'nps') {
      if (!finite(v) || !Number.isInteger(v) || v < 0 || v > 10) return null;
    } else if (q.kind === 'scale') {
      if (!finite(v) || !Number.isInteger(v) || v < q.min || v > q.max) return null;
    } else if (typeof v !== 'string' || !q.options.some((o) => o.id === v)) return null;
    out[id] = v as number | string;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export type QuestionSummary =
  | ({ id: string; kind: 'nps' } & NpsSummary)
  | { id: string; kind: 'scale'; count: number; mean: number | null; counts: number[]; min: number }
  | { id: string; kind: 'choice'; count: number; options: { id: string; label: string; count: number }[] };

/** The room's answers to each question, from anonymous answers. */
export function summarizeTicket(questions: readonly TicketQuestion[], responses: readonly TicketAnswers[]): QuestionSummary[] {
  return questions.map((q): QuestionSummary => {
    const own = responses.map((r) => (Object.hasOwn(r, q.id) ? r[q.id] : undefined));
    if (q.kind === 'nps') return { id: q.id, kind: 'nps', ...summarizeNps(own.filter((v): v is number => typeof v === 'number')) };
    if (q.kind === 'scale') {
      const values = own.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= q.min && v <= q.max);
      const counts = Array.from({ length: q.max - q.min + 1 }, () => 0);
      for (const v of values) counts[v - q.min] = (counts[v - q.min] as number) + 1;
      return {
        id: q.id,
        kind: 'scale',
        count: values.length,
        mean: values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length,
        counts,
        min: q.min,
      };
    }
    const options = q.options.map((o) => ({ ...o, count: own.filter((v) => v === o.id).length }));
    return { id: q.id, kind: 'choice', count: options.reduce((a, o) => a + o.count, 0), options };
  });
}

// --- The room --------------------------------------------------------------------

export interface ExitTicketState {
  questions: TicketQuestion[];
  /** Each player's latest answers, by player id. */
  responses: Record<string, TicketAnswers>;
  /** False once the host has closed it. */
  open: boolean;
}

function decodeTicket(raw: unknown): ExitTicketState | null {
  if (!isRecord(raw) || !isRecord(raw.responses)) return null;
  const questions = cleanQuestions(raw.questions);
  if (!questions) return null;
  const responses: Record<string, TicketAnswers> = {};
  for (const [by, a] of Object.entries(raw.responses)) {
    if (!isStr(by, 64)) continue;
    const answers = cleanAnswers(questions, a);
    if (answers) responses[by] = answers;
  }
  return { questions, responses, open: raw.open !== false };
}

/** The ticket a room holds, without answers from anyone no longer in it. Null before the host starts it. */
export function readExitTicket(room: Pick<RoomState, 'shared' | 'players'> | null | undefined): ExitTicketState | null {
  const state = readShared(room, EXIT_TICKET_KEY, decodeTicket);
  if (!state || !room) return null;
  const here = presentIds(room);
  return { ...state, responses: Object.fromEntries(Object.entries(state.responses).filter(([by]) => here.has(by))) };
}

/**
 * The exit ticket as an activity. The host starts (`{ type: 'start', questions }`), closes (`close`)
 * and clears; a phone sends its answers (`{ type: 'send', answers }`), and sends again to change them
 * while it is open.
 */
export const exitTicketActivity: ActivityReducer = (slice, action, ctx) => {
  if (!isRecord(action) || typeof action.type !== 'string') return { refuse: 'bad-action' };
  if (action.type === 'start') {
    if (!ctx.host) return { refuse: 'not-host' };
    const questions = cleanQuestions(action.questions);
    return questions ? { slice: { questions, responses: {}, open: true } satisfies ExitTicketState } : { refuse: 'bad-action' };
  }
  const state = decodeTicket(slice);
  if (action.type === 'send') {
    if (ctx.host) return { refuse: 'bad-action' };
    if (!state) return { refuse: 'wrong-phase' };
    const answers = cleanAnswers(state.questions, action.answers);
    if (!answers) return { refuse: 'bad-action' };
    if (!state.open) return { refuse: 'wrong-phase' };
    return { slice: { ...state, responses: { ...state.responses, [ctx.playerId]: answers } } };
  }
  if (action.type === 'close' || action.type === 'clear') {
    if (!ctx.host) return { refuse: 'not-host' };
    if (!state) return { refuse: 'wrong-phase' };
    if (action.type === 'clear') return { slice: { ...state, responses: {}, open: true } };
    return typeof action.on === 'boolean' ? { slice: { ...state, open: !action.on } } : { refuse: 'bad-action' };
  }
  return { refuse: 'bad-action' };
};
