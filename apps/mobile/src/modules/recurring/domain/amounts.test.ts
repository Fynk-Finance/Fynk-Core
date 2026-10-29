// Reference numbers of the design (shared contracts, section 7).
import { formatCop } from '@shared/domain/money';

import { amountInMonth, fixedExpensesInMonth, subscriptionsSummary } from './amounts';
import { MON_TO_FRI, WEEKDAY, type RecurringItem, type Schedule } from './types';

const pesos = (n: number) => n * 100;
const monthly = (anchorDay: number): Schedule => ({ periodicity: 'monthly', anchorDay });

const item = (
  id: string,
  kind: RecurringItem['kind'],
  amount: number,
  schedule: Schedule,
  extra: Partial<RecurringItem> = {},
): RecurringItem => ({
  id,
  kind,
  name: id,
  amountMinor: pesos(amount),
  schedule,
  status: 'active',
  usage: null,
  ...extra,
});

// Billetera in the design.
const billetera: RecurringItem[] = [
  item('Arriendo', 'fixed', 1_400_000, monthly(1)),
  item('Servicios públicos', 'fixed', 186_000, monthly(15)),
  item('Gimnasio', 'fixed', 22_250, { periodicity: 'weekly', weekdaysMask: WEEKDAY.mon }),
  item('Transporte', 'fixed', 6_500, { periodicity: 'daily', weekdaysMask: MON_TO_FRI }),
  item('Streaming de video', 'subscription', 38_900, monthly(28), { usage: 'high' }),
  item('Streaming de series', 'subscription', 32_900, monthly(12), { usage: 'low' }),
  item('Música', 'subscription', 16_900, monthly(5), { usage: 'some' }),
  item('Almacenamiento', 'subscription', 23_900, monthly(20), { usage: 'low' }),
];

const OCTOBER_2026 = { year: 2026, month: 10 }; // 4 Mondays, 22 weekdays
const SEPTEMBER_2026 = { year: 2026, month: 9 }; // 4 Mondays, 22 weekdays
const JUNE_2026 = { year: 2026, month: 6 }; // 5 Mondays, 22 weekdays

describe('fixedExpensesInMonth (Gastos fijos de este mes)', () => {
  it('gives $1.930.600 in October and September 2026, as in the design', () => {
    expect(formatCop(fixedExpensesInMonth(billetera, OCTOBER_2026))).toBe('$1.930.600');
    expect(formatCop(fixedExpensesInMonth(billetera, SEPTEMBER_2026))).toBe('$1.930.600');
  });

  it('counts the gym 5 times in a month with 5 Mondays', () => {
    const gym = billetera[2]!;
    expect(amountInMonth(gym, JUNE_2026)).toBe(pesos(22_250 * 5));
    expect(amountInMonth(gym, OCTOBER_2026)).toBe(pesos(89_000));
  });

  it('counts transport on each of the 22 weekdays', () => {
    expect(amountInMonth(billetera[3]!, OCTOBER_2026)).toBe(pesos(143_000));
  });

  it('stops counting a cancelled item', () => {
    const cancelled = billetera.map((i) =>
      i.id === 'Arriendo' ? { ...i, status: 'cancelled' as const } : i,
    );
    expect(formatCop(fixedExpensesInMonth(cancelled, OCTOBER_2026))).toBe('$530.600');
  });

  it('gives the onboarding total $1.453.900 for four monthly items', () => {
    const onboarding = [
      item('Arriendo', 'fixed', 1_200_000, monthly(1)),
      item('Internet', 'fixed', 95_000, monthly(10)),
      item('Streaming', 'subscription', 38_900, monthly(28)),
      item('Celular', 'fixed', 120_000, monthly(15)),
    ];
    expect(formatCop(fixedExpensesInMonth(onboarding, OCTOBER_2026))).toBe('$1.453.900');
  });
});

describe('subscriptionsSummary', () => {
  it('gives "4 activas · $112.600/mes" and "Ahorra $56.800 al mes", as in the design', () => {
    const s = subscriptionsSummary(billetera, OCTOBER_2026);
    expect(s.count).toBe(4);
    expect(formatCop(s.monthlyMinor)).toBe('$112.600');
    expect(s.lowUseCount).toBe(2);
    expect(formatCop(s.lowUseMonthlyMinor)).toBe('$56.800');
  });

  it('leaves out a cancelled subscription ("Ya la cancelé")', () => {
    const cancelled = billetera.map((i) =>
      i.id === 'Streaming de series' ? { ...i, status: 'cancelled' as const } : i,
    );
    const s = subscriptionsSummary(cancelled, OCTOBER_2026);
    expect([s.count, s.lowUseCount]).toEqual([3, 1]);
    expect(formatCop(s.monthlyMinor)).toBe('$79.700');
    expect(formatCop(s.lowUseMonthlyMinor)).toBe('$23.900');
  });

  it('is all zeros without subscriptions', () => {
    expect(subscriptionsSummary(billetera.slice(0, 4), OCTOBER_2026)).toEqual({
      count: 0,
      monthlyMinor: 0,
      lowUseCount: 0,
      lowUseMonthlyMinor: 0,
    });
  });
});
