// Test helpers of the analytics module: build movements with readable amounts in pesos.
// Test-only: never import this file from app code.
import type { CategoryId, IsoDate, Transaction } from '@shared/domain';

let seq = 0;

export interface TxOptions {
  merchant?: string;
  accountId?: string;
  status?: Transaction['status'];
}

/** A movement booked at noon Bogotá time (17:00 UTC) on `date`. Pesos: negative is money out. */
export function tx(
  date: IsoDate,
  pesos: number,
  categoryId: CategoryId,
  opts: TxOptions = {},
): Transaction {
  seq += 1;
  const merchant = opts.merchant ?? `COMERCIO ${categoryId.toUpperCase()}`;
  return {
    id: `tx-${seq}`,
    accountId: opts.accountId ?? 'acc-1',
    providerTxId: `p-${seq}`,
    source: 'bank',
    bookedAt: `${date}T17:00:00Z`,
    amountMinor: Math.round(pesos * 100),
    description: merchant,
    merchantRaw: merchant,
    merchantKey: merchant.toLowerCase(),
    categoryId,
    categorySource: 'bank',
    status: opts.status ?? 'booked',
    goalId: null,
  };
}

/** Pesos to centavos, for readable expectations. */
export const cop = (pesos: number) => Math.round(pesos * 100);
