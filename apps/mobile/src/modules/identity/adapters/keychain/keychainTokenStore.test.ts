import * as Keychain from 'react-native-keychain';

import type { TokenSet } from '../../domain/session';
import { createKeychainTokenStore, KEYCHAIN_SERVICE } from './keychainTokenStore';

jest.mock('react-native-keychain', () => {
  const entries = new Map<string, { username: string; password: string }>();
  return {
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
    setGenericPassword: jest.fn(
      async (username: string, password: string, o: { service: string }) => {
        entries.set(o.service, { username, password });
        return { service: o.service, storage: 'keychain' };
      },
    ),
    getGenericPassword: jest.fn(async (o: { service: string }) => {
      const entry = entries.get(o.service);
      return entry ? { ...entry, service: o.service, storage: 'keychain' } : false;
    }),
    resetGenericPassword: jest.fn(async (o: { service: string }) => entries.delete(o.service)),
  };
});

const mocked = jest.mocked(Keychain);

const tokens: TokenSet = {
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-10-27T15:05:00.000Z',
  refreshToken: 'refresh-1',
  idToken: 'id-1',
};

beforeEach(async () => {
  await createKeychainTokenStore().clear();
  jest.clearAllMocks();
});

it('keeps the tokens only on this device while it is unlocked', async () => {
  const store = createKeychainTokenStore();
  await store.save(tokens);
  expect(mocked.setGenericPassword).toHaveBeenCalledWith('keycloak', JSON.stringify(tokens), {
    service: KEYCHAIN_SERVICE,
    accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
    cloudSync: false,
  });
  expect(await store.load()).toEqual(tokens);
});

it('returns null when nothing is stored, and after clear', async () => {
  const store = createKeychainTokenStore();
  expect(await store.load()).toBeNull();
  await store.save(tokens);
  await store.clear();
  expect(await store.load()).toBeNull();
});

it('forgets a corrupt entry', async () => {
  await mocked.setGenericPassword('keycloak', '{"accessToken":', { service: KEYCHAIN_SERVICE });
  const store = createKeychainTokenStore();
  expect(await store.load()).toBeNull();
  expect(mocked.resetGenericPassword).toHaveBeenCalledWith({ service: KEYCHAIN_SERVICE });
});

it('fails when the keychain refuses the write', async () => {
  mocked.setGenericPassword.mockResolvedValueOnce(false);
  await expect(createKeychainTokenStore().save(tokens)).rejects.toThrow('keychain write failed');
});
