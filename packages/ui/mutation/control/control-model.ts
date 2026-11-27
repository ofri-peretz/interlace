// A twenty-line room gate, the control for the mutation gate. `weak.test.ts` runs every line and
// asserts only two outcomes; `strong.test.ts` pins them all, boundaries included. The gate must go
// red on the first and green on the second, on every run (docs/intents/mutation-testing-room-logic §7.2).

export type Verdict = "admit" | "locked" | "expired" | "full";

export interface Room {
  locked: boolean;
  count: number;
  max: number;
  /** When the code stops working, in ms; null for never. */
  expiresAt: number | null;
}

export function admit(room: Room, now: number): Verdict {
  if (room.locked) return "locked";
  if (room.expiresAt !== null && now >= room.expiresAt) return "expired";
  if (room.count >= room.max) return "full";
  return "admit";
}
