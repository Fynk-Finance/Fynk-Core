// Manual movements (Nuevo movimiento manual): create, edit and delete, each one marked for the
// encrypted backup (transactions.manual) and announced with transactions.changed.
import type { Id, MoneyMinor, Transaction } from '@shared/domain/types';
import type { AppEvents } from '@shared/events/appEvents';
import type { BackupCollection, MarkDirty } from '@shared/ports';

import { categorize } from '../domain/categorize';
import { toManualTransaction, type ManualInput } from '../domain/manual';
import type { ManualStore, TransactionsStore } from './ports';
import { TransactionNotFoundError } from './transactionsService';

export const MANUAL_COLLECTION = 'transactions.manual';

export interface ManualServiceDeps {
  store: () => TransactionsStore;
  manual: () => ManualStore;
  events: Pick<AppEvents, 'emit'>;
  newId: () => Id;
  markDirty: MarkDirty;
  treatsThreshold: () => Promise<MoneyMinor>;
}

export interface ManualService {
  /** Throws InvalidManualTransactionError on bad input. */
  addManualTransaction(input: ManualInput): Promise<Transaction>;
  /** Only manual movements can be edited: TransactionNotFoundError for anything else. */
  updateManualTransaction(id: Id, input: ManualInput): Promise<Transaction>;
  deleteManualTransaction(id: Id): Promise<void>;
  /** Marks for the backup the manual ones among movements another use case changed. */
  markChanged(ids: Id[]): Promise<void>;
  backupCollection: BackupCollection<Transaction | null>;
}

export function createManualService(deps: ManualServiceDeps): ManualService {
  const build = async (id: Id, input: ManualInput, goalId: Id | null) => {
    const ctx = {
      txOverrides: new Map(),
      merchantOverrides: new Map(),
      treatsThresholdMinor: await deps.treatsThreshold(),
    };
    const tx = toManualTransaction(id, input, (t) =>
      categorize({ ...t, providerTxId: null, merchantKey: null, merchantRaw: null }, ctx),
    );
    return { ...tx, goalId };
  };

  const saved = async (tx: Transaction) => {
    await deps.manual().save(tx);
    deps.markDirty(MANUAL_COLLECTION, tx.id);
    deps.events.emit({ type: 'transactions.changed', ids: [tx.id] });
    return tx;
  };

  return {
    async addManualTransaction(input) {
      return saved(await build(deps.newId(), input, null));
    },

    async updateManualTransaction(id, input) {
      const current = await deps.store().get(id);
      if (!current || current.source !== 'manual') throw new TransactionNotFoundError();
      return saved(await build(id, input, current.goalId));
    },

    async deleteManualTransaction(id) {
      if (!(await deps.manual().delete(id))) throw new TransactionNotFoundError();
      deps.markDirty(MANUAL_COLLECTION, id);
      deps.events.emit({ type: 'transactions.changed', ids: [id] });
    },

    async markChanged(ids) {
      for (const id of await deps.manual().manualIds(ids)) deps.markDirty(MANUAL_COLLECTION, id);
    },

    backupCollection: {
      module: 'transactions',
      collection: MANUAL_COLLECTION,
      exportAll: () => deps.manual().exportAll(),
      importAll: (records) => deps.manual().importAll(records),
    },
  };
}
