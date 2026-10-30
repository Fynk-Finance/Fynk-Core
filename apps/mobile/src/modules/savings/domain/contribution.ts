// Contributions to a savings goal (SCRUM-52). Fynk never moves money: a contribution is a record
// of money the person already set aside, typed by hand or taken from a synced movement that
// left one of their accounts. Pure: today is a Bogotá date from the caller's clock.
import type { Id, IsoDate, IsoDateTime, MoneyMinor, Transaction } from '@shared/domain/types';

export interface ContributionInput {
  amountMinor: MoneyMinor;
  /** The day the money was set aside, in Bogotá. */
  contributedOn: IsoDate;
  note?: string;
}

export interface Contribution {
  id: Id;
  goalId: Id;
  amountMinor: MoneyMinor;
  contributedOn: IsoDate;
  source: 'manual' | 'movement';
  /** The linked movement of M7, for `source: 'movement'`. */
  transactionId: Id | null;
  note: string | null;
}

export type ContributionField = 'amount' | 'date' | 'note';
export type ContributionError =
  'amount_required' | 'amount_too_large' | 'date_invalid' | 'date_future' | 'note_too_long';

/** $1.000.000.000 in centavos, the same limit as a goal's target. */
export const CONTRIBUTION_MAX: MoneyMinor = 100_000_000_000;
export const NOTE_MAX = 80;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(date: string): boolean {
  if (!ISO_DATE.test(date)) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(date);
}

/** Field errors of a manual contribution, empty when it can be saved. */
export function validateContribution(
  input: ContributionInput,
  today: IsoDate,
): Partial<Record<ContributionField, ContributionError>> {
  const errors: Partial<Record<ContributionField, ContributionError>> = {};
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    errors.amount = 'amount_required';
  else if (input.amountMinor > CONTRIBUTION_MAX) errors.amount = 'amount_too_large';

  if (!validDate(input.contributedOn)) errors.date = 'date_invalid';
  else if (input.contributedOn > today) errors.date = 'date_future';

  if ((input.note ?? '').trim().length > NOTE_MAX) errors.note = 'note_too_long';
  return errors;
}

// America/Bogota is UTC-5 all year (Colombia has no daylight saving time).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

const bogotaDate = (at: IsoDateTime): IsoDate =>
  new Date(Date.parse(at) + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);

/**
 * The contribution a synced movement stands for: the money that left the account, on the day it
 * was booked in Bogotá. Null for money that came in, a pending movement, or one already linked
 * to a goal: only an outflow that is booked and free can be a contribution.
 */
export function contributionFromMovement(
  tx: Pick<Transaction, 'id' | 'amountMinor' | 'bookedAt' | 'status' | 'goalId'>,
): ContributionInput | null {
  if (tx.amountMinor >= 0 || tx.status !== 'booked' || tx.goalId !== null) return null;
  return { amountMinor: -tx.amountMinor, contributedOn: bogotaDate(tx.bookedAt) };
}
