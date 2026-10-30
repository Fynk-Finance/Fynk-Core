// The Recomendaciones fixture of the design (docs/modules/M10-analytics.md, reference values):
// restaurants went from $150.000 to $195.000 (30 %, +$45.000), two low use subscriptions save
// $56.800 a month, and with the transport plan removed the donut adds up to $101.800.
// Test-only: never import this file from app code.
import type { AnalyticsInputs } from '../domain/snapshot';
import { cop, tx } from './txFactory';

export const DESIGN_TODAY = '2026-10-28';

export function designInputs(): AnalyticsInputs {
  const transactions = [
    // Salary, monthly on the 30th.
    tx('2026-07-30', 5_580_000, 'salary', { merchant: 'NOMINA EMPRESA DEMO SAS' }),
    tx('2026-08-30', 5_580_000, 'salary', { merchant: 'NOMINA EMPRESA DEMO SAS' }),
    tx('2026-09-30', 5_580_000, 'salary', { merchant: 'NOMINA EMPRESA DEMO SAS' }),
    // Restaurants: 150.000 in the 30 days before (30 Aug – 28 Sep) …
    tx('2026-09-05', -50_000, 'restaurants', { merchant: 'RESTAURANTE LA ESQUINA' }),
    tx('2026-09-12', -50_000, 'restaurants', { merchant: 'RESTAURANTE LA ESQUINA' }),
    tx('2026-09-19', -50_000, 'restaurants', { merchant: 'PIZZERIA DEMO' }),
    // … and 195.000 in the last 30 days (29 Sep – 28 Oct).
    tx('2026-10-03', -65_000, 'restaurants', { merchant: 'RESTAURANTE LA ESQUINA' }),
    tx('2026-10-10', -65_000, 'restaurants', { merchant: 'PIZZERIA DEMO' }),
    tx('2026-10-17', -65_000, 'restaurants', { merchant: 'RESTAURANTE LA ESQUINA' }),
    // Groceries stay the same: no opportunity.
    tx('2026-09-10', -400_000, 'groceries', { merchant: 'SUPERMERCADO DEMO' }),
    tx('2026-10-10', -400_000, 'groceries', { merchant: 'SUPERMERCADO DEMO' }),
    // Not spending: a transfer between own accounts, a card payment and a saving.
    tx('2026-10-11', -1_000_000, 'transfers', { merchant: 'TRANSFERENCIA PROPIA' }),
    tx('2026-10-11', 1_000_000, 'transfers', { merchant: 'TRANSFERENCIA PROPIA' }),
    tx('2026-10-05', -500_000, 'card_payment', { merchant: 'PAGO TARJETA' }),
    tx('2026-10-01', -300_000, 'savings', { merchant: 'APORTE VIAJE A CARTAGENA' }),
  ];
  return {
    transactions,
    subscriptions: {
      count: 4,
      monthlyMinor: cop(112_600),
      lowUseCount: 2,
      lowUseMonthlyMinor: cop(56_800),
    },
    fixedExpensesMonthlyMinor: cop(1_930_600),
    goals: [
      {
        id: 'goal-cartagena',
        name: 'Viaje a Cartagena',
        categoryId: 'savings',
        targetMinor: cop(800_000),
        savedMinor: cop(520_000),
        monthsLeft: 2,
        onTrack: true,
      },
    ],
    caps: [
      {
        id: 'cap-rest',
        categoryId: 'restaurants',
        period: 'week',
        capMinor: cop(200_000),
        createdAt: '2026-10-01T00:00:00Z',
      },
    ],
    payday: {
      goalId: 'goal-cartagena',
      goalName: 'Viaje a Cartagena',
      amountMinor: cop(300_000),
      monthsEarlier: 2,
    },
  };
}
