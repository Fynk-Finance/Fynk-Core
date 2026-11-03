// Movements for M7 tests. Builders on fixed data: same input, same output.
import type { Id, IsoDateTime, Transaction } from '@shared/domain/types';

export function bankTx(
  overrides: Partial<Transaction> & { id: Id; bookedAt: IsoDateTime },
): Transaction {
  return {
    accountId: 'acc-ahorros',
    providerTxId: `p-${overrides.id}`,
    source: 'bank',
    amountMinor: -1_843_000,
    description: 'SUPERMERCADO DEMO',
    merchantRaw: 'SUPERMERCADO DEMO',
    merchantKey: 'supermercado demo',
    categoryId: 'other',
    categorySource: 'rule',
    status: 'booked',
    goalId: null,
    ...overrides,
  };
}

/** `count` movements one hour apart going back from `newest`, ids tx-000, tx-001, ... */
export function hourlyTxs(count: number, newest: IsoDateTime, accountId = 'acc-ahorros') {
  const start = Date.parse(newest);
  return Array.from({ length: count }, (_, i) =>
    bankTx({
      id: `tx-${String(i).padStart(3, '0')}`,
      accountId,
      bookedAt: new Date(start - i * 3_600_000).toISOString(),
    }),
  );
}
