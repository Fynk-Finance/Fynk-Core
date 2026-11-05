// Ports of the payday reminder (M8 prompt). The vault adapter implements PaydayStore
// (adapters/vault/vaultPaydayStore.ts).
import type { Id, IsoDateTime, MoneyMinor } from '@shared/domain/types';

export interface PaydayReminder {
  goalId: Id;
  amountMinor: MoneyMinor;
  day: number;
  updatedAt: IsoDateTime;
}

export interface PaydayStore {
  get(goalId: Id): Promise<PaydayReminder | null>;
  list(): Promise<PaydayReminder[]>;
  save(reminder: PaydayReminder): Promise<void>;
  remove(goalId: Id): Promise<void>;
}
