import { formatCop } from '@shared/domain/money';

import { account, card, cash, cdt, savings, wallet } from '../testing/fixtures';
import {
  balanceContribution,
  balanceTotal,
  connectedAccountsSummary,
  isConnected,
  sortAccounts,
} from './netWorth';

describe('balanceTotal (HU-014 total consolidado)', () => {
  it('adds Banco Demo ahorros, Billetera Demo and cash: $8.400.000', () => {
    expect(formatCop(balanceTotal([savings, wallet, cash]))).toBe('$8.400.000');
  });

  it('subtracts what is owed on a credit card: $7.900.000', () => {
    expect(formatCop(balanceTotal([savings, wallet, cash, card]))).toBe('$7.900.000');
  });

  it('does not count a CDT (sin datos de inversión)', () => {
    expect(balanceTotal([savings, wallet, cash, card, cdt])).toBe(
      balanceTotal([savings, wallet, cash, card]),
    );
    expect(balanceContribution(cdt)).toBe(0);
  });

  it('counts checking accounts like savings', () => {
    const checking = account({ id: 'c', kind: 'checking', balanceMinor: 1_000_000 });
    expect(balanceTotal([checking])).toBe(1_000_000);
  });

  it('ignores revoked and closed accounts', () => {
    const revoked = { ...wallet, status: 'revoked' as const };
    const closed = { ...card, status: 'closed' as const };
    expect(formatCop(balanceTotal([savings, revoked, closed, cash]))).toBe('$3.800.000');
  });

  it('is $0 with no accounts and can go below zero', () => {
    expect(balanceTotal([])).toBe(0);
    expect(balanceTotal([{ ...card, balanceMinor: 90_000_000 }])).toBe(-90_000_000);
  });

  it('gives the same result whatever the order (cálculos consistentes)', () => {
    const all = [savings, wallet, cash, card, cdt];
    expect(balanceTotal([...all].reverse())).toBe(balanceTotal(all));
  });
});

describe('connectedAccountsSummary ("N cuentas conectadas")', () => {
  it('counts bank accounts, cards and wallets, without cash and CDTs', () => {
    expect(connectedAccountsSummary([savings, wallet, cash, card, cdt])).toEqual({
      count: 3,
      totalMinor: 790_000_000,
    });
    expect(isConnected(cash)).toBe(false);
    expect(isConnected(cdt)).toBe(false);
  });

  it('drops the accounts of a revoked link from the count and the total', () => {
    const revokedWallet = { ...wallet, status: 'revoked' as const };
    expect(connectedAccountsSummary([savings, revokedWallet, cash])).toEqual({
      count: 1,
      totalMinor: 380_000_000,
    });
  });
});

describe('sortAccounts', () => {
  it('shows bank accounts, wallets, cards, CDTs and then cash', () => {
    expect(sortAccounts([cash, cdt, card, wallet, savings]).map((a) => a.kind)).toEqual([
      'savings',
      'wallet',
      'credit_card',
      'cdt',
      'cash',
    ]);
  });

  it('orders accounts of the same kind by name', () => {
    const b = account({ id: 'b', displayName: 'Bancolombia · Ahorros' });
    expect(sortAccounts([savings, b]).map((a) => a.id)).toEqual(['acc-ahorros', 'b']);
  });
});
