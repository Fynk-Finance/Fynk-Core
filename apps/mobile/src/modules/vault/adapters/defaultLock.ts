// The app's lock controller, wired to the vault engine, the Keychain and identity.
// identity/index.ts imports this module (wipe), so identity is only called inside functions here,
// never while this file loads.
import { getRandomBytes } from 'expo-crypto';

import {
  backupEnabled,
  currentDevice,
  deviceId,
  devicePublicKey,
  deviceSharedSecret,
  lastLoginAt,
  onSessionChange,
  reauthenticate,
} from '@modules/identity';

import { createCompleteRestore } from '../application/completeRestore';
import { createLockController } from '../application/lockController';
import { createRecoveryCodeService } from '../application/recoveryCode';
import { createResetBackup } from '../application/resetBackup';
import { createRestoreState } from '../application/restoreState';
import { createRestoreWithApproval } from '../application/restoreWithApproval';
import { createRestoreWithCode } from '../application/restoreWithCode';
import { createBackupResetApi } from './api/backupResetApi';
import { createRecoveryKeyApi } from './api/recoveryKeyApi';
import { argon2Kdf } from './crypto/argon2Kdf';
import { newDek } from './crypto/newDek';
import { vaultStrings } from '../ui/strings.es-CO';
import { restoreAll } from './defaultBackup';
import { deviceApprovalsApi } from './defaultApproval';
import { vault } from './defaultVault';
import { createDekStore } from './keychain/dekStore';

const recoveryKeyApi = createRecoveryKeyApi({ deviceId: () => deviceId() });
const dekStore = createDekStore();
const restoreState = createRestoreState(() => vault.getVaultDb());

export const lockController = createLockController({
  vault,
  dekStore,
  newDek: () => newDek(),
  identity: {
    lastLoginAt: () => lastLoginAt(),
    reauthenticate: () => reauthenticate(),
    currentDevice: () => currentDevice(),
    onSessionChange: (listener) => onSessionChange(listener),
  },
  clock: { now: () => new Date() },
  nowMs: () => Date.now(),
  biometricPrompt: vaultStrings.biometric.prompt,
  backupEnabled: () => backupEnabled(),
  recoveryKey: recoveryKeyApi,
  // The code and the key made from it never leave this process; only the wrapped DEK is sent.
  recoveryCode: createRecoveryCodeService({
    random: (n) => getRandomBytes(n),
    kdf: argon2Kdf,
    api: recoveryKeyApi,
  }),
  // A new phone: the code opens the DEK, the server activates the phone, then the records come.
  restoreWithCode: createRestoreWithCode({
    recoveryKey: recoveryKeyApi,
    kdf: argon2Kdf,
    dekStore,
    vault,
    restoreState,
    restoreAll,
  }),
  // A new phone: the old phone seals the DEK for this phone's key, then the same restore steps.
  restoreWithApproval: createRestoreWithApproval({
    api: deviceApprovalsApi,
    randomBytes: (n) => getRandomBytes(n),
    devicePublicKey: () => devicePublicKey(),
    deviceSharedSecret: (peer) => deviceSharedSecret(peer),
    completeRestore: createCompleteRestore({ dekStore, vault, restoreState, restoreAll }),
  }),
  // No other phone and no code: the server deletes the backup after an email code reset.
  resetBackup: createResetBackup({ api: createBackupResetApi({ deviceId: () => deviceId() }) }),
});
