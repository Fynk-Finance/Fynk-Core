// Runs the service on a real SQLite vault (sql.js), so the store's SQL is tested too.
import { formatCop } from '@shared/domain/money';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { accountsMigrations } from '../adapters/vault/migrations';
import { createVaultAccountsStore } from '../adapters/vault/vaultAccountsStore';
import { InvalidSyncedAccountError } from '../domain/syncedAccounts';
import { card, cdt, savings, wallet } from '../testing/fixtures';
import { createAccountsService, type AccountsService } from './accountsService';

let vault: InMemoryVault;
let service: AccountsService;
const clock = createFixedClock('2026-10-28T15:00:00Z');

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('accounts', accountsMigrations);
  await vault.migrate();
  clock.set('2026-10-28T15:00:00Z');
  service = createAccountsService({ store: () => createVaultAccountsStore(vault.db), clock });
});

afterEach(() => vault.close());

describe('upsertFromSync (HU-012, HU-014)', () => {
  it('saves every account with its balance, entity and kind', async () => {
    await service.upsertFromSync([savings, wallet, card, cdt]);
    expect(await service.getAccounts()).toEqual([savings, wallet, card, cdt]);
  });

  it('never duplicates an account synced again, and keeps its first id', async () => {
    await service.upsertFromSync([savings]);
    await service.upsertFromSync([{ ...savings, id: 'new-id', balanceMinor: 330_000_000 }]);
    expect(await service.getAccounts()).toEqual([{ ...savings, balanceMinor: 330_000_000 }]);
  });

  it('stores only the last 4 digits', async () => {
    await service.upsertFromSync([{ ...card, last4: '4532015112833312' }]);
    const rows = await vault.db.query<{ last4: string }>('SELECT last4 FROM accounts_accounts');
    expect(rows).toEqual([{ last4: '3312' }]);
  });

  it('writes nothing when one account of the sync is malformed', async () => {
    await expect(
      service.upsertFromSync([savings, { ...wallet, balanceMinor: 0.5 }]),
    ).rejects.toThrow(InvalidSyncedAccountError);
    expect(await service.getAccounts()).toEqual([]);
  });

  it('tells the readers that the accounts changed', async () => {
    const listener = jest.fn();
    service.subscribe(listener);
    await service.upsertFromSync([savings]);
    await service.markLinkRevoked('link-banco-demo');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('totals', () => {
  it('gives the balance total and the connected accounts', async () => {
    await service.upsertFromSync([savings, wallet, card, cdt]);
    expect(formatCop(await service.getBalanceTotal())).toBe('$7.300.000');
    expect(await service.getConnectedAccountsSummary()).toEqual({
      count: 3,
      totalMinor: 730_000_000,
    });
    expect(await service.getOverview()).toEqual({
      accounts: [savings, wallet, card, cdt],
      balanceTotalMinor: 730_000_000,
      connectedCount: 3,
    });
  });

  it('drops a revoked link from the list, the total and the count', async () => {
    await service.upsertFromSync([savings, wallet, card]);
    await service.markLinkRevoked('link-banco-demo');
    expect(await service.getOverview()).toEqual({
      accounts: [wallet],
      balanceTotalMinor: 460_000_000,
      connectedCount: 1,
    });
  });

  it('brings the accounts back, with the same id, when the bank is linked again', async () => {
    await service.upsertFromSync([savings]);
    await service.markLinkRevoked('link-banco-demo');
    await service.upsertFromSync([{ ...savings, id: 'again', linkId: 'link-2' }]);
    expect(await service.getAccounts()).toEqual([{ ...savings, linkId: 'link-2' }]);
  });

  it('lists the CDTs for the Inversión tab', async () => {
    await service.upsertFromSync([savings, cdt]);
    expect(await service.getCdtAccounts()).toEqual([cdt]);
  });
});

describe('balance history (M15 chart)', () => {
  it('keeps one balance per account per day in Bogotá, the last sync wins', async () => {
    await service.upsertFromSync([savings, wallet]);
    await service.upsertFromSync([{ ...savings, balanceMinor: 310_000_000 }]);
    clock.set('2026-10-29T15:00:00Z');
    await service.upsertFromSync([{ ...savings, balanceMinor: 300_000_000 }]);

    expect(await service.getBalanceHistory(['acc-ahorros'], '2026-10-01')).toEqual([
      { accountId: 'acc-ahorros', onDate: '2026-10-28', balanceMinor: 310_000_000 },
      { accountId: 'acc-ahorros', onDate: '2026-10-29', balanceMinor: 300_000_000 },
    ]);
    expect(await service.getBalanceHistory(['acc-wallet'], '2026-10-29')).toEqual([]);
    expect(await service.getBalanceHistory([], '2026-10-01')).toEqual([]);
  });

  it('does not write a point for an account the bank closed', async () => {
    await service.upsertFromSync([{ ...card, status: 'closed' }]);
    expect(await service.getBalanceHistory(['acc-card'], '2026-01-01')).toEqual([]);
  });
});
