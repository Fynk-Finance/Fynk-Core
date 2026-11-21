import { useSyncExternalStore } from 'react';

import type { SessionService, SessionState } from '../application/sessionService';

/** Re-renders on every session change (sign in, refresh failure, sign out). */
export function useSessionState(session: SessionService): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState);
}
