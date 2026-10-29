import * as Keychain from 'react-native-keychain';

import { DEK_BIOMETRIC_KEYCHAIN_SERVICE, DEK_KEYCHAIN_SERVICE, createDekStore } from './dekStore';

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
const dek = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);

beforeEach(async () => {
  await Keychain.resetGenericPassword({ service: DEK_KEYCHAIN_SERVICE });
  await Keychain.resetGenericPassword({ service: DEK_BIOMETRIC_KEYCHAIN_SERVICE });
  jest.clearAllMocks();
});

it('keeps copy A only on this device while it is unlocked, as base64', async () => {
  const store = createDekStore();
  await store.write(dek);
  expect(mocked.setGenericPassword).toHaveBeenCalledWith('dek', btoa(String.fromCharCode(...dek)), {
    service: 'co.fynk.app.vault.key',
    accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
    cloudSync: false,
  });
  expect(await store.read()).toEqual(dek);
});

it('reserves a separate service for copy B', () => {
  expect(DEK_BIOMETRIC_KEYCHAIN_SERVICE).toBe('co.fynk.app.vault.key.biometric');
});

it('returns null when nothing is stored', async () => {
  expect(await createDekStore().read()).toBeNull();
});

it('returns null for an entry that is not a 32 byte key', async () => {
  await mocked.setGenericPassword('dek', btoa(''), {
    service: DEK_KEYCHAIN_SERVICE,
  });
  expect(await createDekStore().read()).toBeNull();
});

it('remove deletes copy A only, removeAll deletes A and B', async () => {
  const store = createDekStore();
  await store.write(dek);
  await mocked.setGenericPassword('dek', 'b', { service: DEK_BIOMETRIC_KEYCHAIN_SERVICE });
  await store.remove();
  expect(await store.read()).toBeNull();
  expect(
    await Keychain.getGenericPassword({ service: DEK_BIOMETRIC_KEYCHAIN_SERVICE }),
  ).toBeTruthy();
  await store.write(dek);
  await store.removeAll();
  expect(await store.read()).toBeNull();
  expect(await Keychain.getGenericPassword({ service: DEK_BIOMETRIC_KEYCHAIN_SERVICE })).toBe(
    false,
  );
});

it('fails loudly when the keychain refuses the write', async () => {
  mocked.setGenericPassword.mockResolvedValueOnce(false);
  await expect(createDekStore().write(dek)).rejects.toThrow('keychain write failed');
});
