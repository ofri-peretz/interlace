/**
 * @interlace/ui — commitment-model
 *
 * One thing to do this week, and a question a week later: "did you?".
 * The rules for when the follow-up is due and what the answers add up to
 * live here, pure, so the page that asks, the reminder that sends the link
 * and the report that counts the answers agree.
 *
 * Time is milliseconds since the epoch. The follow-up opens `days` after
 * the commitment was made and stays open for `openDays`; after that the
 * question has lapsed, because "did you, a month ago?" gets guesses, not
 * answers.
 */

export const DAY_MS = 86_400_000;

export type CheckInAnswer = 'done' | 'partly' | 'not-yet';
export const CHECK_IN_ANSWERS: readonly CheckInAnswer[] = ['done', 'partly', 'not-yet'];

export interface CommitmentRecord {
  /** The option or the person's own words. */
  choice: string;
  /** When it was made, in ms. */
  madeAt: number;
  /** The answer to "did you?", once given. */
  checkIn?: { answer: CheckInAnswer; at: number } | null;
}

export interface FollowUpOptions {
  /** Days from the commitment to the question. @default 7 */
  days?: number;
  /** Days the question stays open once due. @default 14 */
  openDays?: number;
}

export type FollowUpState = 'waiting' | 'due' | 'answered' | 'lapsed';

const days = (n: number | undefined, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback;

/** When to ask "did you?". */
export function followUpAt(madeAt: number, { days: d }: FollowUpOptions = {}): number {
  return madeAt + days(d, 7) * DAY_MS;
}

/** Where a commitment stands at `now`. */
export function followUpState(c: CommitmentRecord, now: number, options: FollowUpOptions = {}): FollowUpState {
  if (c.checkIn && CHECK_IN_ANSWERS.includes(c.checkIn.answer)) return 'answered';
  const due = followUpAt(c.madeAt, options);
  if (now < due) return 'waiting';
  return now < due + days(options.openDays, 14) * DAY_MS ? 'due' : 'lapsed';
}

export interface CommitmentImpact {
  /** Commitments made. */
  made: number;
  /** Of those, how many answered "did you?". */
  answered: number;
  done: number;
  partly: number;
  notYet: number;
  /** answered ÷ made, or null with nothing made. */
  responseRate: number | null;
  /** (done + partly) ÷ answered, or null with no answers. */
  followThrough: number | null;
  /** Commitments per choice, most-chosen first. */
  choices: { choice: string; count: number }[];
}

/** What a room's commitments add up to: how many answered, how many did it. */
export function commitmentImpact(records: readonly CommitmentRecord[]): CommitmentImpact {
  let done = 0;
  let partly = 0;
  let notYet = 0;
  const byChoice = new Map<string, number>();
  for (const r of records) {
    byChoice.set(r.choice, (byChoice.get(r.choice) ?? 0) + 1);
    const a = r.checkIn?.answer;
    if (a === 'done') done++;
    else if (a === 'partly') partly++;
    else if (a === 'not-yet') notYet++;
  }
  const made = records.length;
  const answered = done + partly + notYet;
  return {
    made,
    answered,
    done,
    partly,
    notYet,
    responseRate: made ? answered / made : null,
    followThrough: answered ? (done + partly) / answered : null,
    choices: [...byChoice.entries()]
      .map(([choice, count]) => ({ choice, count }))
      .sort((a, b) => b.count - a.count),
  };
}
