// Cash on a real SQLite vault (sql.js) with the in-memory backup registry of M2's contract.
import { formatCop } from '@shared/domain/money';
import {
  createFixedClock,
  createInMemoryBackupRegistry,
  createInMemoryVault,
  type InMemoryBackupRegistry,
  type InMemoryVault,
} from '@shared/testing';

import { accountsMigrations } from '../adapters/vault/migrations';
import { createVaultAccountsStore } from '../adapters/vault/vaultAccountsStore';
import { createVaultCashStore } from '../adapters/vault/vaultCashStore';
import { cashAccount, InvalidCashAmountError } from '../domain/cash';
import { savings, wallet } from '../testing/fixtures';
import { createAccountsService, type AccountsService } from './accountsService';
import { createCashService, type CashService } from './cashService';

const clock = createFixedClock('2026-10-28T15:00:00Z');

// Each phone makes its own ids, like randomUUID does.
async function setup(idPrefix = 'id') {
  const vault = await createInMemoryVault();
  vault.registerMigrations('accounts', accountsMigrations);
  await vault.migrate();
  const backup = createInMemoryBackupRegistry();
  const accounts = createAccountsService({
    store: () => createVaultAccountsStore(vault.db),
    clock,
  });
  let n = 0;
  const cash = createCashService({
    store: () => createVaultCashStore(vault.db),
    clock,
    newId: () => `${idPrefix}-${++n}`,
    markDirty: backup.markDirty,
    onChanged: accounts.notifyChanged,
  });
  backup.registerBackupCollection(cash.backupCollection);
  return { vault, backup, accounts, cash };
}

let vault: InMemoryVault;
let backup: InMemoryBackupRegistry;
let accounts: AccountsService;
let cash: CashService;

beforeEach(async () => {
  clock.set('2026-10-28T15:00:00Z');
  ({ vault, backup, accounts, cash } = await setup());
});

afterEach(() => vault.close());

describe('setCash (HU-054)', () => {
  it('registers cash as "Efectivo", added to the balance total', async () => {
    await accounts.upsertFromSync([savings, wallet]);
    await cash.setCash(60_000_000);

    expect(formatCop(await accounts.getBalanceTotal())).toBe('$8.400.000');
    expect(await accounts.getAccounts()).toContainEqual(
      cashAccount('id-2', 60_000_000, '2026-10-28T15:00:00.000Z'),
    );
    // Cash is not a connected account.
    expect((await accounts.getConnectedAccountsSummary()).count).toBe(2);
  });

  it('updates the same account and keeps every amount in the history', async () => {
    await cash.setCash(60_000_000);
    clock.set('2026-10-29T15:00:00Z');
    await cash.setCash(45_000_000);

    expect(await cash.getCash()).toEqual({
      id: 'id-2',
      amountMinor: 45_000_000,
      setAt: '2026-10-29T15:00:00.000Z',
    });
    expect((await accounts.getAccounts()).filter((a) => a.kind === 'cash')).toHaveLength(1);
    const history = await vault.db.query('SELECT amount_minor FROM accounts_cash_history');
    expect(history).toEqual([{ amount_minor: 60_000_000 }, { amount_minor: 45_000_000 }]);
  });

  it('accepts zero and rejects negative or fractional amounts', async () => {
    await cash.setCash(0);
    expect((await cash.getCash())?.amountMinor).toBe(0);
    await expect(cash.setCash(-100)).rejects.toThrow(InvalidCashAmountError);
    await expect(cash.setCash(10.5)).rejects.toThrow(InvalidCashAmountError);
  });

  it('is null before the person registers cash', async () => {
    expect(await cash.getCash()).toBeNull();
  });

  it('tells the readers of the accounts to reload', async () => {
    const listener = jest.fn();
    accounts.subscribe(listener);
    await cash.setCash(1_000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('backup accounts.cash', () => {
  it('marks the account and the history entry dirty after every change', async () => {
    await cash.setCash(60_000_000);
    expect(backup.collections()).toEqual(['accounts.cash']);
    expect(backup.dirty('accounts.cash')).toEqual(['id-2', 'id-1']);
  });

  it('exports the account with a version that grows on every change', async () => {
    await cash.setCash(60_000_000);
    await cash.setCash(45_000_000);
    const { 'accounts.cash': records } = await backup.exportAll();
    expect(records).toEqual([
      {
        id: 'id-2',
        version: 2,
        deleted: false,
        data: { type: 'account', amountMinor: 45_000_000, setAt: '2026-10-28T15:00:00.000Z' },
      },
      expect.objectContaining({ id: 'id-1', data: expect.objectContaining({ type: 'history' }) }),
      expect.objectContaining({ id: 'id-3', data: expect.objectContaining({ type: 'history' }) }),
    ]);
  });

  it('restores the cash on a new phone, replacing an amount typed there first', async () => {
    await cash.setCash(60_000_000);
    const exported = await backup.exportAll();

    const phone = await setup('phone');
    await phone.cash.setCash(1_000);
    await phone.backup.importAll(exported);

    expect(await phone.cash.getCash()).toEqual({
      id: 'id-2',
      amountMinor: 60_000_000,
      setAt: '2026-10-28T15:00:00.000Z',
    });
    expect(await phone.accounts.getBalanceTotal()).toBe(60_000_000);
    phone.vault.close();
  });

  it('keeps a newer local version over an older backup', async () => {
    await cash.setCash(60_000_000);
    const old = await backup.exportAll();
    await cash.setCash(45_000_000);
    await backup.importAll(old);
    expect((await cash.getCash())?.amountMinor).toBe(45_000_000);
  });
});
