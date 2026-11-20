import * as Keychain from 'react-native-keychain';

import {
  DEK_BIOMETRIC_KEYCHAIN_SERVICE,
  DEK_BIOMETRIC_OFFER_KEYCHAIN_SERVICE,
  DEK_KEYCHAIN_SERVICE,
  DEK_OWNER_KEYCHAIN_SERVICE,
} from './keychain/dekStore';
import { createLegacyVaultEraser } from './legacyVault';

jest.mock('react-native-keychain', () => {
  const entries = new Map<string, string>();
  return {
    hasGenericPassword: jest.fn(async (o: { service: string }) => entries.has(o.service)),
    setGenericPassword: jest.fn(async (_u: string, p: string, o: { service: string }) => {
      entries.set(o.service, p);
      return { service: o.service };
    }),
    resetGenericPassword: jest.fn(async (o: { service: string }) => entries.delete(o.service)),
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x' },
  };
});

const BASES = [
  DEK_KEYCHAIN_SERVICE,
  DEK_BIOMETRIC_KEYCHAIN_SERVICE,
  DEK_OWNER_KEYCHAIN_SERVICE,
  DEK_BIOMETRIC_OFFER_KEYCHAIN_SERVICE,
];

function fakeLibrary() {
  const db = { delete: jest.fn() };
  const open = jest.fn((_o: Record<string, unknown>) => db);
  return { db, open, load: async () => ({ open }) as never };
}

beforeEach(async () => {
  for (const service of [
    ...BASES,
    `${DEK_KEYCHAIN_SERVICE}.slot1`,
    'co.fynk.app.vault.legacyErased',
  ]) {
    await Keychain.resetGenericPassword({ service });
  }
  jest.clearAllMocks();
});

it('erases the unsuffixed vault file and Keychain entries, and never a slotted one', async () => {
  for (const service of [...BASES, `${DEK_KEYCHAIN_SERVICE}.slot1`]) {
    await Keychain.setGenericPassword('u', 'p', { service });
  }
  const { db, open, load } = fakeLibrary();
  await createLegacyVaultEraser(load)();
  expect(open).toHaveBeenCalledWith({ name: 'fynk-vault.db', failOnCreate: true });
  expect(db.delete).toHaveBeenCalledTimes(1);
  for (const service of BASES) expect(await Keychain.hasGenericPassword({ service })).toBe(false);
  expect(await Keychain.hasGenericPassword({ service: `${DEK_KEYCHAIN_SERVICE}.slot1` })).toBe(
    true,
  );
});

it('runs once: a second call, even from a new eraser, touches nothing', async () => {
  const { open, load } = fakeLibrary();
  await createLegacyVaultEraser(load)();
  jest.mocked(Keychain.resetGenericPassword).mockClear();
  open.mockClear();
  await createLegacyVaultEraser(load)();
  expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});

it('treats a missing legacy file as erased', async () => {
  const { open, load } = fakeLibrary();
  open.mockImplementationOnce(() => {
    throw new Error('unable to open database file');
  });
  await expect(createLegacyVaultEraser(load)()).resolves.toBeUndefined();
});

it('fails, and is not marked done, when a Keychain removal fails', async () => {
  const { load } = fakeLibrary();
  jest.mocked(Keychain.resetGenericPassword).mockRejectedValueOnce(new Error('keystore busy'));
  await expect(createLegacyVaultEraser(load)()).rejects.toThrow('keystore busy');
  expect(await Keychain.hasGenericPassword({ service: 'co.fynk.app.vault.legacyErased' })).toBe(
    false,
  );
});
