// Accounts for tests, with the numbers of the design (00-shared-contracts.md, section 7).
// Test-only: never import this file from app code.
import type { Account } from '@shared/domain/types';

const base: Account = {
  id: 'acc-ahorros',
  provider: 'banco-demo',
  providerAccountId: 'acc-ahorros-4bd7d0e5',
  linkId: 'link-banco-demo',
  kind: 'savings',
  displayName: 'Banco Demo · Ahorros',
  last4: '4821',
  currency: 'COP',
  balanceMinor: 320_000_000,
  availableMinor: 320_000_000,
  creditLimitMinor: null,
  paymentDueOn: null,
  status: 'active',
  isSimulated: true,
  lastSyncedAt: '2026-10-27T12:00:00Z',
  cdt: null,
};

export const account = (overrides: Partial<Account> = {}): Account => ({ ...base, ...overrides });

/** Banco Demo ahorros $3.200.000. */
export const savings = account();

/** Billetera Demo $4.600.000. */
export const wallet = account({
  id: 'acc-wallet',
  provider: 'billetera-demo',
  providerAccountId: 'acc-wallet-4bd7d0e5',
  linkId: 'link-billetera-demo',
  kind: 'wallet',
  displayName: 'Billetera Demo',
  last4: '9104',
  balanceMinor: 460_000_000,
  availableMinor: 460_000_000,
});

/** Efectivo $600.000, registered by hand. */
export const cash = account({
  id: 'acc-cash',
  provider: 'manual',
  providerAccountId: null,
  linkId: null,
  kind: 'cash',
  displayName: 'Efectivo',
  last4: null,
  balanceMinor: 60_000_000,
  availableMinor: null,
  isSimulated: false,
  lastSyncedAt: null,
});

/** Banco Demo credit card owing $500.000 of a $5.000.000 limit. */
export const card = account({
  id: 'acc-card',
  providerAccountId: 'acc-card-4bd7d0e5',
  kind: 'credit_card',
  displayName: 'Banco Demo · Tarjeta de crédito',
  last4: '3312',
  balanceMinor: 50_000_000,
  availableMinor: 450_000_000,
  creditLimitMinor: 500_000_000,
  paymentDueOn: '2026-11-05',
});

/** Banco Demo CDT $2.000.000 at 10,50 % E.A. */
export const cdt = account({
  id: 'acc-cdt',
  providerAccountId: 'acc-cdt-4bd7d0e5',
  kind: 'cdt',
  displayName: 'Banco Demo · CDT',
  last4: '7701',
  balanceMinor: 200_000_000,
  availableMinor: null,
  cdt: { rateEaBps: 1050, termDays: 180, openedOn: '2026-08-27', maturesOn: '2027-02-27' },
});
