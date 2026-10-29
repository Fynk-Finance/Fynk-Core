// The recurring cards of the design's Billetera: periodicity, schedule and next charge labels.
import { chargeLabel, chargeState, scheduleLabel } from './card';
import { MON_TO_FRI, WEEKDAY } from './types';

describe('scheduleLabel', () => {
  it('writes the schedules of the design', () => {
    expect(scheduleLabel({ periodicity: 'monthly', anchorDay: 1 })).toBe('Día 1');
    expect(scheduleLabel({ periodicity: 'weekly', weekdaysMask: WEEKDAY.mon })).toBe('Cada lunes');
    expect(scheduleLabel({ periodicity: 'daily', weekdaysMask: MON_TO_FRI })).toBe('Lun a vie');
  });

  it('writes other schedules', () => {
    expect(scheduleLabel({ periodicity: 'daily', weekdaysMask: 127 })).toBe('Todos los días');
    expect(scheduleLabel({ periodicity: 'weekly', weekdaysMask: WEEKDAY.mon | WEEKDAY.thu })).toBe(
      'Lun y Jue',
    );
    expect(
      scheduleLabel({
        periodicity: 'daily',
        weekdaysMask: WEEKDAY.mon | WEEKDAY.wed | WEEKDAY.sun,
      }),
    ).toBe('Lun, Mié y Dom');
    expect(scheduleLabel({ periodicity: 'biweekly', anchorDate: '2026-10-16' })).toBe(
      'Cada 2 semanas',
    );
    expect(scheduleLabel({ periodicity: 'yearly', anchorDate: '2026-03-15' })).toBe(
      'Cada año · 15 mar',
    );
  });
});

describe('chargeState and chargeLabel', () => {
  const label = (s: Parameters<typeof chargeState>[0], today: string) =>
    chargeLabel(chargeState(s, today));

  it('says "Pagado" when this month\'s charge already passed', () => {
    expect(label({ periodicity: 'monthly', anchorDay: 1 }, '2026-10-24')).toBe('Pagado');
  });

  it('says "En 2 días", "Mañana" and "Hoy" when the charge is close', () => {
    expect(label({ periodicity: 'monthly', anchorDay: 26 }, '2026-10-24')).toBe('En 2 días');
    expect(label({ periodicity: 'monthly', anchorDay: 26 }, '2026-10-25')).toBe('Mañana');
    expect(label({ periodicity: 'monthly', anchorDay: 26 }, '2026-10-26')).toBe('Hoy');
    expect(label({ periodicity: 'daily', weekdaysMask: MON_TO_FRI }, '2026-10-28')).toBe('Hoy');
  });

  it('gives the weekday and day of a later charge, as "Lun 2"', () => {
    // Wednesday 28 Oct: the next Monday is 2 Nov.
    expect(label({ periodicity: 'weekly', weekdaysMask: WEEKDAY.mon }, '2026-10-28')).toBe('Lun 2');
    // A monthly item later this month is not paid yet.
    expect(label({ periodicity: 'monthly', anchorDay: 20 }, '2026-10-10')).toBe('Mar 20');
  });

  it('has no state for a weekly item without days', () => {
    expect(chargeState({ periodicity: 'weekly', weekdaysMask: 0 }, '2026-10-28')).toEqual({
      kind: 'none',
    });
  });
});
