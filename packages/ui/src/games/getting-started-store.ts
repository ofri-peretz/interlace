/**
 * @interlace/ui — games/getting-started-store
 *
 * Where a checklist keeps what a person has done. The component asks for three things: `load`,
 * `save` and, optionally, `subscribe` for another tab or device. A server store is a few lines in
 * the app (a `fetch` inside `load` and `save`); the kit ships two that need no server.
 *
 * ```ts
 * const store: ChecklistStore = {
 *   load: () => fetch('/api/checklist').then((r) => (r.ok ? r.json() : null)),
 *   save: (snapshot) => fetch('/api/checklist', { method: 'PUT', body: JSON.stringify(snapshot) }).then(() => {}),
 * };
 * ```
 *
 * Whatever `load` returns is untrusted: the component rebuilds it with `parseSnapshot`.
 */

import type { ChecklistSnapshot } from './getting-started-model.js';

export interface ChecklistStore {
  /** `null`: nothing saved yet. Rejects only for a real failure, never for "empty". */
  load(): ChecklistSnapshot | null | Promise<ChecklistSnapshot | null>;
  save(snapshot: ChecklistSnapshot): void | Promise<void>;
  /** Other tabs or devices. Returns the unsubscribe. */
  subscribe?(onChange: (snapshot: ChecklistSnapshot) => void): () => void;
}

/**
 * A store in memory, for tests, stories and a single-page app with its own persistence. Every
 * `subscribe` hears every `save`, so two instances on one store behave like two tabs.
 */
export function memoryStore(initial: ChecklistSnapshot | null = null): ChecklistStore & { current(): ChecklistSnapshot | null } {
  let held = initial;
  const listeners = new Set<(s: ChecklistSnapshot) => void>();
  return {
    load: () => held,
    save(snapshot) {
      held = snapshot;
      listeners.forEach((l) => l(snapshot));
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    current: () => held,
  };
}

/**
 * A store in `localStorage` under `<key>:v1`. Every access is guarded (private mode, blocked
 * storage and a full quota all throw somewhere): it then keeps the snapshot in memory for this page
 * and carries on, so nothing the person did is lost while the page is open. Hears the `storage`
 * event for its own key only.
 */
export function localStorageStore(key: string): ChecklistStore {
  const full = `${key}:v1`;
  let memory: ChecklistSnapshot | null = null;
  const storage = (): Storage | null => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return null;
    }
  };
  return {
    load() {
      try {
        const text = storage()?.getItem(full);
        return text ? (JSON.parse(text) as ChecklistSnapshot) : memory;
      } catch {
        return memory;
      }
    },
    save(snapshot) {
      memory = snapshot;
      try {
        storage()?.setItem(full, JSON.stringify(snapshot));
      } catch {
        /* blocked or full: the page still has it in memory */
      }
    },
    subscribe(onChange) {
      if (typeof window === 'undefined') return () => {};
      const onStorage = (e: StorageEvent) => {
        if (e.key !== full || !e.newValue) return;
        try {
          onChange(JSON.parse(e.newValue) as ChecklistSnapshot);
        } catch {
          /* not ours to read */
        }
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
}
