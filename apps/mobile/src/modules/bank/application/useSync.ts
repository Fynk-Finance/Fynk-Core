// useSync() for the screens with pull to refresh (Dashboard, Billetera, Movimientos): whether a
// sync is running, the last update date, and refresh(), which asks for one (60 s cooldown).
import { useCallback, useSyncExternalStore } from 'react';

import type { SyncController, SyncState } from './syncController';
import type { SyncReport } from './syncEngine';

export interface UseSync extends SyncState {
  refresh: () => Promise<SyncReport>;
}

export function useSync(controller: SyncController): UseSync {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const refresh = useCallback(() => controller.syncNow(), [controller]);
  return { ...state, refresh };
}
