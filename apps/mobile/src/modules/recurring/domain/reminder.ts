// When the reminder of a recurring item rings (SCRUM-57, HU-041): its next charge, a number of
// days before (2 by default, as chosen in Ajustes de notificaciones), at 9:00 Bogotá time.
// Pure: `now` comes from the caller's clock.
import type { IsoDate, IsoDateTime } from '@shared/domain/types';

import type { StoredRecurringItem } from './item';
import { nextCharge } from './schedule';

export type LeadDays = 0 | 1 | 2;

export interface ReminderPlan {
  /** Fixed expenses remind a payment, subscriptions their renewal. */
  kind: 'payment_due' | 'subscription_renewal';
  chargeDate: IsoDate;
  fireAt: IsoDateTime;
  leadDays: LeadDays;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// 9:00 in Bogotá is 14:00 UTC all year (Colombia has no daylight saving time).
const REMINDER_UTC_TIME = 'T14:00:00.000Z';
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
// A weekly item has a charge every 7 days, so a few steps always find one.
const MAX_STEPS = 8;

const addDays = (date: IsoDate, days: number): IsoDate =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const bogotaDate = (now: Date): IsoDate =>
  new Date(now.getTime() + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);

/**
 * The next reminder that is still ahead of `now`, or null when the item does not get one: its
 * reminder is off, it is cancelled, or it is charged every day (a daily reminder would only be
 * noise). When the reminder of the next charge already went by, it is the one of the charge after.
 */
export function reminderPlan(
  item: Pick<StoredRecurringItem, 'kind' | 'schedule' | 'status' | 'reminderEnabled'>,
  now: Date,
  leadDays: LeadDays,
): ReminderPlan | null {
  if (item.status !== 'active' || !item.reminderEnabled) return null;
  if (item.schedule.periodicity === 'daily') return null;
  const kind = item.kind === 'subscription' ? 'subscription_renewal' : 'payment_due';
  let from = bogotaDate(now);
  for (let step = 0; step < MAX_STEPS; step++) {
    const chargeDate = nextCharge(item.schedule, from);
    if (!chargeDate) return null;
    const fireAt = `${addDays(chargeDate, -leadDays)}${REMINDER_UTC_TIME}`;
    if (Date.parse(fireAt) > now.getTime()) return { kind, chargeDate, fireAt, leadDays };
    from = addDays(chargeDate, 1);
  }
  return null;
}
