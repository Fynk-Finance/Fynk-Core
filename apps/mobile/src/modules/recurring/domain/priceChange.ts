// Price increase of a subscription (SCRUM-61): compared with its previous charge, an alert when it
// rises by more than 5 % or $1.000, whichever is greater. Pure, integer centavos only.
import type { MoneyMinor } from '@shared/domain/types';

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
