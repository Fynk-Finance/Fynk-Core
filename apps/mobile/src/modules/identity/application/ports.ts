// Ports of the identity module. Adapters implement them with react-native-app-auth and
// react-native-keychain; tests use fakes.
import type { TokenSet } from '../domain/session';

export type AuthMode = 'signIn' | 'signUp';

/**
 * Why a call to Keycloak failed:
 * - `cancelled`: the user closed the browser;
 * - `rejected`: Keycloak said no (expired or revoked session, bad request);
 * - `network`: Keycloak could not be reached.
 */
export type OidcErrorKind = 'cancelled' | 'rejected' | 'network';

export class OidcError extends Error {
  constructor(
    readonly kind: OidcErrorKind,
    message: string = kind,
  ) {
    super(message);
    this.name = 'OidcError';
  }
}

export function isOidcError(e: unknown, kind?: OidcErrorKind): e is OidcError {
  return e instanceof OidcError && (kind === undefined || e.kind === kind);
}

/** Keycloak through OpenID Connect: Authorization Code with PKCE in the system browser. */
export interface OidcPort {
  authorize(mode: AuthMode): Promise<TokenSet>;
  refresh(current: TokenSet): Promise<TokenSet>;
  /** Ends the Keycloak session of these tokens. */
  endSession(tokens: TokenSet): Promise<void>;
}

/** Where the tokens live between app starts: Keychain or Keystore, never AsyncStorage. */
export interface TokenStorePort {
  load(): Promise<TokenSet | null>;
  save(tokens: TokenSet): Promise<void>;
  clear(): Promise<void>;
}
