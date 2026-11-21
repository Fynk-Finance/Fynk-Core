// Spending caps (HU-043). A cap is weekly (Monday to Sunday in Bogotá) or for the calendar month.
// Alerts fire once per cap, period and level, at 80 % and at 100 %.
import type { CategoryId, IsoDate, MoneyMinor, Transaction } from '@shared/domain';

import { addDays, addMonths, monthOf, weekStart, type DateRange } from './dates';
import { CAP_ROUNDING_MINOR, roundUpTo } from './opportunities';
import { monthRange, spendingIn } from './spending';
import type { CapPeriod, CapState, CapStatus, SpendingCap } from './types';

export const CAP_WARNING_PERCENT = 80;
export const CAP_REACHED_PERCENT = 100;
/** "Antojos" groups purchases under this amount: $20.000 by default. */
export const DEFAULT_TREATS_THRESHOLD_MINOR = 2_000_000;

export function capPeriodRange(period: CapPeriod, today: IsoDate): DateRange & { key: string } {
  if (period === 'week') {
    const from = weekStart(today);
    return { key: `week:${from}`, from, to: addDays(from, 6) };
  }
  const month = monthOf(today);
  return { key: `month:${month}`, ...monthRange(month) };
}

function previousPeriodRange(period: CapPeriod, today: IsoDate): DateRange {
  if (period === 'week') {
    const from = addDays(weekStart(today), -7);
    return { from, to: addDays(from, 6) };
  }
  return monthRange(addMonths(monthOf(today), -1));
}

export function capState(percent: number): CapState {
  if (percent >= CAP_REACHED_PERCENT) return 'reached';
  if (percent >= CAP_WARNING_PERCENT) return 'warning';
  return 'ok';
}

/** Spent so far in the current period of the cap, against the cap. */
export function capStatus(
  cap: SpendingCap,
  txs: readonly Transaction[],
  today: IsoDate,
): CapStatus {
  const range = capPeriodRange(cap.period, today);
  const spentMinor = spendingIn(txs, range, cap.categoryId);
  const percent = cap.capMinor > 0 ? Math.floor((spentMinor * 100) / cap.capMinor) : 0;
  return {
    cap,
    periodKey: range.key,
    from: range.from,
    to: range.to,
    spentMinor,
    percent,
    state: capState(percent),
  };
}

/**
 * Amount prefilled in the cap form: what the category cost in the previous period, rounded up to
 * the next $10.000.
 */
export function suggestedCapFor(
  txs: readonly Transaction[],
  categoryId: CategoryId,
  period: CapPeriod,
  today: IsoDate,
): MoneyMinor {
  return roundUpTo(
    spendingIn(txs, previousPeriodRange(period, today), categoryId),
    CAP_ROUNDING_MINOR,
  );
}

export type CapAlertLevel = 'warning' | 'reached';

export interface CapAlert {
  capId: string;
  periodKey: string;
  level: CapAlertLevel;
  status: CapStatus;
}

export function alertKey(capId: string, periodKey: string, level: CapAlertLevel): string {
  return `${capId}|${periodKey}|${level}`;
}

/**
 * Alerts to send now. A cap that jumps past 100 % sends only the "reached" alert, and its 80 %
 * alert is recorded too, so it never arrives late. `sent` holds alertKey() of alerts already sent.
 * Returns the alerts to show and every key to record.
 */
export function capAlertsDue(
  statuses: readonly CapStatus[],
  sent: ReadonlySet<string>,
): { alerts: CapAlert[]; record: { capId: string; periodKey: string; level: CapAlertLevel }[] } {
  const alerts: CapAlert[] = [];
  const record: { capId: string; periodKey: string; level: CapAlertLevel }[] = [];
  for (const status of statuses) {
    if (status.state === 'ok') continue;
    const capId = status.cap.id;
    const { periodKey } = status;
    const warningSent = sent.has(alertKey(capId, periodKey, 'warning'));
    const reachedSent = sent.has(alertKey(capId, periodKey, 'reached'));
    if (status.state === 'reached') {
      if (reachedSent) continue;
      alerts.push({ capId, periodKey, level: 'reached', status });
      record.push({ capId, periodKey, level: 'reached' });
      if (!warningSent) record.push({ capId, periodKey, level: 'warning' });
    } else if (!warningSent && !reachedSent) {
      alerts.push({ capId, periodKey, level: 'warning', status });
      record.push({ capId, periodKey, level: 'warning' });
    }
  }
  return { alerts, record };
}
