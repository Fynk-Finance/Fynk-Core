// The app session: Keycloak tokens, their refresh and the sign-in state the UI shows.
import type { Clock } from '@shared/domain/types';

import { isRefreshDue, subjectOf, type SessionStatus, type TokenSet } from '../domain/session';
import { isOidcError, type AuthMode, type OidcPort, type TokenStorePort } from './ports';

export interface SessionState {
  status: SessionStatus;
  /** The system browser is open for sign in or sign up. */
  busy: boolean;
  /** Why the last sign in or sign up failed. A cancel is not an error. */
  error: 'network' | 'unknown' | null;
}

/** `changed`: the new password is set. `cancelled`: nothing changed. `failed`: try again. */
export type ChangePasswordResult = 'changed' | 'cancelled' | 'failed';

export interface SessionService {
  getState(): SessionState;
  subscribe(listener: () => void): () => void;
  /** Reads the stored tokens once at start. Safe to call again. */
  restore(): Promise<void>;
  signIn(): Promise<void>;
  signUp(): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Opens Keycloak's "Cambiar contraseña" page. Keycloak ends the other sessions, so the app
   * continues on the new session it returns. Concurrent calls share one run.
   */
  changePassword(): Promise<ChangePasswordResult>;
  /** The access token, refreshed first when it expires within 60 s. Null when signed out. */
  getAccessToken(): Promise<string | null>;
  /** Refreshes now. Resolves true when a new access token is available. */
  refreshAccessToken(): Promise<boolean>;
}

export interface SessionDeps {
  oidc: OidcPort;
  store: TokenStorePort;
  clock: Clock;
}

export function createSessionService({ oidc, store, clock }: SessionDeps): SessionService {
  let state: SessionState = { status: 'restoring', busy: false, error: null };
  let tokens: TokenSet | null = null;
  // Bumped on every sign out, so a refresh that finishes afterwards is dropped.
  let generation = 0;
  let restoring: Promise<void> | null = null;
  let authorizing: Promise<void> | null = null;
  let changing: Promise<ChangePasswordResult> | null = null;
  let refreshing: Promise<boolean> | null = null;
  const listeners = new Set<() => void>();

  const setState = (next: Partial<SessionState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };

  const forget = async () => {
    generation += 1;
    tokens = null;
    setState({ status: 'signedOut', busy: false });
    await store.clear().catch(() => undefined);
  };

  const authorize = (mode: AuthMode): Promise<void> => {
    authorizing ??= (async () => {
      setState({ busy: true, error: null });
      try {
        const next = await oidc.authorize(mode);
        await store.save(next);
        tokens = next;
        setState({ status: 'signedIn', busy: false });
      } catch (e) {
        const error = isOidcError(e, 'cancelled')
          ? null
          : isOidcError(e, 'network')
            ? 'network'
            : 'unknown';
        setState({ busy: false, error });
      }
    })().finally(() => {
      authorizing = null;
    });
    return authorizing;
  };

  const runChangePassword = async (): Promise<ChangePasswordResult> => {
    const old = tokens;
    if (!old) return 'cancelled';
    const gen = generation;
    let answer: Awaited<ReturnType<OidcPort['changePassword']>>;
    try {
      answer = await oidc.changePassword();
    } catch (e) {
      return isOidcError(e, 'cancelled') ? 'cancelled' : 'failed';
    }
    // The browser opened a new Keycloak session. Signed out meanwhile: close it, keep nothing.
    if (gen !== generation) {
      await oidc.endSession(answer.tokens).catch(() => undefined);
      return 'cancelled';
    }
    // Keycloak asks for the login first, and someone could sign in there with another account.
    // The vault on this phone belongs to this account, so tokens of another one are never kept.
    const before = subjectOf(old.idToken);
    if (before === null || subjectOf(answer.tokens.idToken) !== before) {
      await oidc.endSession(answer.tokens).catch(() => undefined);
      return 'failed';
    }
    try {
      await store.save(answer.tokens);
    } catch {
      return 'failed';
    }
    if (gen !== generation) {
      await store.clear().catch(() => undefined);
      await oidc.endSession(answer.tokens).catch(() => undefined);
      return 'cancelled';
    }
    tokens = answer.tokens;
    // Whatever the status, the browser made a new session. Close the old one so a cancelled
    // change does not leave two open.
    await oidc.endSession(old).catch(() => undefined);
    if (answer.actionStatus === 'success') return 'changed';
    return answer.actionStatus === 'cancelled' ? 'cancelled' : 'failed';
  };

  const refresh = async (): Promise<boolean> => {
    const current = tokens;
    if (!current) return false;
    const gen = generation;
    try {
      const next = await oidc.refresh(current);
      if (gen !== generation) return false;
      await store.save(next);
      tokens = next;
      return true;
    } catch (e) {
      // Offline: keep the session and try again later. Anything else ends it (go to Inicio).
      if (gen === generation && !isOidcError(e, 'network')) await forget();
      return false;
    }
  };

  const refreshAccessToken = (): Promise<boolean> => {
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore() {
      restoring ??= (async () => {
        try {
          tokens = await store.load();
        } catch {
          tokens = null;
        }
        setState({ status: tokens ? 'signedIn' : 'signedOut' });
      })();
      return restoring;
    },
    signIn: () => authorize('signIn'),
    signUp: () => authorize('signUp'),
    changePassword() {
      changing ??= runChangePassword().finally(() => {
        changing = null;
      });
      return changing;
    },
    async signOut() {
      const current = tokens;
      await forget();
      if (!current) return;
      try {
        await oidc.endSession(current);
      } catch {
        // Best effort: the local tokens are already gone.
      }
    },
    async getAccessToken() {
      if (tokens && isRefreshDue(tokens, clock.now())) await refreshAccessToken();
      return tokens?.accessToken ?? null;
    },
    refreshAccessToken,
  };
}
