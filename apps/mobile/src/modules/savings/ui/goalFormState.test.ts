// SCRUM-51: the goal form of OnbMetas as pure state: typed values to a GoalInput, the errors, the
// month stepper and the live suggested monthly amount.
import { formatCop } from '@shared/domain/money';

import {
  addMonths,
  emptyGoalForm,
  readGoalForm,
  suggestionPreview,
  type GoalForm,
} from './goalFormState';
import { monthLabel } from './strings.es-CO';

const TODAY = '2026-10-28';
const trip: GoalForm = {
  name: 'Viaje a Cartagena',
  category: 'travel',
  target: '5.000.000',
  deadline: '2027-06',
};

describe('goal form', () => {
  it('turns the OnbMetas goal into an input in centavos', () => {
    expect(readGoalForm(trip, TODAY)).toEqual({
      ok: true,
      input: {
        name: 'Viaje a Cartagena',
        category: 'travel',
        targetMinor: 500_000_000,
        deadline: '2027-06',
      },
    });
  });

  it('reports the errors of each field', () => {
    expect(readGoalForm({ ...trip, name: '', target: 'abc', deadline: '2026-09' }, TODAY)).toEqual({
      ok: false,
      errors: { name: 'name_required', target: 'target_required', deadline: 'deadline_past' },
    });
  });

  it('lets an old goal keep its past deadline', () => {
    expect(readGoalForm({ ...trip, deadline: '2026-09' }, TODAY, '2026-09').ok).toBe(true);
  });

  it('starts 6 months ahead with no name or amount', () => {
    expect(emptyGoalForm(TODAY)).toEqual({
      name: '',
      category: 'travel',
      target: '',
      deadline: '2027-04',
    });
  });
});

describe('month stepper', () => {
  it('moves across years and writes "Jun 2027"', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(monthLabel('2027-06')).toBe('Jun 2027');
  });
});

describe('suggestionPreview', () => {
  it('gives "8 meses para llegar a $5.000.000 · $625.000", as in OnbMetas', () => {
    const p = suggestionPreview(trip, TODAY);
    expect([p?.months, formatCop(p!.targetMinor), formatCop(p!.suggestedMinor)]).toEqual([
      8,
      '$5.000.000',
      '$625.000',
    ]);
  });

  it('counts what an edited goal already saved', () => {
    expect(formatCop(suggestionPreview(trip, TODAY, 320_000_000)!.suggestedMinor)).toBe('$225.000');
  });

  it('is empty until the amount is valid', () => {
    expect(suggestionPreview({ ...trip, target: '' }, TODAY)).toBeNull();
  });
});
