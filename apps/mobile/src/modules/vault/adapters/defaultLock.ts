// The app's lock controller, wired to the vault engine, the Keychain and identity.
// identity/index.ts imports this module (wipe), so identity is only called inside functions here,
// never while this file loads.
import { getRandomBytes } from 'expo-crypto';

import {
  backupEnabled,
  currentDevice,
  deviceId,
  lastLoginAt,
  onSessionChange,
  reauthenticate,
} from '@modules/identity';

import { createLockController } from '../application/lockController';
import { createRecoveryCodeService } from '../application/recoveryCode';
import { createRecoveryKeyApi } from './api/recoveryKeyApi';
import { argon2Kdf } from './crypto/argon2Kdf';
import { newDek } from './crypto/newDek';
import { vaultStrings } from '../ui/strings.es-CO';
import { vault } from './defaultVault';
import { createDekStore } from './keychain/dekStore';

const recoveryKeyApi = createRecoveryKeyApi({ deviceId: () => deviceId() });

export const lockController = createLockController({
  vault,
  dekStore: createDekStore(),
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
});
