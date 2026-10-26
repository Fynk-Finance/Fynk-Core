// Shared device domain types (docs/modules/00-shared-contracts.md, section 2). Owned by M0.
// Frozen after Gate A: changes need a pull request reviewed by every module that uses them.

export type Id = string;
export type IsoDate = string; // '2026-10-25'
export type IsoDateTime = string; // '2026-10-25T14:03:00Z'
export type MoneyMinor = number; // integer COP centavos

export type ProviderId = 'banco-demo' | 'billetera-demo' | 'bancolombia';
export type AccountKind = 'savings' | 'checking' | 'wallet' | 'credit_card' | 'cdt' | 'cash';

export interface Account {
  id: Id;
  provider: ProviderId | 'manual';
  providerAccountId: string | null;
  linkId: Id | null; // bank link that produced it, null for manual
  kind: AccountKind;
  displayName: string; // 'Banco Demo · Ahorros'
  last4: string | null; // only the last 4 digits are ever stored
  currency: 'COP';
  balanceMinor: MoneyMinor; // credit_card: amount owed (positive)
  availableMinor: MoneyMinor | null; // credit_card: available credit
  creditLimitMinor: MoneyMinor | null;
  paymentDueOn: IsoDate | null; // credit_card only
  status: 'active' | 'closed' | 'revoked';
  isSimulated: boolean;
  lastSyncedAt: IsoDateTime | null;
  cdt: CdtDetails | null;
}

export interface CdtDetails {
  rateEaBps: number; // effective annual rate in basis points, 1050 = 10,50 % E.A.
  termDays: number;
  openedOn: IsoDate;
  maturesOn: IsoDate;
}

export type CategoryId =
  | 'salary'
  | 'income_other'
  | 'rent'
  | 'utilities'
  | 'telecom'
  | 'groceries'
  | 'restaurants'
  | 'cinema'
  | 'treats'
  | 'transport'
  | 'subscriptions'
  | 'health'
  | 'education'
  | 'shopping'
  | 'gym'
  | 'transfers'
  | 'savings'
  | 'card_payment'
  | 'fees'
  | 'other';

export interface Transaction {
  id: Id;
  accountId: Id;
  providerTxId: string | null; // null for manual entries
  source: 'bank' | 'manual';
  bookedAt: IsoDateTime;
  amountMinor: MoneyMinor; // negative = money out, positive = money in
  description: string;
  merchantRaw: string | null;
  merchantKey: string | null; // output of shared normalizeMerchant()
  categoryId: CategoryId;
  categorySource: 'rule' | 'user' | 'bank';
  status: 'booked' | 'pending';
  goalId: Id | null; // set when the movement is a savings contribution
}

export interface Clock {
  now(): Date;
}

// The 14 mobile modules (apps/mobile/src/modules/<name>). Used by the vault and backup
// ports to namespace tables, migrations and backup collections.
export const MODULE_NAMES = [
  'identity',
  'vault',
  'onboarding',
  'consents',
  'bank',
  'accounts',
  'transactions',
  'savings',
  'recurring',
  'analytics',
  'recommendations',
  'notifications',
  'compliance',
  'investment',
] as const;

export type ModuleName = (typeof MODULE_NAMES)[number];
