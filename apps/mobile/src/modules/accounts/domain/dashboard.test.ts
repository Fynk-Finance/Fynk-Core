import type { Transaction } from '@shared/domain/types';

import { account, card, cash, cdt, savings, wallet } from '../testing/fixtures';
import { accountRows, entityOf, monthSummary } from './dashboard';
import { balanceTotal } from './netWorth';

describe('accountRows (Detalle de cuentas)', () => {
  const all = [cash, cdt, card, wallet, savings];

  it('lists accounts, wallets, cards and cash in display order, without CDTs (HU-014)', () => {
    expect(accountRows(all).map((r) => r.id)).toEqual([
      'acc-ahorros',
      'acc-wallet',
      'acc-card',
      'acc-cash',
    ]);
  });

  it('adds up to the balance total: a card counts as minus what is owed', () => {
    const rows = accountRows(all);
    expect(rows.find((r) => r.kind === 'credit_card')?.amountMinor).toBe(-50_000_000);
    expect(rows.reduce((sum, r) => sum + r.amountMinor, 0)).toBe(balanceTotal(all));
    expect(balanceTotal(all)).toBe(790_000_000); // $7.900.000
  });

  it('leaves out the accounts of a revoked link', () => {
    const revoked = account({ id: 'acc-rev', providerAccountId: 'x', status: 'revoked' });
    expect(accountRows([savings, revoked]).map((r) => r.id)).toEqual(['acc-ahorros']);
  });

  it('keeps only the last 4 digits and the Simulado flag', () => {
    expect(accountRows([savings])[0]).toMatchObject({ last4: '4821', isSimulated: true });
  });

  it('takes the entity from the display name', () => {
    expect(entityOf(savings)).toBe('Banco Demo');
    expect(entityOf(wallet)).toBe('Billetera Demo');
  });
});

describe('monthSummary (temporary, TODO(M10))', () => {
  const tx = (bookedAt: string, amountMinor: number, status: Transaction['status'] = 'booked') =>
    ({ id: bookedAt + amountMinor, bookedAt, amountMinor, status }) as Transaction;
  // 30 Oct 2026, 10:00 in Bogotá.
  const now = new Date('2026-10-30T15:00:00Z');

  it('adds income and spending of the current month in Bogotá', () => {
    expect(
      monthSummary(
        [
          tx('2026-10-25T14:00:00Z', 520_000_000),
          tx('2026-10-24T20:00:00Z', -28_640_000),
          tx('2026-10-01T04:59:00Z', -1_000_000), // 30 Sep, 23:59 in Bogotá
          tx('2026-11-01T04:00:00Z', -2_000_000), // 31 Oct, 23:00 in Bogotá
          tx('2026-10-20T12:00:00Z', -9_900_000, 'pending'),
        ],
        now,
      ),
    ).toEqual({ incomeMinor: 520_000_000, spendingMinor: 30_640_000 });
  });

  it('is zero without movements', () => {
    expect(monthSummary([], now)).toEqual({ incomeMinor: 0, spendingMinor: 0 });
  });
});
