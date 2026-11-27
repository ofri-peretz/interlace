'use client';

/**
 * @interlace/ui — useAccount
 *
 * Turns the app's own sign-in service into the state `AccountMenu` shows: `unknown`, then
 * `signed-out` or `signed-in`. The service is the app's (Supabase, Auth.js, Clerk, a cookie);
 * nothing here names one. The app writes an adapter in about ten lines:
 *
 *   const adapter: AccountAdapter = {
 *     read: async () => toAccount(await service.getSession()),
 *     subscribe: (onChange) => service.onChange((session) => onChange(toAccount(session))),
 *   };
 *
 * `read` is called once on mount (it may return a promise); `subscribe`, when present, reports
 * later changes (a sign-in, a sign-out, a better profile) and returns the unsubscribe. The hook
 * holds the state and nothing else: it never reads or writes a session, a cookie or a storage key.
 *
 * - The first render is `unknown`, on the server and in the browser alike, so the markup matches
 *   and nothing flashes the wrong state.
 * - A `read` that fails is `signed-out`. An app that wants the failure reported wraps its adapter.
 * - Unmounting unsubscribes, and an answer that arrives after it is ignored.
 * - A later `read` never overwrites a newer change (see `reduceAccount`).
 * - Keep the adapter's identity stable (module scope or `useMemo`): a new one means a new
 *   subscription and a fresh `unknown`.
 * - `useAccount(null)` stays `unknown`, for an app whose accounts are switched off.
 */
import * as React from 'react';

import { reduceAccount, UNKNOWN, type Account, type AccountState } from './account-menu-model.js';

export interface AccountAdapter {
  /** The current account or null. Called once on mount. */
  read(): Account | null | Promise<Account | null>;
  /** Later changes. Returns the unsubscribe. */
  subscribe?(onChange: (account: Account | null) => void): () => void;
}

export function useAccount(adapter: AccountAdapter | null): AccountState {
  const [state, dispatch] = React.useReducer(reduceAccount, UNKNOWN);

  React.useEffect(() => {
    dispatch({ type: 'reset' });
    if (!adapter) return undefined;
    let live = true;
    const unsubscribe = adapter.subscribe?.((account) => {
      if (live) dispatch({ type: 'change', account });
    });
    new Promise<Account | null>((resolve) => resolve(adapter.read())).then(
      (account) => {
        if (live) dispatch({ type: 'read', account });
      },
      () => {
        if (live) dispatch({ type: 'read', account: null });
      },
    );
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [adapter]);

  return state;
}
