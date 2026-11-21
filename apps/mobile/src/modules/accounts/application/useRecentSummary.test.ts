// Ingresos and Gastos of the Dashboard card: what was registered in the last 30 days, summed by
// M7 with the same filter Movimientos opens with (HU-012 SCRUM-26). M6 does not calculate them.
import { renderHook } from '@testing-library/react-native';

import { createUseRecentSummary } from './useRecentSummary';

const clock = { now: () => new Date('2026-11-20T15:00:00Z') };
const recentFilter = (now: Date) => ({ to: now.toISOString().slice(0, 10) });

it('asks M7 for the last 30 days and shows money out as a positive Gastos', async () => {
  const useTotals = jest.fn(() => ({
    data: { count: 7, incomeMinor: 520_000_000, spendMinor: -231_040_000 },
  }));
  const useRecentSummary = createUseRecentSummary({ useTotals, recentFilter, clock });
  const { result } = await renderHook(() => useRecentSummary());
  expect(useTotals).toHaveBeenCalledWith({ to: '2026-11-20' });
  expect(result.current).toEqual({ incomeMinor: 520_000_000, spendingMinor: 231_040_000 });
});

it('is null while M7 reads the movements, never a made-up $0', async () => {
  const useRecentSummary = createUseRecentSummary({
    useTotals: () => ({ data: undefined }),
    recentFilter,
    clock,
  });
  const { result } = await renderHook(() => useRecentSummary());
  expect(result.current).toBeNull();
});
