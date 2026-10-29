// Registering and updating cash (HU-054). Every change is marked dirty for the encrypted backup
// (collection accounts.cash) and tells the readers of the accounts to reload.
import type { Clock, Id, MoneyMinor } from '@shared/domain/types';
import type { BackupCollection, MarkDirty } from '@shared/ports';

import { assertCashAmount, CASH_BACKUP_COLLECTION, type CashBackupData } from '../domain/cash';
import type { Cash, CashStore } from './ports';

export interface CashServiceDeps {
  store: () => CashStore;
  clock: Clock;
  newId: () => Id;
  markDirty: MarkDirty;
  /** Called after every write, so the balance total and the lists reload. */
  onChanged: () => void;
}

export interface CashService {
  getCash(): Promise<Cash | null>;
  setCash(amountMinor: MoneyMinor): Promise<void>;
  /** The accounts.cash collection for M2's encrypted backup. */
  backupCollection: BackupCollection<CashBackupData>;
}

export function createCashService(deps: CashServiceDeps): CashService {
  return {
    getCash: () => deps.store().get(),

    async setCash(amountMinor) {
      assertCashAmount(amountMinor);
      const historyId = deps.newId();
      const accountId = await deps.store().set({
        newAccountId: deps.newId(),
        historyId,
        amountMinor,
        setAt: deps.clock.now().toISOString(),
      });
      deps.markDirty(CASH_BACKUP_COLLECTION, accountId);
      deps.markDirty(CASH_BACKUP_COLLECTION, historyId);
      deps.onChanged();
    },

    backupCollection: {
      module: 'accounts',
      collection: CASH_BACKUP_COLLECTION,
      exportAll: () => deps.store().exportAll(),
      async importAll(records) {
        await deps.store().importAll(records);
        deps.onChanged();
      },
    },
  };
}
