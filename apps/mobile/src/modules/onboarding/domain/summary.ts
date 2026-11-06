// Listo (OnbListo, SCRUM-69): "Esto es lo que registraste". One row per part of the setup with
// its count and total. Every number comes from the module that owns it (M6, M8, M9, M2); this
// file only puts them in rows and decides which ones are still pending. Pure.
import type { MoneyMinor } from '@shared/domain/types';

/** M2's answer, "Guardado" or "Pendiente". `unavailable`: no backup, or no answer. */
export type RecoveryCodeState = 'saved' | 'pending' | 'unavailable';

export interface SummaryInput {
  /** M6's getConnectedAccountsSummary(): connected accounts (cash not counted), total with cash. */
  accounts: { count: number; totalMinor: MoneyMinor };
  /** M6's getCash(), or null when the person registered none. */
  cashMinor: MoneyMinor | null;
  /** M8: goals not reached yet, and getGoalsMonthlyTotal(). */
  goals: { count: number; monthlyMinor: MoneyMinor };
  /** M9's getRecurringSummary(). */
  recurring: { count: number; monthlyMinor: MoneyMinor };
  recoveryCode: RecoveryCodeState;
}

export type SummaryRow =
  /** Verified with a code at sign up (ADR 0007), so always done. */
  | { id: 'email'; done: true }
  /** "3 registradas" and the balance total, "2 metas" and their month, "4 pagos" and theirs. */
  | { id: 'accounts' | 'goals' | 'recurring'; done: boolean; count: number; totalMinor: MoneyMinor }
  | { id: 'recoveryCode'; done: boolean };

export type SummaryRowId = SummaryRow['id'];

/**
 * The rows of Listo, in the design's order, with "Código de recuperación" last (M3 prompt). A row
 * with nothing registered is pending, whether its step was skipped or finished empty. The
 * recovery code row is left out when M2 has no answer, rather than guessing.
 */
export function summaryRows(input: SummaryInput): SummaryRow[] {
  const withCash = (input.cashMinor ?? 0) > 0;
  const registered = input.accounts.count + (withCash ? 1 : 0);
  const rows: SummaryRow[] = [
    { id: 'email', done: true },
    {
      id: 'accounts',
      done: registered > 0,
      count: registered,
      totalMinor: input.accounts.totalMinor,
    },
    {
      id: 'goals',
      done: input.goals.count > 0,
      count: input.goals.count,
      totalMinor: input.goals.monthlyMinor,
    },
    {
      id: 'recurring',
      done: input.recurring.count > 0,
      count: input.recurring.count,
      totalMinor: input.recurring.monthlyMinor,
    },
  ];
  if (input.recoveryCode !== 'unavailable') {
    rows.push({ id: 'recoveryCode', done: input.recoveryCode === 'saved' });
  }
  return rows;
}
