// Installs the modules that take their dependencies at startup instead of importing them:
// M10 (analytics) and M11 (recommendations, which reads M10). The other modules install
// themselves when their index.ts loads.
import type { QueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import type { Clock } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';

import { ANALYTICS_QUERY_KEY, configureAnalytics, type AnalyticsSources } from '@modules/analytics';
import { notificationsPort } from '@modules/notifications';
import { configureRecommendations } from '@modules/recommendations';
import { getFixedExpensesThisMonth, getSubscriptionsSummary } from '@modules/recurring';
import { getGoalsForSnapshot, getPaydayContribution } from '@modules/savings';
import { getTransactionsBetween } from '@modules/transactions';
import {
  getVaultDb,
  markDirty,
  registerBackupCollection,
  registerVaultMigrations,
} from '@modules/vault';

/** What M10 reads: movements (M7), goals (M8), subscriptions and fixed expenses (M9). */
export const analyticsSources: AnalyticsSources = {
  listTransactions: getTransactionsBetween,
  getSubscriptionSummary: getSubscriptionsSummary,
  getFixedExpensesMonthly: getFixedExpensesThisMonth,
  getGoalSummaries: getGoalsForSnapshot,
  getPaydayContribution,
};

const clock: Clock = { now: () => new Date() };

let started = false;
let queryClient: QueryClient | null = null;

/**
 * Runs once, when the app loads and before the vault can open, so the vault tables and the
 * backup collection of M10 and M11 are registered in time. Later calls do nothing.
 */
export function startModules(): void {
  if (started) return;
  started = true;

  configureAnalytics({
    sources: analyticsSources,
    getVaultDb,
    registerVaultMigrations,
    registerBackupCollection,
    markDirty,
    notifications: notificationsPort,
    events: appEvents,
    clock,
    newId: randomUUID,
    onDataChanged: () => {
      void queryClient?.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY });
    },
  });

  // After M10, because it reads M10's report. Its "Programar", "Revisar" and header name keep
  // M11's defaults until M8 and M1 export theirs.
  configureRecommendations({ getVaultDb, registerVaultMigrations, clock });
}

/**
 * The QueryClient whose analytics cache is refreshed on sync, movement changes and unlock.
 * AppRoot creates it, so it binds it here. Returns the unbind.
 */
export function bindQueryClient(client: QueryClient): () => void {
  queryClient = client;
  return () => {
    if (queryClient === client) queryClient = null;
  };
}
