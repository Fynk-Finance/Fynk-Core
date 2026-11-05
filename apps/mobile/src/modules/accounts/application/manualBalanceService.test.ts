// Manual movements of M7 change cash and disconnected accounts (team decision of 5 Nov 2026),
// on a real SQLite vault with the in-memory backup registry of M2's contract.
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
import { InsufficientCashError } from '../domain/manualBalance';
import { card, cdt, savings, wallet } from '../testing/fixtures';
import { createAccountsService, type AccountsService } from './accountsService';
import { createCashService, type CashService } from './cashService';
import { createManualBalanceService, type ManualBalanceService } from './manualBalanceService';

const clock = createFixedClock('2026-11-05T15:00:00Z');

let vault: InMemoryVault;
let backup: InMemoryBackupRegistry;
let accounts: AccountsService;
let cash: CashService;
let balances: ManualBalanceService;
let changed: jest.Mock;

beforeEach(async () => {
  vault = await createInMemoryVault();
  vault.registerMigrations('accounts', accountsMigrations);
  await vault.migrate();
  backup = createInMemoryBackupRegistry();
  const store = () => createVaultAccountsStore(vault.db);
  accounts = createAccountsService({ store, clock });
  changed = jest.fn();
  accounts.subscribe(changed);
  let n = 0;
  cash = createCashService({
    store: () => createVaultCashStore(vault.db),
    clock,
    newId: () => `id-${++n}`,
    markDirty: backup.markDirty,
    onChanged: accounts.notifyChanged,
  });
  backup.registerBackupCollection(cash.backupCollection);
  balances = createManualBalanceService({
    store,
    setCash: cash.setCash,
    onChanged: accounts.notifyChanged,
  });
  // Banco Demo ahorros and card are connected; Billetera Demo was disconnected.
  await accounts.upsertFromSync([savings, wallet, card, cdt]);
  await accounts.markLinkRevoked(wallet.linkId!);
  await cash.setCash(60_000_000);
  backup.clearDirty();
  changed.mockClear();
});

afterEach(() => vault.close());

const cashId = async () => (await cash.getCash())!.id;
const balanceOf = async (id: string) =>
  (
    await vault.db.query<{ balance_minor: number }>(
      'SELECT balance_minor FROM accounts_accounts WHERE id = ?',
      [id],
    )
  )[0]!.balance_minor;

describe('applyManualMovement on cash', () => {
  it('subtracts a Gasto from cash and from the balance total', async () => {
    const before = await accounts.getBalanceTotal();
    await balances.applyManualMovement({
      before: null,
      after: { accountId: await cashId(), amountMinor: -3_000_000 },
    });

    expect((await cash.getCash())?.amountMinor).toBe(57_000_000);
    expect(await accounts.getBalanceTotal()).toBe(before - 3_000_000);
    expect(changed).toHaveBeenCalled();
  });

  it('writes a cash history entry and marks cash for the encrypted backup', async () => {
    const id = await cashId();
    await balances.applyManualMovement({
      before: null,
      after: { accountId: id, amountMinor: 5_000_000 },
    });

    const history = await vault.db.query<{ amount_minor: number }>(
      'SELECT amount_minor FROM accounts_cash_history ORDER BY set_at, id',
    );
    expect(history.map((h) => h.amount_minor)).toEqual([60_000_000, 65_000_000]);
    expect(backup.dirty('accounts.cash')).toContain(id);
  });

  it('gives the amount back when the movement is deleted', async () => {
    const effect = { accountId: await cashId(), amountMinor: -3_000_000 };
    await balances.applyManualMovement({ before: null, after: effect });
    await balances.applyManualMovement({ before: effect, after: null });
    expect((await cash.getCash())?.amountMinor).toBe(60_000_000);
  });

  it('writes nothing when the Gasto is bigger than the cash', async () => {
    const run = balances.applyManualMovement({
      before: { accountId: wallet.id, amountMinor: -1_000_000 },
      after: { accountId: await cashId(), amountMinor: -70_000_000 },
    });

    await expect(run).rejects.toEqual(new InsufficientCashError(60_000_000));
    expect((await cash.getCash())?.amountMinor).toBe(60_000_000);
    expect(await balanceOf(wallet.id)).toBe(wallet.balanceMinor);
    expect(backup.dirty('accounts.cash')).toEqual([]);
  });
});

describe('applyManualMovement on bank accounts', () => {
  it('changes a disconnected account, which stays out of the total', async () => {
    const total = await accounts.getBalanceTotal();
    await balances.applyManualMovement({
      before: null,
      after: { accountId: wallet.id, amountMinor: -10_000_000 },
    });

    expect(await balanceOf(wallet.id)).toBe(wallet.balanceMinor - 10_000_000);
    expect(await accounts.getBalanceTotal()).toBe(total);
    expect(changed).toHaveBeenCalled();
  });

  it('never changes a connected account', async () => {
    await balances.applyManualMovement({
      before: null,
      after: { accountId: savings.id, amountMinor: -10_000_000 },
    });

    expect(await balanceOf(savings.id)).toBe(savings.balanceMinor);
    expect(changed).not.toHaveBeenCalled();
  });

  it('takes the bank balance again when the account is connected again', async () => {
    await balances.applyManualMovement({
      before: null,
      after: { accountId: wallet.id, amountMinor: -10_000_000 },
    });
    await accounts.upsertFromSync([{ ...wallet, balanceMinor: 455_000_000 }]);
    expect(await balanceOf(wallet.id)).toBe(455_000_000);
  });
});

describe('disconnected accounts in the overview', () => {
  it('lists disconnected bank accounts apart, without CDTs or cash', async () => {
    // Banco Demo's link has the savings account, the card and the CDT.
    await accounts.markLinkRevoked(savings.linkId!);
    const overview = await accounts.getOverview();

    expect(overview.disconnectedAccounts.map((a) => a.id)).toEqual([
      savings.id,
      wallet.id,
      card.id,
    ]);
    expect(overview.accounts.map((a) => a.kind)).toEqual(['cash']);
  });
});
