// The app session: Keycloak tokens, their refresh and the sign-in state the UI shows.
import type { Clock } from '@shared/domain/types';

import {
  authTimeOf,
  isRefreshDue,
  subjectOf,
  type SessionStatus,
  type TokenSet,
} from '../domain/session';
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

/** `ok`: a fresh login of the same account. `cancelled`: nothing changed. `failed`: try again. */
export type ReauthenticateResult = 'ok' | 'cancelled' | 'failed';

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
  /**
   * A fresh Keycloak login of the same account, even if Keycloak has a session: the vault asks
   * for it before it unlocks without biometrics and before sensitive actions. Another account's
   * login is ended and never kept. Concurrent calls share one run.
   */
  reauthenticate(): Promise<ReauthenticateResult>;
  /** When the person last logged in interactively (id token `auth_time`). Null when signed out. */
  lastLoginAt(): Date | null;
  /** The account id (`sub` of the id token). Null when signed out or the token has none. */
  userId(): string | null;
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

// How far Keycloak's clock may be behind the phone's when checking that a login is fresh.
const FRESH_LOGIN_SKEW_SECONDS = 60;

export function createSessionService({ oidc, store, clock }: SessionDeps): SessionService {
  let state: SessionState = { status: 'restoring', busy: false, error: null };
  let tokens: TokenSet | null = null;
  // Bumped on every sign out, so a refresh that finishes afterwards is dropped.
  let generation = 0;
  let restoring: Promise<void> | null = null;
  let authorizing: Promise<void> | null = null;
  let changing: Promise<ChangePasswordResult> | null = null;
  let reauthenticating: Promise<ReauthenticateResult> | null = null;
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

  /**
   * Makes the tokens of a new browser login the session, if they are for the same account and
   * nobody signed out meanwhile. Otherwise they are ended and nothing is kept. Closes the old
   * Keycloak session once the new one is stored.
   */
  const adopt = async (
    old: TokenSet,
    next: TokenSet,
    gen: number,
  ): Promise<'kept' | 'cancelled' | 'failed'> => {
    // Keycloak asks for the login first, and someone could sign in there with another account.
    // The vault on this phone belongs to this account, so tokens of another one are never kept.
    const before = subjectOf(old.idToken);
    if (before === null || subjectOf(next.idToken) !== before) {
      await oidc.endSession(next).catch(() => undefined);
      return 'failed';
    }
    try {
      await store.save(next);
    } catch {
      return 'failed';
    }
    if (gen !== generation) {
      await store.clear().catch(() => undefined);
      await oidc.endSession(next).catch(() => undefined);
      return 'cancelled';
    }
    tokens = next;
    // Whatever the status, the browser made a new session. Close the old one so a cancelled
    // action does not leave two open.
    await oidc.endSession(old).catch(() => undefined);
    return 'kept';
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
    const adopted = await adopt(old, answer.tokens, gen);
    if (adopted !== 'kept') return adopted;
    if (answer.actionStatus === 'success') return 'changed';
    return answer.actionStatus === 'cancelled' ? 'cancelled' : 'failed';
  };

  const runReauthenticate = async (): Promise<ReauthenticateResult> => {
    const old = tokens;
    if (!old) return 'cancelled';
    const gen = generation;
    // auth_time is in whole seconds.
    const startedAt = Math.floor(clock.now().getTime() / 1000) - FRESH_LOGIN_SKEW_SECONDS;
    let next: TokenSet;
    try {
      next = await oidc.reauthenticate();
    } catch (e) {
      return isOidcError(e, 'cancelled') ? 'cancelled' : 'failed';
    }
    // Signed out meanwhile: close the Keycloak session the browser opened, keep nothing.
    if (gen !== generation) {
      await oidc.endSession(next).catch(() => undefined);
      return 'cancelled';
    }
    // The vault unlocks on 'ok', so it must be a login typed now: a Keycloak session that skipped
    // the form would carry an older auth_time.
    const authTime = authTimeOf(next.idToken);
    if (authTime === null || authTime < startedAt) {
      await oidc.endSession(next).catch(() => undefined);
      return 'failed';
    }
    const adopted = await adopt(old, next, gen);
    return adopted === 'kept' ? 'ok' : adopted;
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
    reauthenticate() {
      reauthenticating ??= runReauthenticate().finally(() => {
        reauthenticating = null;
      });
      return reauthenticating;
    },
    lastLoginAt() {
      const seconds = tokens ? authTimeOf(tokens.idToken) : null;
      return seconds === null ? null : new Date(seconds * 1000);
    },
    userId: () => (tokens ? subjectOf(tokens.idToken) : null),
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
