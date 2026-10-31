// Ports of the accounts module. The vault adapter implements AccountsStore
// (adapters/vault/vaultAccountsStore.ts).
import type { Account, Id, IsoDate, IsoDateTime, MoneyMinor } from '@shared/domain/types';

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
