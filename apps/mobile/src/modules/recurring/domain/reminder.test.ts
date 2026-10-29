// SCRUM-57 (HU-041 Recordatorios): 2 days before by default, at 9:00 Bogotá time, moved to the
// last day when the charge day does not exist in the month, only for enabled active items.
import type { StoredRecurringItem } from './item';
import { reminderPlan } from './reminder';
import { MON_TO_FRI, WEEKDAY } from './types';

const item = (over: Partial<StoredRecurringItem> = {}): StoredRecurringItem => ({
  id: 'r1',
  kind: 'fixed',
  name: 'Servicios públicos',
  amountMinor: 18_600_000,
  schedule: { periodicity: 'monthly', anchorDay: 26 },
  status: 'active',
  usage: null,
  categoryId: 'utilities',
  accountId: null,
  merchantKey: null,
  source: 'manual',
  reminderEnabled: true,
  createdAt: '2026-10-01T15:00:00.000Z',
  ...over,
});

// Saturday 24 Oct 2026, 08:00 in Bogotá.
const now = new Date('2026-10-24T13:00:00Z');

describe('reminderPlan', () => {
  it('is 2 days before the charge at 9:00 Bogotá time (14:00 UTC)', () => {
    expect(reminderPlan(item(), now, 2)).toEqual({
      kind: 'payment_due',
      chargeDate: '2026-10-26',
      fireAt: '2026-10-24T14:00:00.000Z',
      leadDays: 2,
    });
  });

  it('follows the lead days chosen in Ajustes de notificaciones', () => {
    expect(reminderPlan(item(), now, 1)?.fireAt).toBe('2026-10-25T14:00:00.000Z');
    expect(reminderPlan(item(), now, 0)?.fireAt).toBe('2026-10-26T14:00:00.000Z');
  });

  it('moves a charge on the 31st to the 30th in a 30 day month', () => {
    const rent = item({ schedule: { periodicity: 'monthly', anchorDay: 31 } });
    expect(reminderPlan(rent, new Date('2026-11-10T15:00:00Z'), 2)).toMatchObject({
      chargeDate: '2026-11-30',
      fireAt: '2026-11-28T14:00:00.000Z',
    });
  });

  it('takes the next charge when the reminder of this one already passed', () => {
    // 10:00 on Saturday: the 9:00 reminder of Monday 26 already went by.
    const later = new Date('2026-10-24T15:00:00Z');
    expect(reminderPlan(item(), later, 2)).toMatchObject({
      chargeDate: '2026-11-26',
      fireAt: '2026-11-24T14:00:00.000Z',
    });
  });

  it('crosses the year', () => {
    const rent = item({ schedule: { periodicity: 'monthly', anchorDay: 1 } });
    expect(reminderPlan(rent, new Date('2026-12-15T15:00:00Z'), 2)).toMatchObject({
      chargeDate: '2027-01-01',
      fireAt: '2026-12-30T14:00:00.000Z',
    });
  });

  it('reminds a weekly charge before its weekday', () => {
    const gym = item({ schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon } });
    expect(reminderPlan(gym, new Date('2026-10-27T15:00:00Z'), 2)).toMatchObject({
      chargeDate: '2026-11-02',
      fireAt: '2026-10-31T14:00:00.000Z',
    });
  });

  it('a subscription gets a renewal notice', () => {
    const video = item({
      kind: 'subscription',
      name: 'Streaming de video',
      schedule: { periodicity: 'monthly', anchorDay: 28 },
    });
    expect(reminderPlan(video, now, 2)).toMatchObject({
      kind: 'subscription_renewal',
      chargeDate: '2026-10-28',
    });
  });

  it('nothing when the reminder is off, the item is cancelled or it is charged every day', () => {
    expect(reminderPlan(item({ reminderEnabled: false }), now, 2)).toBeNull();
    expect(reminderPlan(item({ status: 'cancelled' }), now, 2)).toBeNull();
    const bus = item({ schedule: { periodicity: 'daily', weekdaysMask: MON_TO_FRI } });
    expect(reminderPlan(bus, now, 2)).toBeNull();
  });
});
