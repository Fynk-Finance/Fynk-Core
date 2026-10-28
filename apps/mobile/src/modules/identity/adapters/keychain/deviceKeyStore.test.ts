import * as Keychain from 'react-native-keychain';

import { toBase64, type DeviceRecord } from '../../domain/device';
import { createDeviceKeyStore, DEVICE_KEYCHAIN_SERVICE } from './deviceKeyStore';

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
const key = toBase64(new Uint8Array(32).fill(3));
const record: DeviceRecord = { v: 1, privateKey: key, publicKey: key, deviceId: 'dev-1' };

beforeEach(async () => {
  await Keychain.resetGenericPassword({ service: DEVICE_KEYCHAIN_SERVICE });
  jest.clearAllMocks();
});

it('keeps the record only on this device while it is unlocked', async () => {
  const store = createDeviceKeyStore();
  await store.save(record);
  expect(mocked.setGenericPassword).toHaveBeenCalledWith('device', JSON.stringify(record), {
    service: DEVICE_KEYCHAIN_SERVICE,
    accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
    cloudSync: false,
  });
  expect(await store.load()).toEqual(record);
});

it('returns null when nothing is stored', async () => {
  expect(await createDeviceKeyStore().load()).toBeNull();
});

it('forgets a corrupt entry', async () => {
  await mocked.setGenericPassword('device', '{"v":1,', { service: DEVICE_KEYCHAIN_SERVICE });
  expect(await createDeviceKeyStore().load()).toBeNull();
  expect(mocked.resetGenericPassword).toHaveBeenCalledWith({ service: DEVICE_KEYCHAIN_SERVICE });
});

it('fails when the keychain refuses the write', async () => {
  mocked.setGenericPassword.mockResolvedValueOnce(false);
  await expect(createDeviceKeyStore().save(record)).rejects.toThrow('keychain write failed');
});
