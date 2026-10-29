// The app's lock controller, wired to the vault engine, the Keychain and identity.
// identity/index.ts imports this module (wipe), so identity is only called inside functions here,
// never while this file loads.
import { currentDevice, lastLoginAt, onSessionChange, reauthenticate } from '@modules/identity';

import { createLockController } from '../application/lockController';
import { newDek } from './crypto/newDek';
import { vault } from './defaultVault';
import { createDekStore } from './keychain/dekStore';

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
});
