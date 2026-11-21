import { cop, tx } from '../testing/txFactory';
import { cadenceOf, medianInt, recurringIncome } from './recurringIncome';

const TODAY = '2026-10-28';

describe('recurringIncome (HU-023 ingresos recurrentes)', () => {
  it('finds a monthly salary with its estimated amount and usual day', () => {
    const txs = [
      tx('2026-08-30', 5_580_000, 'salary', { merchant: 'NOMINA EMPRESA DEMO' }),
      tx('2026-09-30', 5_580_000, 'salary', { merchant: 'NOMINA EMPRESA DEMO' }),
      tx('2026-10-28', 5_600_000, 'salary', { merchant: 'NOMINA EMPRESA DEMO' }),
    ];
    expect(recurringIncome(txs, TODAY)).toEqual([
      {
        sourceKey: 'nomina empresa demo',
        label: 'NOMINA EMPRESA DEMO',
        kind: 'salary',
        cadence: 'monthly',
        estimatedMonthlyMinor: cop(5_580_000),
        usualDay: 30,
        occurrences: 3,
        lastOn: '2026-10-28',
      },
    ]);
  });

  it('finds a biweekly payment and doubles it for the month', () => {
    const txs = [
      tx('2026-09-15', 1_200_000, 'income_other', { merchant: 'HONORARIOS CLIENTE' }),
      tx('2026-09-30', 1_200_000, 'income_other', { merchant: 'HONORARIOS CLIENTE' }),
      tx('2026-10-15', 1_100_000, 'income_other', { merchant: 'HONORARIOS CLIENTE' }),
    ];
    const [source] = recurringIncome(txs, TODAY);
    expect(source).toMatchObject({
      kind: 'other',
      cadence: 'biweekly',
      estimatedMonthlyMinor: cop(2_400_000),
      usualDay: 15,
    });
  });

  it('ignores a single payment, irregular intervals, and amounts over ± 15 %', () => {
    const txs = [
      tx('2026-10-01', 300_000, 'income_other', { merchant: 'UNA VEZ' }),
      tx('2026-08-01', 100_000, 'income_other', { merchant: 'IRREGULAR' }),
      tx('2026-08-08', 100_000, 'income_other', { merchant: 'IRREGULAR' }),
      tx('2026-09-01', 500_000, 'income_other', { merchant: 'VARIABLE' }),
      tx('2026-10-01', 700_000, 'income_other', { merchant: 'VARIABLE' }),
    ];
    expect(recurringIncome(txs, TODAY)).toEqual([]);
  });

  it('never counts transfers between own accounts or old payments outside 3 months', () => {
    const txs = [
      tx('2026-09-10', 1_000_000, 'transfers', { merchant: 'TRANSFERENCIA' }),
      tx('2026-10-10', 1_000_000, 'transfers', { merchant: 'TRANSFERENCIA' }),
      tx('2026-05-30', 900_000, 'salary', { merchant: 'NOMINA VIEJA' }),
      tx('2026-06-30', 900_000, 'salary', { merchant: 'NOMINA VIEJA' }),
    ];
    expect(recurringIncome(txs, TODAY)).toEqual([]);
  });

  it('classifies intervals with ± 3 days of tolerance', () => {
    expect(cadenceOf(28)).toBe('monthly');
    expect(cadenceOf(34)).toBe('monthly');
    expect(cadenceOf(35)).toBeNull();
    expect(cadenceOf(12)).toBe('biweekly');
    expect(cadenceOf(18)).toBe('biweekly');
    expect(cadenceOf(7)).toBeNull();
    expect(medianInt([3, 1, 2, 10])).toBe(2);
  });
});
