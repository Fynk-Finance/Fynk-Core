// Active recurring items and "Gastos fijos de este mes" for Billetera. Reloads on every change.
// While the vault is locked it reads as empty: the vault gate hides the tabs then anyway.
import { useCallback, useEffect, useState } from 'react';

import type { MoneyMinor } from '@shared/domain/types';
import { VaultLockedError } from '@shared/ports';

import type { SubscriptionsSummary } from '../domain/amounts';
import type { StoredRecurringItem } from '../domain/item';
import type { RecurringService } from '../application/recurringService';

export type RecurringState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      items: StoredRecurringItem[];
      monthTotal: MoneyMinor;
      subscriptions: SubscriptionsSummary;
    };

const EMPTY_SUMMARY: SubscriptionsSummary = {
  count: 0,
  monthlyMinor: 0,
  lowUseCount: 0,
  lowUseMonthlyMinor: 0,
};

export function useRecurringItems(service: RecurringService) {
  const [state, setState] = useState<RecurringState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const [items, monthTotal, subscriptions] = await Promise.all([
        service.list(),
        service.fixedExpensesThisMonth(),
        service.subscriptionsSummary(),
      ]);
      setState({ status: 'ready', items, monthTotal, subscriptions });
    } catch (error) {
      if (error instanceof VaultLockedError)
        setState({ status: 'ready', items: [], monthTotal: 0, subscriptions: EMPTY_SUMMARY });
      else setState({ status: 'error' });
    }
  }, [service]);

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
