// OidcPort with react-native-app-auth: Authorization Code with PKCE (S256) in the system
// browser, never a webview. The refresh token is sent only in request bodies.
import {
  authorize,
  refresh,
  type AuthConfiguration,
  type AuthorizeResult,
} from 'react-native-app-auth';

import type { TokenSet } from '../../domain/session';
import {
  OidcError,
  type ActionStatus,
  type AuthMode,
  type OidcErrorKind,
  type OidcPort,
} from '../../application/ports';
import type { OidcConfig } from './config';

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

// iOS AppAuth codes: -3 user cancelled the flow, -5 network error.
// OAuth access_denied is Keycloak's answer to a cancelled login. The login theme sends the same
// answer to come back to the app after a password reset, so it is a cancel, not a failure.
// Both platforms put it in the error code.
const CANCELLED = /cancel|general error -3\b|\baccess_denied\b/i;
const NETWORK =
  /network|offline|timed out|internet|unable to resolve|connection|general error -5\b/i;

/** Sorts a react-native-app-auth error. Its messages never carry tokens. */
export function classifyAppAuthError(e: unknown): OidcErrorKind {
  const { code, message } = (e ?? {}) as { code?: unknown; message?: unknown };
  const text = `${typeof code === 'string' ? code : ''} ${typeof message === 'string' ? message : ''}`;
  if (CANCELLED.test(text)) return 'cancelled';
  if (code === 'service_configuration_fetch_error' || NETWORK.test(text)) return 'network';
  return 'rejected';
}

const toOidcError = (e: unknown) => new OidcError(classifyAppAuthError(e));

const ACTION_STATUSES: readonly ActionStatus[] = ['success', 'cancelled', 'error'];

/** Keycloak's answer to a `kc_action`, from the redirect's `kc_action_status`. */
function toActionStatus(raw: string | undefined): ActionStatus {
  return ACTION_STATUSES.find((s) => s === raw) ?? 'unknown';
}

const toTokenSet = (result: AuthorizeResult): TokenSet => ({
  accessToken: result.accessToken,
  accessTokenExpiresAt: result.accessTokenExpirationDate,
  refreshToken: result.refreshToken,
  idToken: result.idToken,
});

export function createAppAuthOidc(config: OidcConfig, fetchFn: Fetch = fetch): OidcPort {
  const base: AuthConfiguration = {
    issuer: config.issuer,
    clientId: config.clientId,
    redirectUrl: config.redirectUrl,
    scopes: config.scopes,
    usePKCE: true,
    // The Keycloak cookie stays out of the shared browser, so after sign out "Ya tengo cuenta"
    // asks for the password again.
    iosPrefersEphemeralSession: true,
    androidPrefersEphemeralSession: true,
    dangerouslyAllowInsecureHttpRequests: config.allowInsecureHttp,
  };

  return {
    async authorize(mode: AuthMode) {
      // prompt=create opens Keycloak's registration page (Keycloak 26.1+). The library's type
      // lists only the older prompt values.
      const additionalParameters =
        mode === 'signUp'
          ? ({ prompt: 'create' } as unknown as AuthConfiguration['additionalParameters'])
          : undefined;
      try {
        const result = await authorize({ ...base, additionalParameters });
        return toTokenSet(result);
      } catch (e) {
        throw toOidcError(e);
      }
    },

    async changePassword() {
      // kc_action=UPDATE_PASSWORD makes Keycloak show "Cambiar contraseña" after the login. The
      // library's type lists only the standard parameters.
      const additionalParameters = {
        kc_action: 'UPDATE_PASSWORD',
      } as unknown as AuthConfiguration['additionalParameters'];
      try {
        const result = await authorize({ ...base, additionalParameters });
        return {
          tokens: toTokenSet(result),
          actionStatus: toActionStatus(result.authorizeAdditionalParameters?.kc_action_status),
        };
      } catch (e) {
        throw toOidcError(e);
      }
    },

    async reauthenticate() {
      // prompt=login makes Keycloak ask for the credentials even with a session, and max_age=0
      // says the same for an older session; either way the id token gets a new auth_time.
      const additionalParameters = {
        prompt: 'login',
        max_age: '0',
      } as unknown as AuthConfiguration['additionalParameters'];
      try {
        return toTokenSet(await authorize({ ...base, additionalParameters }));
      } catch (e) {
        throw toOidcError(e);
      }
    },

    async refresh(current: TokenSet) {
      try {
        const result = await refresh(base, { refreshToken: current.refreshToken });
        return {
          accessToken: result.accessToken,
          accessTokenExpiresAt: result.accessTokenExpirationDate,
          // Keycloak rotates the refresh token; keep the old one if a response has none.
          refreshToken: result.refreshToken ?? current.refreshToken,
          idToken: result.idToken || current.idToken,
        };
      } catch (e) {
        throw toOidcError(e);
      }
    },

    async endSession(tokens: TokenSet) {
      // Back channel logout of a public client: client_id and refresh_token in the form body.
      const body = new URLSearchParams({
        client_id: config.clientId,
        refresh_token: tokens.refreshToken,
      });
      let response: Response;
      try {
        response = await fetchFn(`${config.issuer}/protocol/openid-connect/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
      } catch {
        throw new OidcError('network');
      }
      if (!response.ok) throw new OidcError('rejected', `logout ${response.status}`);
    },
  };
}
