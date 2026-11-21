import { cop, tx } from '../testing/txFactory';
import { alertKey, capAlertsDue, capStatus, suggestedCapFor } from './caps';
import type { SpendingCap } from './types';

const weekly: SpendingCap = {
  id: 'cap-1',
  categoryId: 'restaurants',
  period: 'week',
  capMinor: cop(200_000),
  createdAt: '2026-10-01T00:00:00Z',
};
const monthly: SpendingCap = { ...weekly, id: 'cap-2', period: 'month', capMinor: cop(500_000) };

describe('capStatus (HU-043 gasto acumulado contra el tope)', () => {
  const txs = [
    tx('2026-10-25', -90_000, 'restaurants'), // Sunday of the previous week
    tx('2026-10-26', -100_000, 'restaurants'), // Monday
    tx('2026-10-28', -60_000, 'restaurants'),
    tx('2026-10-28', -999_000, 'groceries'), // another category
  ];

  it('adds the current week, Monday to Sunday in Bogotá', () => {
    expect(capStatus(weekly, txs, '2026-10-28')).toMatchObject({
      periodKey: 'week:2026-10-26',
      from: '2026-10-26',
      to: '2026-11-01',
      spentMinor: cop(160_000),
      percent: 80,
      state: 'warning',
    });
  });

  it('adds the calendar month', () => {
    expect(capStatus(monthly, txs, '2026-10-28')).toMatchObject({
      periodKey: 'month:2026-10',
      spentMinor: cop(250_000),
      percent: 50,
      state: 'ok',
    });
  });

  it('is reached at 100 %', () => {
    const more = [...txs, tx('2026-10-29', -40_000, 'restaurants')];
    expect(capStatus(weekly, more, '2026-10-29').state).toBe('reached');
  });

  it('suggests the previous period rounded up to the next $10.000', () => {
    expect(suggestedCapFor(txs, 'restaurants', 'week', '2026-10-28')).toBe(cop(90_000));
    expect(
      suggestedCapFor(
        [tx('2026-09-02', -141_000, 'restaurants')],
        'restaurants',
        'month',
        '2026-10-28',
      ),
    ).toBe(cop(150_000));
  });
});

describe('capAlertsDue (avisos al 80 % y al 100 %)', () => {
  const at = (spent: number, today = '2026-10-28') =>
    capStatus(weekly, [tx(today, -spent, 'restaurants')], today);

  it('fires the 80 % alert once', () => {
    const first = capAlertsDue([at(160_000)], new Set());
    expect(first.alerts.map((a) => a.level)).toEqual(['warning']);
    const sent = new Set(first.record.map((r) => alertKey(r.capId, r.periodKey, r.level)));
    expect(capAlertsDue([at(170_000)], sent).alerts).toEqual([]);
  });

  it('fires the 100 % alert once, after the 80 % one', () => {
    const sent = new Set([alertKey('cap-1', 'week:2026-10-26', 'warning')]);
    const due = capAlertsDue([at(200_000)], sent);
    expect(due.alerts.map((a) => a.level)).toEqual(['reached']);
    due.record.forEach((r) => sent.add(alertKey(r.capId, r.periodKey, r.level)));
    expect(capAlertsDue([at(250_000)], sent).alerts).toEqual([]);
  });

  it('sends only "reached" when the cap jumps past 100 %, and never a late 80 %', () => {
    const due = capAlertsDue([at(210_000)], new Set());
    expect(due.alerts.map((a) => a.level)).toEqual(['reached']);
    expect(due.record.map((r) => r.level).sort()).toEqual(['reached', 'warning']);
  });

  it('resets the next period', () => {
    const sent = new Set([
      alertKey('cap-1', 'week:2026-10-26', 'warning'),
      alertKey('cap-1', 'week:2026-10-26', 'reached'),
    ]);
    const nextWeek = at(160_000, '2026-11-03');
    expect(nextWeek.periodKey).toBe('week:2026-11-02');
    expect(capAlertsDue([nextWeek], sent).alerts.map((a) => a.level)).toEqual(['warning']);
  });
});
