// The system browser handoff: the exact authorize URL, the callback, an ephemeral session.
import { getRandomBytes } from 'expo-crypto';
import { openAuthSessionAsync } from 'expo-web-browser';

import { secureRandom, systemBrowser } from './systemBrowser';

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ getRandomBytes: jest.fn((n: number) => new Uint8Array(n)) }));

const open = openAuthSessionAsync as jest.Mock;

it('opens the authorize URL as is and returns the redirect', async () => {
  open.mockResolvedValueOnce({ type: 'success', url: 'fynk://bank/callback?code=a&state=b' });
  expect(await systemBrowser('https://auth.test/x?request_uri=1', 'fynk://bank/callback')).toEqual({
    type: 'success',
    url: 'fynk://bank/callback?code=a&state=b',
  });
  expect(open).toHaveBeenCalledWith('https://auth.test/x?request_uri=1', 'fynk://bank/callback', {
    preferEphemeralSession: true,
  });
});

it.each([
  ['cancel', 'cancel'],
  ['dismiss', 'dismiss'],
  ['locked', 'cancel'],
  ['opened', 'cancel'],
])('treats %s as not finished', async (type, expected) => {
  open.mockResolvedValueOnce({ type });
  expect(await systemBrowser('https://auth.test/x', 'fynk://bank/callback')).toEqual({
    type: expected,
  });
});

it('takes its random bytes from expo-crypto', () => {
  expect(secureRandom(32)).toHaveLength(32);
  expect(getRandomBytes).toHaveBeenCalledWith(32);
});
