// Keycloak settings. EXPO_PUBLIC_* values are inlined at build time (apps/mobile/.env).
// The issuer must be the one the API checks (KEYCLOAK_ISSUER), see apps/mobile/.env.example.
const DEFAULT_ISSUER = 'http://localhost:8081/realms/fynk';

export interface OidcConfig {
  issuer: string;
  clientId: string;
  /** Registered on the fynk-mobile client of the realm and in app.json (react-native-app-auth). */
  redirectUrl: string;
  /** No offline_access: the session lives on rotating refresh tokens (team decision). */
  scopes: string[];
  /** Plain HTTP is allowed only for a local Keycloak in development builds. */
  allowInsecureHttp: boolean;
}

export function createOidcConfig(issuerSetting: string | undefined, isDev: boolean): OidcConfig {
  const issuer = (issuerSetting || DEFAULT_ISSUER).replace(/\/+$/, '');
  return {
    issuer,
    clientId: 'fynk-mobile',
    redirectUrl: 'co.fynk.app://oauth/callback',
    scopes: ['openid', 'profile', 'email'],
    allowInsecureHttp: isDev && issuer.startsWith('http://'),
  };
}
