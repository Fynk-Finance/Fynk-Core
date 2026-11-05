// Price increase of a subscription (SCRUM-61): compared with its previous charge, an alert when it
// rises by more than 5 % or $1.000, whichever is greater. Pure, integer centavos only.
import type { Id, MoneyMinor, Transaction } from '@shared/domain/types';

/** $1.000 in centavos. */
export const MIN_INCREASE_MINOR: MoneyMinor = 100_000;
export const MIN_INCREASE_PERCENT = 5;

export interface PriceIncrease {
  previousMinor: MoneyMinor;
  newMinor: MoneyMinor;
  /** "+$4.000 al mes": the difference of one charge. */
  differenceMinor: MoneyMinor;
}

/**
 * The increase from the previous charge to the new one, or null when it is not above the
 * threshold. 32.900 to 33.500 (+600) gives null; 32.900 to 36.900 gives +4.000.
 */
export function priceIncrease(
  previousMinor: MoneyMinor,
  newMinor: MoneyMinor,
): PriceIncrease | null {
  const difference = newMinor - previousMinor;
  // difference / previous > 5 % without leaving integers.
  const abovePercent = difference * 100 > previousMinor * MIN_INCREASE_PERCENT;
  const aboveAmount = difference > MIN_INCREASE_MINOR;
  if (!abovePercent || !aboveAmount) return null;
  return { previousMinor, newMinor, differenceMinor: difference };
}

/** A price increase found on one charge of a subscription. */
export interface ChargeIncrease extends PriceIncrease {
  transactionId: Id;
}

/**
 * Compares the newest charge with the one before it (both from `lastCharges`, newest first).
 * Only the newest charge can raise an alert, so an old increase is never noticed again.
 */
export function newestChargeIncrease(
  chargesNewestFirst: readonly Transaction[],
): ChargeIncrease | null {
  const [newest, previous] = chargesNewestFirst;
  if (!newest || !previous) return null;
  const increase = priceIncrease(-previous.amountMinor, -newest.amountMinor);
  return increase ? { ...increase, transactionId: newest.id } : null;
}
