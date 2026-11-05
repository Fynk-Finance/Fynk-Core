// Ingresos and Gastos of the Dashboard card come from M10's month summary (HU-012 SCRUM-26,
// M06 rules), not from a calculation of M6.
import { renderHook } from '@testing-library/react-native';

import { createUseMonthSummary } from './useMonthSummary';

it("shows M10's income and spending of the month", async () => {
  const useMonthSummary = createUseMonthSummary(() => ({
    data: {
      month: '2026-11',
      incomeMinor: 520_000_000,
      spendingMinor: 231_040_000,
      balanceMinor: 288_960_000,
    },
  }));
  const { result } = await renderHook(() => useMonthSummary());
  expect(result.current).toEqual({ incomeMinor: 520_000_000, spendingMinor: 231_040_000 });
});

it('is null while M10 computes the month or is not configured, never a made-up $0', async () => {
  const useMonthSummary = createUseMonthSummary(() => ({ data: undefined }));
  const { result } = await renderHook(() => useMonthSummary());
  expect(result.current).toBeNull();
});
