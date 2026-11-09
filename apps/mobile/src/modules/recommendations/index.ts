// Public API of the recommendations module (M11). Other modules import only from this file.
import type { Clock } from '@shared/domain';
import type { ModuleRoutes } from '@shared/navigation';
import type { RegisterVaultMigrations, VaultDb } from '@shared/ports';
import { getAnalyticsReport, snapshotDataRange, STATISTICS_ROUTE } from '@modules/analytics';
import { NOTIFICATIONS_ROUTE, useUnreadCount } from '@modules/notifications';
import { useDisplayName as useOnboardingName } from '@modules/onboarding';
import { openPaydayReminder } from '@modules/savings';

import { createRecommendationsApi } from './adapters/api/recommendationsApi';
import { recommendationsMigrations } from './adapters/vault/migrations';
import { createVaultRecommendationsStore } from './adapters/vault/store';
import { setRecommendationsService } from './application/hooks';
import { createRecommendationsService } from './application/recommendationsService';
import {
  createRecommendationsScreen,
  defaultNavigation,
  type RecommendationsNavigation,
} from './ui/RecommendationsScreen';
import { recommendationsStrings } from './ui/strings.es-CO';

export { useAiRecommendationsSetting } from './application/hooks';
export type { RecommendationsNavigation };

/** The name typed in onboarding (M3), or "Invitado". Read only while the screen renders. */
function useHeaderName(): string {
  return useOnboardingName() ?? recommendationsStrings.guestName;
}

/**
 * "Programar" opens M8's payday reminder, "Revisar" M9's low use filter, the name is M3's, the
 * bell is M12's and the chart opens M10's Estadísticas.
 */
const installedNavigation: RecommendationsNavigation = {
  ...defaultNavigation,
  openPaydayReminder: (nav, goalId, amountMinor) => openPaydayReminder(nav, goalId, amountMinor),
  useDisplayName: useHeaderName,
  useUnreadCount: () => useUnreadCount(),
  notificationsRoute: NOTIFICATIONS_ROUTE,
  statisticsRoute: STATISTICS_ROUTE,
};

let navigationTargets: RecommendationsNavigation = installedNavigation;

const RecommendationsTab = createRecommendationsScreen({
  openPaydayReminder: (...args) => navigationTargets.openPaydayReminder(...args),
  openLowUseSubscriptions: (...args) => navigationTargets.openLowUseSubscriptions(...args),
  useDisplayName: () => navigationTargets.useDisplayName(),
  useUnreadCount: () => navigationTargets.useUnreadCount(),
  // Read on a press, so configureRecommendations() can still override them.
  get accountRoute() {
    return navigationTargets.accountRoute;
  },
  get notificationsRoute() {
    return navigationTargets.notificationsRoute;
  },
  get statisticsRoute() {
    return navigationTargets.statisticsRoute;
  },
});

export const routes: ModuleRoutes = {
  module: 'recommendations',
  tab: RecommendationsTab,
};

export interface RecommendationsDeps {
  getVaultDb: () => VaultDb; // M2
  registerVaultMigrations: RegisterVaultMigrations; // M2
  clock: Clock;
  /** Overrides where "Programar", "Revisar" and the header name come from (M8, M9, M3). */
  navigation?: Partial<RecommendationsNavigation>;
}

/** Installs the module once at startup, after M2's vault and configureAnalytics(). */
export function configureRecommendations(deps: RecommendationsDeps): void {
  deps.registerVaultMigrations('recommendations', recommendationsMigrations);
  navigationTargets = { ...installedNavigation, ...deps.navigation };
  setRecommendationsService(
    createRecommendationsService({
      analytics: { getReport: getAnalyticsReport },
      api: createRecommendationsApi(),
      store: createVaultRecommendationsStore(deps.getVaultDb),
      clock: deps.clock,
      dataRange: snapshotDataRange,
    }),
  );
}
