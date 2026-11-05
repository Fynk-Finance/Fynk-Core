// What the Dashboard card and Detalle de cuentas show (HU-012, HU-014). Pure functions.
import type { Account, AccountKind, Id, MoneyMinor } from '@shared/domain/types';

import { balanceContribution, isActive, sortAccounts } from './netWorth';

export interface AccountRow {
  id: Id;
  /** The bank or wallet: "Banco Demo" from "Banco Demo · Ahorros". */
  entity: string;
  kind: AccountKind;
  last4: string | null;
  /** What the account adds to the balance total, so the rows add up to it (cards are negative). */
  amountMinor: MoneyMinor;
  isSimulated: boolean;
}

export const entityOf = (a: Account): string => a.displayName.split(' · ')[0]!.trim();

/** The rows of Detalle de cuentas: every account in the total, in display order. No CDTs. */
export function accountRows(accounts: readonly Account[]): AccountRow[] {
  return sortAccounts(accounts.filter((a) => isActive(a) && a.kind !== 'cdt')).map((a) => ({
    id: a.id,
    entity: entityOf(a),
    kind: a.kind,
    last4: a.last4,
    amountMinor: balanceContribution(a),
    isSimulated: a.isSimulated,
  }));
}

/** Ingresos and Gastos of the current month on the Dashboard card, from M10. */
export interface MonthSummary {
  incomeMinor: MoneyMinor;
  spendingMinor: MoneyMinor;
}
