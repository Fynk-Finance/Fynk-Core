// Manual movements (Nuevo movimiento manual): cash or any account, money in or money out.
// They are records only: Fynk never moves money, and a manual movement never changes a bank or
// cash balance. Pure: the caller passes the id and the category pipeline.
import { isCategoryId } from '@shared/domain/categories';
import type { CategoryId, Id, IsoDateTime, MoneyMinor, Transaction } from '@shared/domain/types';

import { canonicalInstant } from './bogota';
import type { CategoryResult } from './categorize';

export interface ManualInput {
  accountId: Id;
  kind: 'income' | 'expense';
  /** Without sign, in centavos. */
  amountMinor: MoneyMinor;
  bookedAt: IsoDateTime;
  description: string;
  /** Missing: the categorization pipeline picks one from the description. */
  categoryId?: CategoryId;
}

export type ManualProblem = 'account' | 'amount' | 'date' | 'description' | 'category';

export const MAX_DESCRIPTION = 80;

export class InvalidManualTransactionError extends Error {
  constructor(readonly problems: ManualProblem[]) {
    super(`Invalid manual movement: ${problems.join(', ')}`);
    this.name = 'InvalidManualTransactionError';
  }
}

export function manualProblems(input: ManualInput): ManualProblem[] {
  const problems: ManualProblem[] = [];
  if (!input.accountId) problems.push('account');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) problems.push('amount');
  if (Number.isNaN(Date.parse(input.bookedAt))) problems.push('date');
  const description = input.description.trim();
  if (description.length === 0 || description.length > MAX_DESCRIPTION) {
    problems.push('description');
  }
  if (input.categoryId !== undefined && !isCategoryId(input.categoryId)) problems.push('category');
  return problems;
}

/** The movement to save. Throws InvalidManualTransactionError on bad input. */
export function toManualTransaction(
  id: Id,
  input: ManualInput,
  categorize: (tx: Pick<Transaction, 'description' | 'amountMinor'>) => CategoryResult,
): Transaction {
  const problems = manualProblems(input);
  if (problems.length > 0) throw new InvalidManualTransactionError(problems);
  const amountMinor = input.kind === 'income' ? input.amountMinor : -input.amountMinor;
  const description = input.description.trim();
  const category: CategoryResult = input.categoryId
    ? { categoryId: input.categoryId, categorySource: 'user' }
    : categorize({ description, amountMinor });
  return {
    id,
    accountId: input.accountId,
    providerTxId: null,
    source: 'manual',
    bookedAt: canonicalInstant(input.bookedAt),
    amountMinor,
    description,
    merchantRaw: null,
    merchantKey: null,
    categoryId: category.categoryId,
    categorySource: category.categorySource,
    status: 'booked',
    goalId: null,
  };
}
