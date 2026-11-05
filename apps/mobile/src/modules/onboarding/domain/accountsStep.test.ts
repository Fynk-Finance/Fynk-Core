// Step 2 · Cuentas (SCRUM-69): the bank rows, the saved cash and "Total registrado".
import { account, cash, isConnected, savings, wallet } from '../testing/accounts';
import { cashToSave, linkedAccountRows, registeredTotal, savedCashMinor } from './accountsStep';

describe('linkedAccountRows', () => {
  it('lists the connected accounts of the design in M6 order, without the cash', () => {
    expect(linkedAccountRows([savings, wallet, cash], isConnected)).toEqual([
      {
        id: 'acc-ahorros',
        displayName: 'Banco Demo · Ahorros',
        kind: 'savings',
        balanceMinor: 320_000_000,
      },
      {
        id: 'acc-wallet',
        displayName: 'Billetera Demo',
        kind: 'wallet',
        balanceMinor: 460_000_000,
      },
    ]);
  });

  it('follows M6 on which accounts are connected', () => {
    const cdt = account({ id: 'acc-cdt', kind: 'cdt' });
    const card = account({ id: 'acc-card', kind: 'credit_card', balanceMinor: 50_000_000 });
    const rows = linkedAccountRows([savings, card, cdt], isConnected);
    expect(rows.map((r) => r.id)).toEqual(['acc-ahorros', 'acc-card']);
  });

  it('never lists cash, even if it were counted as connected', () => {
    expect(linkedAccountRows([cash], () => true)).toEqual([]);
  });
});

describe('savedCashMinor', () => {
  it('gives the registered cash', () => {
    expect(savedCashMinor([savings, cash])).toBe(60_000_000);
  });

  it('gives null before the person registers cash', () => {
    expect(savedCashMinor([savings, wallet])).toBeNull();
  });
});

describe('registeredTotal', () => {
  it('gives $8.400.000 for the design: 2 accounts and $600.000 in cash', () => {
    expect(registeredTotal(840_000_000, 60_000_000, 60_000_000)).toBe(840_000_000);
  });

  it('uses the typed cash in place of the saved one', () => {
    expect(registeredTotal(840_000_000, 60_000_000, 100_000_000)).toBe(880_000_000);
  });

  it('adds typed cash when none was saved, and drops the saved cash when the field is empty', () => {
    expect(registeredTotal(780_000_000, null, 60_000_000)).toBe(840_000_000);
    expect(registeredTotal(840_000_000, 60_000_000, null)).toBe(780_000_000);
  });
});

describe('cashToSave', () => {
  it('saves a new or changed amount, zero included', () => {
    expect(cashToSave(null, 60_000_000)).toBe(60_000_000);
    expect(cashToSave(60_000_000, 0)).toBe(0);
  });

  it('saves nothing when the field is empty or unchanged', () => {
    expect(cashToSave(null, null)).toBeNull();
    expect(cashToSave(60_000_000, null)).toBeNull();
    expect(cashToSave(60_000_000, 60_000_000)).toBeNull();
  });
});
