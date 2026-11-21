import { account, card, cash, cdt, savings, wallet } from '../testing/fixtures';
import { accountRows, entityOf } from './dashboard';
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
