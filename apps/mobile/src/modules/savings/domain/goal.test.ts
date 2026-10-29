// SCRUM-51: the goal form rules and the numbers of each goal card (reference values of the
// shared contracts, section 7, and the design's Metas and OnbMetas).
import { formatCop } from '@shared/domain/money';

import { byDeadline, summarizeGoal, validateGoal, type Goal, type GoalInput } from './goal';

const pesos = (n: number) => n * 100;
const TODAY = '2026-10-28';

const trip: GoalInput = {
  name: 'Viaje a Cartagena',
  category: 'travel',
  targetMinor: pesos(5_000_000),
  deadline: '2027-06',
};

const goal = (over: Partial<Goal> = {}): Goal => ({
  ...trip,
  id: 'g1',
  createdAt: '2026-10-01T15:00:00.000Z',
  ...over,
});

describe('validateGoal', () => {
  it('accepts the goal of OnbMetas', () => {
    expect(validateGoal(trip, TODAY)).toEqual({});
  });

  it('reports every missing field at once', () => {
    expect(validateGoal({ ...trip, name: '  ', targetMinor: 0, deadline: '' }, TODAY)).toEqual({
      name: 'name_required',
      target: 'target_required',
      deadline: 'deadline_invalid',
    });
  });

  it('rejects a long name, a huge target and a month that does not exist', () => {
    expect(
      validateGoal(
        { ...trip, name: 'x'.repeat(41), targetMinor: pesos(2_000_000_000), deadline: '2027-13' },
        TODAY,
      ),
    ).toEqual({ name: 'name_too_long', target: 'target_too_large', deadline: 'deadline_invalid' });
  });

  it('accepts this month as deadline but not an earlier one', () => {
    expect(validateGoal({ ...trip, deadline: '2026-10' }, TODAY)).toEqual({});
    expect(validateGoal({ ...trip, deadline: '2026-09' }, TODAY)).toEqual({
      deadline: 'deadline_past',
    });
  });
});

describe('summarizeGoal', () => {
  it('gives "8 meses para llegar a $5.000.000 · $625.000" for a new goal (OnbMetas)', () => {
    const s = summarizeGoal(goal(), 0, TODAY);
    expect([s.monthsLeft, formatCop(s.suggestedMonthlyMinor), s.percent]).toEqual([
      8,
      '$625.000',
      0,
    ]);
  });

  it('gives 64 % and $1.800.000 left for $3.200.000 saved (Metas)', () => {
    const s = summarizeGoal(goal(), pesos(3_200_000), TODAY);
    expect([s.percent, formatCop(s.remainingMinor), s.done]).toEqual([64, '$1.800.000', false]);
  });

  it('gives "Aporte sugerido $140.000" and "Te falta $280.000" for Regalos de Navidad', () => {
    const s = summarizeGoal(
      goal({ name: 'Regalos de Navidad', targetMinor: pesos(800_000), deadline: '2026-12' }),
      pesos(520_000),
      TODAY,
    );
    expect([formatCop(s.suggestedMonthlyMinor), formatCop(s.remainingMinor), s.percent]).toEqual([
      '$140.000',
      '$280.000',
      65,
    ]);
  });

  it('is done with nothing left and no suggested amount once reached', () => {
    const s = summarizeGoal(goal(), pesos(5_100_000), TODAY);
    expect([s.done, s.percent, s.remainingMinor, s.suggestedMonthlyMinor]).toEqual([
      true,
      100,
      0,
      0,
    ]);
  });
});

describe('byDeadline', () => {
  it('puts the nearest deadline first, then the oldest goal', () => {
    const a = goal({ id: 'a', deadline: '2027-06' });
    const b = goal({ id: 'b', deadline: '2026-12' });
    const c = goal({ id: 'c', deadline: '2027-06', createdAt: '2026-09-01T00:00:00.000Z' });
    expect([a, b, c].sort(byDeadline).map((g) => g.id)).toEqual(['b', 'c', 'a']);
  });
});
