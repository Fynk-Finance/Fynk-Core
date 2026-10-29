// Ports of the analytics module. The application layer reads other modules and its own vault
// tables only through these interfaces; adapters and the wiring in index.ts implement them.
import type { Id, IsoDate, IsoDateTime, MoneyMinor, Transaction } from '@shared/domain';
import type { BackupRecord } from '@shared/ports';

import type { CapAlertLevel } from '../domain/caps';
import type {
  GoalSummary,
  PaydayContribution,
  SpendingCap,
  SubscriptionSummary,
} from '../domain/types';

/** What M10 reads from M7 (movements), M8 (goals) and M9 (subscriptions, fixed expenses). */
export interface AnalyticsSources {
  /** Movements booked between two Bogotá days, both included (M7). */
  listTransactions(from: IsoDate, to: IsoDate): Promise<Transaction[]>;
  /** Subscriptions summary of Billetera (M9). Null when M9 has nothing yet. */
  getSubscriptionSummary(): Promise<SubscriptionSummary | null>;
  /** Fixed expenses of a month, subscriptions included (M9). */
  getFixedExpensesMonthly(): Promise<MoneyMinor>;
  /** Active goals (M8). */
  getGoalSummaries(): Promise<GoalSummary[]>;
  /** Suggested contribution on payday (M8). Null when there is no goal to suggest. */
  getPaydayContribution(): Promise<PaydayContribution | null>;
}

export interface CapRecord extends SpendingCap {
  deletedAt: IsoDateTime | null;
  version: number;
}

export interface SettingsRecord {
  treatsThresholdMinor: MoneyMinor;
  version: number;
}

/** Backup payload of the collection analytics.caps: caps plus one settings record. */
export type CapsBackupData =
  | {
      type: 'cap';
      categoryId: string;
      period: 'week' | 'month';
      capMinor: MoneyMinor;
      createdAt: IsoDateTime;
      deletedAt: IsoDateTime | null;
    }
  | { type: 'settings'; treatsThresholdMinor: MoneyMinor };

export interface CapsStore {
  listActive(): Promise<SpendingCap[]>;
  get(id: Id): Promise<CapRecord | null>;
  /** Inserts or replaces a cap and bumps its version. */
  save(cap: SpendingCap): Promise<void>;
  softDelete(id: Id, at: IsoDateTime): Promise<void>;
  getSettings(): Promise<SettingsRecord | null>;
  setTreatsThreshold(minor: MoneyMinor): Promise<void>;
  sentAlertKeys(): Promise<Set<string>>;
  recordAlerts(
    alerts: { capId: Id; periodKey: string; level: CapAlertLevel }[],
    at: IsoDateTime,
  ): Promise<void>;
  exportAll(): Promise<BackupRecord<CapsBackupData>[]>;
  importAll(records: BackupRecord<CapsBackupData>[]): Promise<void>;
}
