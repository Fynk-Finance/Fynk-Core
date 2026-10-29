import * as Keychain from 'react-native-keychain';

import { DEK_BIOMETRIC_KEYCHAIN_SERVICE, DEK_KEYCHAIN_SERVICE, createDekStore } from './dekStore';

jest.mock('react-native-keychain', () => {
  const entries = new Map<string, { username: string; password: string }>();
  return {
    ACCESSIBLE: {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
      WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'AccessibleWhenPasscodeSetThisDeviceOnly',
    },
    ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'BiometryCurrentSet' },
    STORAGE_TYPE: { AES_GCM: 'KeystoreAESGCM' },
    getSupportedBiometryType: jest.fn(async () => 'FaceID'),
    hasGenericPassword: jest.fn(async (o: { service: string }) => entries.has(o.service)),
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

it('removeAll deletes copy B even when deleting copy A fails', async () => {
  const store = createDekStore();
  await mocked.setGenericPassword('dek', 'b', { service: DEK_BIOMETRIC_KEYCHAIN_SERVICE });
  mocked.resetGenericPassword.mockRejectedValueOnce(new Error('keystore busy'));
  await expect(store.removeAll()).rejects.toThrow('keystore busy');
  expect(await Keychain.getGenericPassword({ service: DEK_BIOMETRIC_KEYCHAIN_SERVICE })).toBe(
    false,
  );
});

it('fails loudly when the keychain refuses the write', async () => {
  mocked.setGenericPassword.mockResolvedValueOnce(false);
  await expect(createDekStore().write(dek)).rejects.toThrow('keychain write failed');
});

describe('copy B', () => {
  const prompt = { title: 'T', subtitle: 'S', cancel: 'C' };

  it('is bound to the current biometric set, on this device, in AES-GCM storage', async () => {
    await createDekStore().writeBiometric(dek, prompt);
    expect(mocked.setGenericPassword).toHaveBeenCalledWith(
      'dek',
      btoa(String.fromCharCode(...dek)),
      {
        service: 'co.fynk.app.vault.key.biometric',
        accessible: 'AccessibleWhenPasscodeSetThisDeviceOnly',
        accessControl: 'BiometryCurrentSet',
        storage: 'KeystoreAESGCM',
        cloudSync: false,
        authenticationPrompt: prompt,
      },
    );
  });

  it('is read with the same access control and the prompt texts', async () => {
    const store = createDekStore();
    await store.writeBiometric(dek, prompt);
    expect(await store.readBiometric(prompt)).toEqual({ status: 'ok', dek });
    expect(mocked.getGenericPassword).toHaveBeenCalledWith({
      service: 'co.fynk.app.vault.key.biometric',
      accessControl: 'BiometryCurrentSet',
      authenticationPrompt: prompt,
    });
  });

  it('knows whether it exists without reading it, and removing keeps copy A', async () => {
    const store = createDekStore();
    await store.write(dek);
    expect(await store.hasBiometric()).toBe(false);
    await store.writeBiometric(dek, prompt);
    expect(await store.hasBiometric()).toBe(true);
    expect(mocked.getGenericPassword).not.toHaveBeenCalled();
    await store.removeBiometric();
    expect(await store.hasBiometric()).toBe(false);
    expect(await store.read()).toEqual(dek);
  });

  it('reports biometric hardware, and none when the query fails', async () => {
    expect(await createDekStore().biometricsAvailable()).toBe(true);
    mocked.getSupportedBiometryType.mockResolvedValueOnce(null);
    expect(await createDekStore().biometricsAvailable()).toBe(false);
    mocked.getSupportedBiometryType.mockRejectedValueOnce(new Error('x'));
    expect(await createDekStore().biometricsAvailable()).toBe(false);
  });

  it('reads a corrupt entry as invalidated, never as a key', async () => {
    await mocked.setGenericPassword('dek', btoa('short'), {
      service: DEK_BIOMETRIC_KEYCHAIN_SERVICE,
    });
    expect(await createDekStore().readBiometric(prompt)).toEqual({ status: 'invalidated' });
  });

  it('reads a vanished entry as invalidated (iOS drops it after an enrollment change)', async () => {
    expect(await createDekStore().readBiometric(prompt)).toEqual({ status: 'invalidated' });
  });

  it.each([
    [{ code: '-128', message: 'User canceled the operation.' }, 'cancelled'],
    [{ code: 'E_CRYPTO_FAILED', message: 'code: 13, msg: Cancel' }, 'cancelled'],
    [{ code: 'E_CRYPTO_FAILED', message: 'code: 10, msg: User canceled' }, 'cancelled'],
    [{ code: 'E_UNKNOWN_ERROR', message: 'Key permanently invalidated' }, 'invalidated'],
    [{ code: 'E_UNKNOWN_ERROR', message: 'KeyPermanentlyInvalidatedException' }, 'invalidated'],
    [{ code: '-25300', message: 'not found' }, 'invalidated'],
    [{ code: '-25293', message: 'locked out' }, 'failed'],
    [new Error('boom'), 'failed'],
  ])('classifies the read error %j as %s', async (error, status) => {
    mocked.getGenericPassword.mockRejectedValueOnce(error);
    expect(await createDekStore().readBiometric(prompt)).toEqual({ status });
  });

  it('write: cancel is cancelled, any other error fails without the payload', async () => {
    const store = createDekStore();
    mocked.setGenericPassword.mockRejectedValueOnce({ code: '-128', message: 'canceled' });
    expect(await store.writeBiometric(dek, prompt)).toBe('cancelled');
    mocked.setGenericPassword.mockRejectedValueOnce(new Error('secret-ish payload'));
    await expect(store.writeBiometric(dek, prompt)).rejects.toThrow('keychain write failed');
    mocked.setGenericPassword.mockResolvedValueOnce(false);
    await expect(store.writeBiometric(dek, prompt)).rejects.toThrow('keychain write failed');
  });
});
