// M10's view of the goals: the snapshot shape and the "Aporte automático" of the Recomendaciones
// design ("Programa $300.000 para Viaje a Cartagena el día de tu salario · Meta 2 meses antes").
import { formatCop } from '@shared/domain/money';

import { goalForAnalytics, paydayContribution, paydayFor } from './analytics';
import { summarizeGoal, type Goal } from './goal';

const pesos = (n: number) => n * 100;
const TODAY = '2026-10-28';

const goal = (over: Partial<Goal>, saved: number) =>
  summarizeGoal(
    {
      id: 'g1',
      name: 'Viaje a Cartagena',
      category: 'travel',
      targetMinor: pesos(5_000_000),
      deadline: '2027-06',
      createdAt: '2026-10-01T15:00:00.000Z',
      ...over,
    },
    pesos(saved),
    TODAY,
    saved > 0 ? '2026-10-05' : null,
    saved > 0 ? [{ amountMinor: pesos(saved), contributedOn: '2026-10-05' }] : [],
  );

describe('paydayFor', () => {
  it('gives $300.000 and 2 months earlier for Viaje a Cartagena, as in the design', () => {
    // 1.800.000 left in 8 months: $225.000 suggested, $300.000 reaches it in 6.
    const p = paydayFor(goal({}, 3_200_000))!;
    expect([formatCop(p.amountMinor), p.monthsEarlier, p.goalName]).toEqual([
      '$300.000',
      2,
      'Viaje a Cartagena',
    ]);
  });

  it('is null when the round amount does not shorten the goal', () => {
    // Regalos de Navidad: 280.000 left in 2 months; $200.000 still takes 2.
    expect(
      paydayFor(goal({ id: 'g2', targetMinor: pesos(800_000), deadline: '2026-12' }, 520_000)),
    ).toBeNull();
  });

  it('is null for a goal already reached', () => {
    expect(paydayFor(goal({}, 5_000_000))).toBeNull();
  });
});

describe('paydayContribution', () => {
  it('takes the nearest goal that it shortens', () => {
    const gifts = goal({ id: 'g2', targetMinor: pesos(800_000), deadline: '2026-12' }, 520_000);
    const trip = goal({}, 3_200_000);
    expect(paydayContribution([gifts, trip])?.goalId).toBe('g1');
    expect(paydayContribution([gifts])).toBeNull();
  });
});

describe('goalForAnalytics', () => {
  it('gives the snapshot fields, with a movement category and the pace', () => {
    expect(goalForAnalytics(goal({}, 3_200_000))).toEqual({
      id: 'g1',
      name: 'Viaje a Cartagena',
      categoryId: 'savings',
      targetMinor: pesos(5_000_000),
      savedMinor: pesos(3_200_000),
      monthsLeft: 8,
      onTrack: true,
    });
    expect(goalForAnalytics(goal({ category: 'education' }, 0)).categoryId).toBe('education');
    expect(goalForAnalytics(goal({}, 0)).onTrack).toBe(false);
  });
});
