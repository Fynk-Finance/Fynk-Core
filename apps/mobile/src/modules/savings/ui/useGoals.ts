// Goals and the stats of Metas, reloaded on every change. While the vault is locked it reads as
// empty: the vault gate hides the app then anyway.
import { useCallback, useEffect, useState } from 'react';

import type { MoneyMinor } from '@shared/domain/types';
import { VaultLockedError } from '@shared/ports';

import type { GoalService, GoalsOverview } from '../application/goalService';
import type { GoalSummary } from '../domain/goal';

export type GoalsState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      goals: GoalSummary[];
      overview: GoalsOverview;
      /** Monthly income from M10, null until it is available. */
      incomeMinor: MoneyMinor | null;
    };

const EMPTY: GoalsOverview = {
  savedMinor: 0,
  contributedThisMonthMinor: 0,
  doneCount: 0,
  monthlyMinor: 0,
};

export function useGoals(service: GoalService, monthlyIncome: () => Promise<MoneyMinor | null>) {
  const [state, setState] = useState<GoalsState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const [goals, overview, incomeMinor] = await Promise.all([
        service.list(),
        service.overview(),
        monthlyIncome().catch(() => null),
      ]);
      setState({ status: 'ready', goals, overview, incomeMinor });
    } catch (error) {
      if (error instanceof VaultLockedError)
        setState({ status: 'ready', goals: [], overview: EMPTY, incomeMinor: null });
      else setState({ status: 'error' });
    }
  }, [service, monthlyIncome]);

  useEffect(() => {
    let active = true;
    const reload = () => {
      if (active) void load();
    };
    const unsubscribe = service.subscribe(reload);
    reload();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service, load]);

  return { state, reload: load };
}
