// The monthly income behind "23 % de tus ingresos va a tus metas" (design Metas, `#mt-stats`).
// Pure. M10 estimates it from the recurring income it finds (nómina and the like). When it has
// none yet, the income of the last full month is used: the current month may not have its
// payday yet and would show a share that is too high.
import type { IsoDate, MoneyMinor } from '@shared/domain/types';

export function monthlyIncome(
  recurringMonthly: readonly MoneyMinor[],
  lastFullMonthIncome: MoneyMinor | null,
): MoneyMinor | null {
  const recurring = recurringMonthly.reduce((sum, m) => sum + Math.max(0, m), 0);
  if (recurring > 0) return recurring;
  return lastFullMonthIncome && lastFullMonthIncome > 0 ? lastFullMonthIncome : null;
}

/** "2026-09" for a Bogotá day in October 2026. */
export function previousMonth(today: IsoDate): string {
  const [y, m] = today.split('-').map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
