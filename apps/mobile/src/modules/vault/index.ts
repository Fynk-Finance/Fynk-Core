// Public API of the vault module. Other modules import only from this file.
import type { ModuleRoutes } from '@shared/navigation';
import type { MarkDirty, RegisterBackupCollection } from '@shared/ports/backup';
import type { GetVaultDb, RegisterVaultMigrations } from '@shared/ports/vault';

import { useSession } from '@modules/identity';

import { watchAppState } from './adapters/appStateLock';
import { approveDevice, startApprovalNotifier } from './adapters/defaultApproval';
import { backupRegistry, backupSync } from './adapters/defaultBackup';
import { lockController } from './adapters/defaultLock';
import { copyText } from './adapters/clipboard';
import { vault } from './adapters/defaultVault';
import { createNewRecoveryCodeScreen } from './ui/NewRecoveryCodeScreen';
import { RECOVERY_CODE_ROUTE, RecoveryCodeRow } from './ui/RecoveryCodeRow';
import { createApproveDeviceScreen } from './ui/ApproveDeviceScreen';
import { createUnlockSetting } from './ui/UnlockSetting';
import { createVaultFlow } from './ui/VaultFlow';
import { createUseVaultGate } from './ui/useVaultGate';

// identity/index.ts imports this file (wipe) and this file imports identity. The cycle works
// because identity is only called inside functions, hooks and effects, never while loading.

// Route name of identity's Seguridad screen. A literal, because identity is still loading when
// this file loads (import cycle), so a constant imported from it could be undefined here.
const SECURITY_ROUTE = 'identity.Security';

const ApproveDeviceScreen = createApproveDeviceScreen({
  service: approveDevice,
  clock: { now: () => new Date() },
  securityRoute: SECURITY_ROUTE,
});

export const routes: ModuleRoutes = {
  module: 'vault',
  // Lock screen and the recovery code of a new account, shown with a fade and no back gesture
  // (flow change).
  flow: createVaultFlow(lockController, { copyText }),
  // Open while there is a session and the vault is not unlocked.
  useGate: createUseVaultGate({
    controller: lockController,
    useSession: () => useSession(),
    watchAppState,
  }),
  screens: [
    {
      // "Generar un código nuevo", pushed from Seguridad with the default transition.
      name: RECOVERY_CODE_ROUTE,
      component: createNewRecoveryCodeScreen({ controller: lockController, copyText }),
      path: 'boveda/recuperacion',
    },
    {
      // Old phone: approve a new device (HU-046). Pushed with the default transition.
      name: 'vault.ApproveDevice',
      component: ApproveDeviceScreen,
      path: 'boveda/aprobar',
      transition: 'push',
    },
  ],
};

// The in-app notice for a new device waiting for approval; it only runs while the app is open.
startApprovalNotifier();

export const registerVaultMigrations: RegisterVaultMigrations = (module, migrations) =>
  vault.registerVaultMigrations(module, migrations);

export const getVaultDb: GetVaultDb = () => vault.getVaultDb();

/** M2's backup port: modules register their collections once, at load. */
export const registerBackupCollection: RegisterBackupCollection = (c) =>
  backupRegistry.registerBackupCollection(c);

/** Call after every local write of a registered collection. Uploads 5 s later, app open only. */
export const markDirty: MarkDirty = (collection, id) => backupRegistry.markDirty(collection, id);

/** Every registered collection's records, for M13's data export. Bank data is not included. */
export const exportAll = () => backupSync.exportAll();

/**
 * Erases the vault: closes it, deletes the file and both copies of the key.
 * M1 calls it when this device was removed from the account. Safe when nothing was ever created.
 */
export const wipe = async (): Promise<void> => {
  try {
    // First, so no upload starts while the vault is being erased.
    backupSync.reset();
    await vault.wipe();
  } finally {
    backupSync.reset();
    lockController.reset();
  }
};

/** M2's "Desbloqueo" card on M1's Seguridad screen: the Face ID or fingerprint switch. */
export const UnlockSetting = createUnlockSetting(lockController);

/** M2's "Código de recuperación" section on M1's Seguridad screen: "Generar un código nuevo". */
export { RecoveryCodeRow };
