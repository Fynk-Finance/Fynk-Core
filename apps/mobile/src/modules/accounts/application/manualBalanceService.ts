// Applies a manual movement of M7 to the balances it changes: cash and disconnected accounts
// (domain/manualBalance.ts). Every account is checked before anything is written.
import type { MoneyMinor } from '@shared/domain/types';

import { manualBalanceUpdates, type ManualMovementChange } from '../domain/manualBalance';
import type { AccountsStore } from './ports';

export interface ManualBalanceServiceDeps {
  store: () => AccountsStore;
  /** CashService.setCash: writes the amount, its history entry and the backup mark. */
  setCash: (amountMinor: MoneyMinor) => Promise<void>;
  onChanged: () => void;
}

export interface ManualBalanceService {
  /** Throws InsufficientCashError, writing nothing, when cash would go below $0. */
  applyManualMovement(change: ManualMovementChange): Promise<void>;
}

export function createManualBalanceService(deps: ManualBalanceServiceDeps): ManualBalanceService {
  return {
    async applyManualMovement(change) {
      const updates = manualBalanceUpdates(await deps.store().list(), change);
      if (updates.length === 0) return;
      const bank = updates.filter((u) => u.account.kind !== 'cash');
      if (bank.length > 0) {
        await deps.store().setManualBalances(
          bank.map((u) => ({
            id: u.account.id,
            balanceMinor: u.balanceMinor,
            availableMinor: u.availableMinor,
          })),
        );
      }
      const cash = updates.find((u) => u.account.kind === 'cash');
      if (cash) await deps.setCash(cash.balanceMinor);
      deps.onChanged();
    },
  };
}
