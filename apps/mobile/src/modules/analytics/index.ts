// Public API of the analytics module (M10). Other modules import only from this file.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback } from 'react';

import type { AggregateSnapshot, CategoryId, Clock, Id, MoneyMinor } from '@shared/domain';
import type { AppEvents } from '@shared/events/appEvents';
import type {
  MarkDirty,
  NotificationsPort,
  RegisterBackupCollection,
  RegisterVaultMigrations,
  VaultDb,
} from '@shared/ports';
import type { ModuleRoutes } from '@shared/navigation';

import { createVaultCapsStore } from './adapters/vault/capsStore';
import { analyticsMigrations } from './adapters/vault/migrations';
import {
  CAPS_BACKUP_COLLECTION,
  createAnalyticsService,
  type AnalyticsService,
} from './application/analyticsService';
import { subscribeAnalyticsEvents } from './application/events';
import { getAnalyticsService, setAnalyticsService } from './application/hooks';
import type { AnalyticsSources, CapsBackupData } from './application/ports';
import { DEFAULT_TREATS_THRESHOLD_MINOR } from './domain/caps';
import type { MonthSummary, Opportunity, RecurringIncomeSource } from './domain/types';
import { CapFormScreen, type CapFormParams } from './ui/CapFormScreen';
import { CAP_FORM_ROUTE, CapsScreen, CAPS_ROUTE } from './ui/CapsScreen';
import { SpendingScreen } from './ui/SpendingScreen';

export type { AnalyticsSources, CapFormParams, MonthSummary, Opportunity, RecurringIncomeSource };
export type {
  GoalSummary,
  PaydayContribution,
  SubscriptionSummary,
  CategorySpend,
  Trend,
} from './domain/types';
export { snapshotDataRange } from './domain/snapshot';
export { savingOpportunities, totalMonthlySaving } from './domain/opportunities';
export { useAnalyticsReport, useMonthSummary, ANALYTICS_QUERY_KEY } from './application/hooks';
export { SpendingScreen, CapsScreen, CapFormScreen };

export const routes: ModuleRoutes = {
  module: 'analytics',
  screens: [
    { name: 'analytics.Spending', component: SpendingScreen, path: 'analisis' },
    { name: CAPS_ROUTE, component: CapsScreen, path: 'analisis/topes' },
    { name: CAP_FORM_ROUTE, component: CapFormScreen, path: 'analisis/topes/nuevo' },
  ],
};

export interface AnalyticsDeps {
  sources: AnalyticsSources; // M7, M8, M9
  getVaultDb: () => VaultDb; // M2
  registerVaultMigrations: RegisterVaultMigrations; // M2
  registerBackupCollection: RegisterBackupCollection; // M2
  markDirty: MarkDirty; // M2
  notifications: NotificationsPort; // M12
  events: AppEvents; // M0
  clock: Clock;
  newId: () => Id;
  /** Called when the cached numbers must be refetched (invalidates ANALYTICS_QUERY_KEY). */
  onDataChanged: () => void;
}

/**
 * Installs the module once at startup, after M2's vault is ready: registers the vault tables and
 * the backup collection analytics.caps, and evaluates caps on sync, movement changes and unlock.
 * Returns a function that stops listening to the events.
 */
export function configureAnalytics(deps: AnalyticsDeps): () => void {
  deps.registerVaultMigrations('analytics', analyticsMigrations);
  const caps = createVaultCapsStore(deps.getVaultDb);
  const service = createAnalyticsService({
    sources: deps.sources,
    caps,
    notifications: deps.notifications,
    clock: deps.clock,
    markDirty: deps.markDirty,
    newId: deps.newId,
  });
  deps.registerBackupCollection<CapsBackupData>({
    module: 'analytics',
    collection: CAPS_BACKUP_COLLECTION,
    exportAll: () => caps.exportAll(),
    importAll: (records) => caps.importAll(records),
  });
  setAnalyticsService(service);
  return subscribeAnalyticsEvents(deps.events, service, deps.onDataChanged);
}

function requireService(): AnalyticsService {
  const service = getAnalyticsService();
  if (!service) throw new Error('Analytics is not configured yet (configureAnalytics)');
  return service;
}

/** Income and spending of a month for the Dashboard pills (M6). Default: this month. */
export function getMonthSummary(month?: string): Promise<MonthSummary> {
  return requireService().getMonthSummary(month);
}

/** The aggregate snapshot sent to the AI (M11). */
export function buildSnapshot(): Promise<AggregateSnapshot> {
  return requireService().buildSnapshot();
}

/** Snapshot and opportunities computed from the same inputs (M11). */
export function getAnalyticsReport() {
  return requireService().getReport();
}

export function getOpportunities(): Promise<Opportunity[]> {
  return requireService().getOpportunities();
}

/** Recurring income sources, with the usual payday (M8). */
export function getRecurringIncome(): Promise<RecurringIncomeSource[]> {
  return requireService().getRecurringIncome();
}

/** "Antojos" threshold for M7's categorization. $20.000 until the user changes it. */
export async function getTreatsThreshold(): Promise<MoneyMinor> {
  const service = getAnalyticsService();
  return service ? service.getTreatsThreshold() : DEFAULT_TREATS_THRESHOLD_MINOR;
}

/** Route and params of the cap form, prefilled from Recomendaciones "Fijar tope". */
export function openCapForm(categoryId: CategoryId, suggestedMinor: MoneyMinor) {
  const params: CapFormParams = { categoryId, suggestedMinor };
  return { name: CAP_FORM_ROUTE, params } as const;
}

/** Hook for screens of other modules: returns a function that opens the cap form. */
export function useOpenCapForm(): (categoryId: CategoryId, suggestedMinor: MoneyMinor) => void {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  return useCallback(
    (categoryId, suggestedMinor) => {
      const { name, params } = openCapForm(categoryId, suggestedMinor);
      navigation.navigate(name, params);
    },
    [navigation],
  );
}
