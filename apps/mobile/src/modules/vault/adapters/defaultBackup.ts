// The app's backup engine, wired to the vault, the Keychain, the API and identity.
// identity/index.ts imports the vault (wipe), so identity is only called inside functions here,
// never while this file loads.
import { getRandomBytes } from 'expo-crypto';
import { appEvents } from '@shared/events/appEvents';

import { deviceId, userId } from '@modules/identity';

import { createBackupRegistry } from '../application/backupRegistry';
import { createBackupSync } from '../application/backupSync';
import { deriveBackupKey } from '../domain/crypto';
import { createBackupRecordsApi } from './api/backupRecordsApi';
import { watchBackgrounded } from './appStateBackup';
import { vault } from './defaultVault';
import { createDekStore } from './keychain/dekStore';

const dekStore = createDekStore();

export const backupRegistry = createBackupRegistry({
  getVaultDb: () => vault.getVaultDb(),
  events: appEvents,
});

export const backupSync = createBackupSync({
  registry: backupRegistry,
  api: createBackupRecordsApi(() => deviceId()),
  // Copy A of the DEK. The sync keeps the derived key only while the vault is unlocked.
  getBackupKey: async () => {
    const dek = await dekStore.read();
    return dek ? deriveBackupKey(dek) : null;
  },
  userId: () => userId(),
  randomBytes: getRandomBytes,
  events: appEvents,
  watchBackground: watchBackgrounded,
});

/** For the restore on a new phone (the DEK must already be in the Keychain). */
export const restoreAll = () => backupSync.restoreAll();
