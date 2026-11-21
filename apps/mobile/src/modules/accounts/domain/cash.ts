// The manual cash account (HU-054): one account, provider 'manual', kind 'cash', added to the
// balance total. Amounts are whole pesos typed by the person.
import type { Account, Id, IsoDateTime, MoneyMinor } from '@shared/domain/types';

export const CASH_BACKUP_COLLECTION = 'accounts.cash';

export class InvalidCashAmountError extends Error {
  constructor() {
    super('Cash must be zero or more whole centavos');
    this.name = 'InvalidCashAmountError';
  }
}

export function assertCashAmount(amountMinor: MoneyMinor): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new InvalidCashAmountError();
}

/** The cash account as every other module sees it. `lastSyncedAt` is when it was last set. */
export function cashAccount(id: Id, amountMinor: MoneyMinor, setAt: IsoDateTime): Account {
  return {
    id,
    provider: 'manual',
    providerAccountId: null,
    linkId: null,
    kind: 'cash',
    displayName: 'Efectivo',
    last4: null,
    currency: 'COP',
    balanceMinor: amountMinor,
    availableMinor: null,
    creditLimitMinor: null,
    paymentDueOn: null,
    status: 'active',
    isSimulated: false,
    lastSyncedAt: setAt,
    cdt: null,
  };
}

/** Backup records of accounts.cash: the account itself and every amount registered. */
export type CashBackupData =
  | { type: 'account'; amountMinor: MoneyMinor; setAt: IsoDateTime }
  | { type: 'history'; amountMinor: MoneyMinor; setAt: IsoDateTime };

const MAX_PESO_DIGITS = 12;

/** What the person typed (`600.000`, `600000`) → centavos, or null when empty. Digits only. */
export function parseCashInput(text: string): MoneyMinor | null {
  const digits = text
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, MAX_PESO_DIGITS);
  return digits ? Number(digits) * 100 : null;
}
