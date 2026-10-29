// Where "Ir a iniciar sesión" goes after the password recovery.
//
// Keycloak closes the login session at the end of the recovery, so the info page gets no link
// (`skipLink`), and the client `fynk-mobile` has no base URL: Keycloak refuses a custom-scheme one
// (`co.fynk.app://...` is "not a valid URL", in the admin API and in the realm import), and the
// app has no https address. What the page does have is `client_data` in the URLs Keycloak builds
// from the login session (`url.loginRestartFlowUrl`): a base64url JSON with the `redirect_uri`
// the app sent (`ru`) and its `state` (`st`). Keycloak checked `ru` against the client's
// redirect URIs when the login began.
//
// Going back to the app with `error=access_denied` and that `state` is the answer Keycloak itself
// gives when a person cancels. The app (AppAuth) ends its session and shows Inicio, where the
// person signs in with the new password. Only the app's own scheme is accepted.
const APP_SCHEME = 'co.fynk.app:';

export function appReturnUrl(...keycloakUrls: Array<string | undefined>): string | undefined {
  for (const keycloakUrl of keycloakUrls) {
    if (keycloakUrl === undefined || keycloakUrl === '') continue;
    try {
      const data = new URL(keycloakUrl, window.location.href).searchParams.get('client_data');
      if (data === null) continue;
      const parsed: unknown = JSON.parse(
        atob(
          data
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .padEnd(Math.ceil(data.length / 4) * 4, '='),
        ),
      );
      if (typeof parsed !== 'object' || parsed === null) continue;
      const { ru, st } = parsed as { ru?: unknown; st?: unknown };
      if (typeof ru !== 'string') continue;
      const target = new URL(ru);
      if (target.protocol !== APP_SCHEME) continue;
      target.searchParams.set('error', 'access_denied');
      if (typeof st === 'string' && st !== '') target.searchParams.set('state', st);
      return target.toString();
    } catch {
      // Not a URL Keycloak built from the login session: try the next one.
    }
  }
  return undefined;
}
