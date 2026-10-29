// Ports of the accounts module. The vault adapter implements AccountsStore
// (adapters/vault/vaultAccountsStore.ts).
import type { Account, Id, IsoDate, IsoDateTime, MoneyMinor } from '@shared/domain/types';
import type { BackupRecord } from '@shared/ports';

import type { CashBackupData } from '../domain/cash';

export interface BalancePoint {
  accountId: Id;
  onDate: IsoDate;
  balanceMinor: MoneyMinor;
}

export interface AccountsStore {
  /** Every account, whatever its status. */
  list(): Promise<Account[]>;
  /**
   * Inserts or updates accounts by (provider, providerAccountId), keeping the id of a row that
   * already exists, and writes the balance of each one for `onDate`. One transaction.
   */
  saveSynced(accounts: Account[], at: { onDate: IsoDate; createdAt: IsoDateTime }): Promise<void>;
  /** Marks every account of a bank link as revoked. */
  revokeLink(linkId: Id): Promise<void>;
  /** Balance points of the given accounts from a day on, oldest first. */
  balanceHistory(accountIds: Id[], from: IsoDate): Promise<BalancePoint[]>;
}

export interface Cash {
  id: Id;
  amountMinor: MoneyMinor;
  setAt: IsoDateTime;
}

export interface CashStore {
  /** The active cash account, or null when the person never registered cash. */
  get(): Promise<Cash | null>;
  /**
   * Sets the amount, creating the account with `newAccountId` the first time, raises its backup
   * version and adds a history entry. One transaction. Returns the id of the cash account.
   */
  set(c: {
    newAccountId: Id;
    historyId: Id;
    amountMinor: MoneyMinor;
    setAt: IsoDateTime;
  }): Promise<Id>;
  exportAll(): Promise<BackupRecord<CashBackupData>[]>;
  /** Restores a backup: the highest version of the account wins, history entries are added. */
  importAll(records: BackupRecord<CashBackupData>[]): Promise<void>;
}
