// The account and the last charges of a subscription (M9 prompt, Detalle de suscripción).
import type { Account, Transaction } from '@shared/domain/types';

import { LAST_CHARGES, chargedAccount, lastCharges } from './charges';

const charge = (id: string, day: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  accountId: 'acc-card',
  providerTxId: id,
  source: 'bank',
  bookedAt: `${day}T14:00:00Z`,
  amountMinor: -3_890_000,
  description: 'STREAMING VIDEO',
  merchantRaw: 'STREAMING VIDEO',
  merchantKey: 'streaming video',
  categoryId: 'subscriptions',
  categorySource: 'bank',
  status: 'booked',
  goalId: null,
  ...over,
});

describe('lastCharges', () => {
  const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const txs = [
    ...months.map((m, i) => charge(`t${i}`, `${m}-28`)),
    charge('other', '2026-10-01', { merchantKey: 'cafe' }),
    charge('refund', '2026-10-02', { amountMinor: 3_890_000 }),
    charge('pending', '2026-10-28', { status: 'pending' }),
  ];

  it('gives the last 6 booked charges of the merchant, newest first', () => {
    const list = lastCharges({ merchantKey: 'streaming video' }, txs);
    expect(LAST_CHARGES).toBe(6);
    expect(list.map((t) => t.id)).toEqual(['t6', 't5', 't4', 't3', 't2', 't1']);
  });

  it('gives none for an item typed by hand, which has no merchant', () => {
    expect(lastCharges({ merchantKey: null }, txs)).toEqual([]);
  });
});

describe('chargedAccount', () => {
  const card = { id: 'acc-card', kind: 'credit_card', last4: '4821' } as Account;

  it('finds the account of the item, or null', () => {
    expect(chargedAccount({ accountId: 'acc-card' }, [card])).toBe(card);
    expect(chargedAccount({ accountId: 'gone' }, [card])).toBeNull();
    expect(chargedAccount({ accountId: null }, [card])).toBeNull();
  });
});
