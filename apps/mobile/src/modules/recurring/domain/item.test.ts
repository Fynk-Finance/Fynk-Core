import {
  AMOUNT_MAX,
  NAME_MAX,
  isValidRecurring,
  validateRecurring,
  type RecurringInput,
} from './item';
import { MON_TO_FRI, WEEKDAY } from './types';

const rent: RecurringInput = {
  kind: 'fixed',
  name: 'Arriendo',
  amountMinor: 140_000_000,
  schedule: { periodicity: 'monthly', anchorDay: 1 },
  categoryId: 'rent',
};

describe('validateRecurring (SCRUM-54: nombre, tipo, monto, periodicidad y día de cobro)', () => {
  it('accepts the Billetera items of the design', () => {
    expect(validateRecurring(rent)).toEqual({});
    expect(
      isValidRecurring({
        ...rent,
        name: 'Gimnasio',
        schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon },
      }),
    ).toBe(true);
    expect(
      isValidRecurring({
        ...rent,
        name: 'Transporte',
        schedule: { periodicity: 'daily', weekdaysMask: MON_TO_FRI },
      }),
    ).toBe(true);
  });

  it('needs a name of at most 40 characters, spaces aside', () => {
    expect(validateRecurring({ ...rent, name: '   ' })).toEqual({ name: 'name_required' });
    expect(validateRecurring({ ...rent, name: 'x'.repeat(NAME_MAX + 1) })).toEqual({
      name: 'name_too_long',
    });
  });

  it('needs a positive whole amount in centavos, and rejects absurd ones', () => {
    expect(validateRecurring({ ...rent, amountMinor: 0 }).amount).toBe('amount_required');
    expect(validateRecurring({ ...rent, amountMinor: 12.5 }).amount).toBe('amount_required');
    expect(validateRecurring({ ...rent, amountMinor: AMOUNT_MAX + 1 }).amount).toBe(
      'amount_too_large',
    );
  });

  it('needs a charge day from 1 to 31 for monthly items', () => {
    expect(
      validateRecurring({ ...rent, schedule: { periodicity: 'monthly', anchorDay: 0 } }),
    ).toEqual({ schedule: 'day_invalid' });
    expect(
      validateRecurring({ ...rent, schedule: { periodicity: 'monthly', anchorDay: 31 } }),
    ).toEqual({});
  });

  it('needs at least one weekday for daily and weekly items', () => {
    expect(
      validateRecurring({ ...rent, schedule: { periodicity: 'weekly', weekdaysMask: 0 } }),
    ).toEqual({ schedule: 'weekdays_required' });
  });

  it('needs a real calendar date for biweekly and yearly items', () => {
    expect(
      validateRecurring({ ...rent, schedule: { periodicity: 'yearly', anchorDate: '2026-02-30' } }),
    ).toEqual({ schedule: 'date_invalid' });
    expect(
      validateRecurring({
        ...rent,
        schedule: { periodicity: 'biweekly', anchorDate: '2026-10-02' },
      }),
    ).toEqual({});
  });
});
