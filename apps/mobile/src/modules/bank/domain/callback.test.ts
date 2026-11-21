// The bank's return to fynk://bank/callback (HU-009 "Flujo seguro", "Errores de autenticación";
// HU-030 "Protección contra accesos indebidos"): the state is checked on the phone.
import { BANK_CALLBACK_URL, readCallback } from './callback';

const state = 'state-123456';

it('is the deep link of the bank route', () => {
  expect(BANK_CALLBACK_URL).toBe('fynk://bank/callback');
});

it('reads the code when the state matches', () => {
  expect(readCallback(`fynk://bank/callback?code=abc%2F1&state=${state}`, state)).toEqual({
    kind: 'code',
    code: 'abc/1',
  });
  expect(readCallback(`fynk://bank/callback?state=${state}&code=x+y#_`, state)).toEqual({
    kind: 'code',
    code: 'x y',
  });
});

it('refuses a code whose state is missing or different', () => {
  expect(readCallback('fynk://bank/callback?code=abc&state=other', state)).toEqual({
    kind: 'state_mismatch',
  });
  expect(readCallback('fynk://bank/callback?code=abc', state)).toEqual({ kind: 'state_mismatch' });
});

it('tells a denied authorization from other bank errors', () => {
  expect(readCallback(`fynk://bank/callback?error=access_denied&state=${state}`, state)).toEqual({
    kind: 'denied',
  });
  expect(
    readCallback(
      `fynk://bank/callback?error=server_error&error_description=x&state=${state}`,
      state,
    ),
  ).toEqual({ kind: 'failed', error: 'server_error' });
});

it('refuses an error whose state is different too', () => {
  expect(readCallback('fynk://bank/callback?error=access_denied&state=other', state)).toEqual({
    kind: 'state_mismatch',
  });
});

it('refuses another URL, or a callback without a code or an error', () => {
  expect(readCallback(`fynk://consentimientos?code=abc&state=${state}`, state)).toEqual({
    kind: 'invalid',
  });
  expect(readCallback(`https://evil.test/bank/callback?code=abc&state=${state}`, state)).toEqual({
    kind: 'invalid',
  });
  expect(readCallback(`fynk://bank/callback?state=${state}`, state)).toEqual({ kind: 'invalid' });
  expect(readCallback(`fynk://bank/callback-x?code=a&state=${state}`, state)).toEqual({
    kind: 'invalid',
  });
});
