// Accounts of the OnbCuentas design for the onboarding tests: Banco Demo $3.200.000, Billetera
// Demo $4.600.000 and $600.000 in cash, $8.400.000 in all. Test-only: never import from app code.
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

export const savings = account();

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
});

/** M6's rule, copied for the tests only: the step receives the real one from @modules/accounts. */
export const isConnected = (a: Account): boolean =>
  a.status === 'active' && a.provider !== 'manual' && a.kind !== 'cash' && a.kind !== 'cdt';
