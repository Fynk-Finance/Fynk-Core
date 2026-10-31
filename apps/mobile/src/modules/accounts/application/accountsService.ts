// Use cases of the accounts module. M5 writes the accounts of a sync (upsertFromSync,
// markLinkRevoked); everyone else only reads.
import type { Account, Clock, Id, IsoDate, MoneyMinor } from '@shared/domain/types';

import {
  balanceTotal,
  connectedAccountsSummary,
  isActive,
  sortAccounts,
  type ConnectedAccountsSummary,
} from '../domain/netWorth';
import { bogotaDate, cleanSyncedAccounts } from '../domain/syncedAccounts';
import type { AccountsStore, BalancePoint } from './ports';

/** Everything the screens show at once, computed from a single read of the vault. */
export interface AccountsOverview {
  /** Active accounts, sorted for display. */
  accounts: Account[];
  balanceTotalMinor: MoneyMinor;
  connectedCount: number;
}

export const EMPTY_OVERVIEW: AccountsOverview = {
  accounts: [],
  balanceTotalMinor: 0,
  connectedCount: 0,
};

export interface AccountsServiceDeps {
  /** Called on every use: the vault can be locked and opened again while the app runs. */
  store: () => AccountsStore;
  clock: Clock;
}

export interface AccountsService {
  upsertFromSync(accounts: Account[]): Promise<void>;
  markLinkRevoked(linkId: Id): Promise<void>;
  getOverview(): Promise<AccountsOverview>;
  getAccounts(): Promise<Account[]>;
  getBalanceTotal(): Promise<MoneyMinor>;
  getConnectedAccountsSummary(): Promise<ConnectedAccountsSummary>;
  getCdtAccounts(): Promise<Account[]>;
  getBalanceHistory(accountIds: Id[], from: IsoDate): Promise<BalancePoint[]>;
  /** Tells the readers the data changed (after a write, a sync or an unlock). */
  notifyChanged(): void;
  /** Runs `listener` after every change. Returns a function that unsubscribes. */
  subscribe(listener: () => void): () => void;
}

export function createAccountsService(deps: AccountsServiceDeps): AccountsService {
  const listeners = new Set<() => void>();
  const notifyChanged = () => {
    for (const listener of [...listeners]) listener();
  };
  const all = () => deps.store().list();

  return {
    async upsertFromSync(accounts) {
      const clean = cleanSyncedAccounts(accounts);
      if (clean.length === 0) return;
      const now = deps.clock.now();
      await deps.store().saveSynced(clean, {
        onDate: bogotaDate(now),
        createdAt: now.toISOString(),
      });
      notifyChanged();
    },

    async markLinkRevoked(linkId) {
      await deps.store().revokeLink(linkId);
      notifyChanged();
    },

    async getOverview() {
      const accounts = await all();
      const { count, totalMinor } = connectedAccountsSummary(accounts);
      return {
        accounts: sortAccounts(accounts.filter(isActive)),
        balanceTotalMinor: totalMinor,
        connectedCount: count,
      };
    },

    async getAccounts() {
      return sortAccounts((await all()).filter(isActive));
    },

    async getBalanceTotal() {
      return balanceTotal(await all());
    },

    async getConnectedAccountsSummary() {
      return connectedAccountsSummary(await all());
    },

    async getCdtAccounts() {
      return sortAccounts((await all()).filter((a) => isActive(a) && a.kind === 'cdt'));
    },

    getBalanceHistory(accountIds, from) {
      return deps.store().balanceHistory(accountIds, from);
    },

    notifyChanged,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
