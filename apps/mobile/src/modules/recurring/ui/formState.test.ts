import { emptyForm, formFromItem, readForm, withPeriodicity } from './formState';
import type { StoredRecurringItem } from '../domain/item';
import { MON_TO_FRI, WEEKDAY } from '../domain/types';

const gym: StoredRecurringItem = {
  id: 'r1',
  kind: 'fixed',
  name: 'Gimnasio',
  amountMinor: 2_225_000,
  schedule: { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon },
  status: 'active',
  usage: null,
  categoryId: 'gym',
  accountId: null,
  merchantKey: null,
  source: 'manual',
  reminderEnabled: true,
  createdAt: '2026-10-28T15:00:00.000Z',
};

describe('readForm', () => {
  it('turns the typed rent into an input in centavos', () => {
    const read = readForm({
      ...emptyForm(),
      name: 'Arriendo',
      categoryId: 'rent',
      amount: '$1.400.000',
      day: '1',
    });
    expect(read).toEqual({
      ok: true,
      input: {
        kind: 'fixed',
        name: 'Arriendo',
        amountMinor: 140_000_000,
        schedule: { periodicity: 'monthly', anchorDay: 1 },
        categoryId: 'rent',
        reminderEnabled: true,
      },
    });
  });

  it('reports every missing field at once', () => {
    expect(readForm(emptyForm())).toEqual({
      ok: false,
      errors: { name: 'name_required', amount: 'amount_required', schedule: 'day_invalid' },
    });
  });

  it('rejects text that is not an amount and a day like "1a"', () => {
    const read = readForm({ ...emptyForm(), name: 'X', amount: 'mil', day: '1a' });
    expect(read.ok ? null : read.errors).toEqual({
      amount: 'amount_required',
      schedule: 'day_invalid',
    });
  });
});

describe('formFromItem', () => {
  it('fills the form to edit an item and reads back the same input', () => {
    const form = formFromItem(gym);
    expect(form).toMatchObject({ name: 'Gimnasio', amount: '$22.250', periodicity: 'weekly' });
    const read = readForm(form);
    expect(read.ok && read.input.schedule).toEqual(gym.schedule);
    expect(read.ok && read.input.amountMinor).toBe(gym.amountMinor);
  });
});

describe('withPeriodicity', () => {
  it('starts daily items on Monday to Friday and weekly ones on a single day', () => {
    const daily = withPeriodicity(emptyForm(), 'daily');
    expect(daily.weekdaysMask).toBe(MON_TO_FRI);
    expect(withPeriodicity(daily, 'weekly').weekdaysMask).toBe(WEEKDAY.mon);
  });
});
