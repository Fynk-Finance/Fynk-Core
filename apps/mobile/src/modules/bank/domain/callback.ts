// The bank's return to the app after the person authorizes or cancels in its portal
// (RFC 6749, 4.1.2). Pure. React Native's URL has no searchParams, so the query is read here.

/** `linking.ts` maps the bank route to `bank`; the backend's BANK_REDIRECT_URI is this URL. */
export const BANK_CALLBACK_URL = 'fynk://bank/callback';

export type CallbackResult =
  | { kind: 'code'; code: string }
  | { kind: 'denied' }
  | { kind: 'failed'; error: string }
  | { kind: 'state_mismatch' }
  | { kind: 'invalid' };

function queryOf(url: string): Map<string, string> | null {
  const [base, rest = ''] = url.split('#', 1)[0]!.split(/\?(.*)/s);
  if (base !== BANK_CALLBACK_URL) return null;
  const params = new Map<string, string>();
  for (const pair of rest.split('&')) {
    if (!pair) continue;
    const [key, value = ''] = pair.split(/=(.*)/s);
    try {
      params.set(
        decodeURIComponent(key!.replace(/\+/g, ' ')),
        decodeURIComponent(value.replace(/\+/g, ' ')),
      );
    } catch {
      return null;
    }
  }
  return params;
}

/** The code, or why there is none. The state is checked before anything else is trusted. */
export function readCallback(url: string, expectedState: string): CallbackResult {
  const params = queryOf(url);
  if (!params) return { kind: 'invalid' };
  const code = params.get('code');
  const error = params.get('error');
  if (!code && !error) return { kind: 'invalid' };
  if (params.get('state') !== expectedState) return { kind: 'state_mismatch' };
  if (error) return error === 'access_denied' ? { kind: 'denied' } : { kind: 'failed', error };
  return { kind: 'code', code: code! };
}
