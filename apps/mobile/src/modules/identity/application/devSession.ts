// Development builds only: a session that sends the local API's dev-token, so teammates can
// reach the tabs without running Keycloak (team decision). Release builds never use it.
import type { SessionService, SessionState } from './sessionService';

export const DEV_TOKEN = 'dev-token';
export const DEV_USER_ID = 'dev-user';

/** EXPO_PUBLIC_DEV_AUTH=dev-token, and only when __DEV__ is true. */
export function shouldUseDevAuth(setting: string | undefined, isDev: boolean): boolean {
  return isDev && setting === DEV_TOKEN;
}

export function createDevSession(): SessionService {
  let state: SessionState = { status: 'signedIn', busy: false, error: null };
  const listeners = new Set<() => void>();
  const set = (status: SessionState['status']) => {
    state = { ...state, status };
    listeners.forEach((l) => l());
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore: async () => undefined,
    signIn: async () => set('signedIn'),
    signUp: async () => set('signedIn'),
    signOut: async () => set('signedOut'),
    // There is no Keycloak to change a password in.
    changePassword: async () => 'cancelled',
    // There is no login to repeat: the dev session counts as just logged in, always.
    reauthenticate: async () => 'ok',
    lastLoginAt: () => (state.status === 'signedIn' ? new Date() : null),
    userId: () => (state.status === 'signedIn' ? DEV_USER_ID : null),
    getAccessToken: async () => (state.status === 'signedIn' ? DEV_TOKEN : null),
    refreshAccessToken: async () => false,
  };
}
