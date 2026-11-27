/**
 * A transport that behaves like a bad network, for tests: it can hold what arrives, then let it go
 * late, repeated, or in the wrong order. Wraps what ONE client receives; what it sends is untouched.
 */
import type { RoomTransport } from '../src/games/room-model.js';

export interface FlakyReceiver<M> {
  transport: RoomTransport<M>;
  /** From now, hold everything that arrives. */
  hold(): void;
  /** What is held now, oldest first. */
  held(): M[];
  /** Let the held messages through: in the order they came, or `reverse`; each `repeat` times. */
  release(options?: { order?: 'fifo' | 'reverse'; repeat?: number }): void;
}

export function flakyReceiver<M>(inner: RoomTransport<M>): FlakyReceiver<M> {
  const listeners = new Set<(message: M) => void>();
  let held: M[] | null = null;
  inner.subscribe((message) => {
    if (held) held.push(message);
    else listeners.forEach((l) => l(message));
  });
  return {
    transport: {
      send: (message) => inner.send(message),
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close: () => inner.close?.(),
    },
    hold() {
      held ??= [];
    },
    held: () => held?.slice() ?? [],
    release({ order = 'fifo', repeat = 1 } = {}) {
      const batch = held ?? [];
      held = null;
      for (const message of order === 'reverse' ? batch.slice().reverse() : batch) {
        for (let i = 0; i < repeat; i++) listeners.forEach((l) => l(message));
      }
    },
  };
}

/** What a client sends, with the first `n` messages lost on the way: for a phone on a bad connection. */
export function lossySender<M>(inner: RoomTransport<M>): { transport: RoomTransport<M>; drop(n: number): void; sent(): M[] } {
  let dropping = 0;
  const sent: M[] = [];
  return {
    transport: {
      send(message) {
        sent.push(message);
        if (dropping > 0) dropping -= 1;
        else inner.send(message);
      },
      subscribe: (listener) => inner.subscribe(listener),
      close: () => inner.close?.(),
    },
    drop(n) {
      dropping = n;
    },
    sent: () => sent.slice(),
  };
}
