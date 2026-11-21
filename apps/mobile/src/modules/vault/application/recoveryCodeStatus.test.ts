// The status of the recovery code shown on onboarding's Listo (M3, SCRUM-69).
import { RECOVERY_KDF } from '../domain/recoveryKey';
import type { StoredRecoveryKey } from './ports';
import { createRecoveryCodeStatus } from './recoveryCodeStatus';

const stored: StoredRecoveryKey = {
  wrappedDek: new Uint8Array(48),
  nonce: new Uint8Array(24),
  salt: new Uint8Array(16),
  kdfParams: RECOVERY_KDF,
  createdAt: '2026-11-06T15:00:00Z',
};

const statusWith = (get: () => Promise<StoredRecoveryKey | null>, backupEnabled = true) =>
  createRecoveryCodeStatus({ backupEnabled: () => backupEnabled, recoveryKey: { get } });

describe('recoveryCodeStatus', () => {
  it('is saved when the server holds the recovery key', async () => {
    expect(await statusWith(async () => stored)()).toBe('saved');
  });

  it('is pending when the server has no recovery key', async () => {
    expect(await statusWith(async () => null)()).toBe('pending');
  });

  it('is unavailable when the server cannot be asked', async () => {
    const offline = statusWith(async () => {
      throw new Error('offline');
    });
    expect(await offline()).toBe('unavailable');
  });

  it('is unavailable without a backup, and does not call the server', async () => {
    const get = jest.fn(async () => stored);
    expect(await statusWith(get, false)()).toBe('unavailable');
    expect(get).not.toHaveBeenCalled();
  });
});
