// "23 % de tus ingresos": which monthly income Metas divides by.
import { shareOfIncome } from './goals';
import { monthlyIncome, previousMonth } from './income';

const pesos = (n: number) => n * 100;

describe('monthlyIncome', () => {
  it('adds the recurring income M10 estimates', () => {
    expect(monthlyIncome([pesos(3_200_000), pesos(450_000)], pesos(1_000_000))).toBe(
      pesos(3_650_000),
    );
  });

  it('uses the last full month when there is no recurring income yet', () => {
    expect(monthlyIncome([], pesos(3_650_000))).toBe(pesos(3_650_000));
  });

  it('is null with no income at all, so Metas shows no share', () => {
    expect(monthlyIncome([], 0)).toBeNull();
    expect(monthlyIncome([], null)).toBeNull();
  });

  it('gives the share of the design: $840.000 of $3.650.000 is 23 %', () => {
    expect(shareOfIncome(pesos(840_000), monthlyIncome([pesos(3_650_000)], null)!)).toBe(23);
  });
});

describe('previousMonth', () => {
  it('is the month before, across a year', () => {
    expect(previousMonth('2026-10-28')).toBe('2026-09');
    expect(previousMonth('2027-01-05')).toBe('2026-12');
  });
});
