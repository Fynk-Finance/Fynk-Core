// The app's vault instance, wired to op-sqlite, the Keychain and the app event bus.
import { appEvents } from '@shared/events/appEvents';

import { createVault } from '../application/vault';
import { currentSlot, removalSlot } from './defaultSlot';
import { createDekStore } from './keychain/dekStore';
import { createOpSqliteDriver } from './sqlite/opSqliteDriver';
import { vaultMigrations } from './vault/migrations';

export const vault = createVault({
  driver: createOpSqliteDriver(currentSlot, undefined, removalSlot),
  dekStore: createDekStore(currentSlot, removalSlot),
  events: appEvents,
  clock: { now: () => new Date() },
});

// The vault's own tables are registered once, where the vault is built.
vault.registerVaultMigrations('vault', vaultMigrations);
