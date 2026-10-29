// The app's vault instance, wired to op-sqlite, the Keychain and the app event bus.
import { appEvents } from '@shared/events/appEvents';

import { createVault } from '../application/vault';
import { createDekStore } from './keychain/dekStore';
import { createOpSqliteDriver } from './sqlite/opSqliteDriver';

export const vault = createVault({
  driver: createOpSqliteDriver(),
  dekStore: createDekStore(),
  events: appEvents,
  clock: { now: () => new Date() },
});
