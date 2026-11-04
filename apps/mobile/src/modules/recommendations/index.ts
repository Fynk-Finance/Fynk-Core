// Public API of the recommendations module (M11). Other modules import only from this file.
import type { Clock } from '@shared/domain';
import type { ModuleRoutes } from '@shared/navigation';
import type { RegisterVaultMigrations, VaultDb } from '@shared/ports';
import { getAnalyticsReport, snapshotDataRange } from '@modules/analytics';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

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

export { useAiRecommendationsSetting } from './application/hooks';
export type { RecommendationsNavigation };

let navigationTargets: RecommendationsNavigation = defaultNavigation;

const RecommendationsTab = createRecommendationsScreen({
  openPaydayReminder: (...args) => navigationTargets.openPaydayReminder(...args),
  openLowUseSubscriptions: (...args) => navigationTargets.openLowUseSubscriptions(...args),
  useDisplayName: () => navigationTargets.useDisplayName(),
});

export const routes: ModuleRoutes = {
  module: 'recommendations',
  tab: RecommendationsTab,
};

export interface RecommendationsDeps {
  getVaultDb: () => VaultDb; // M2
  registerVaultMigrations: RegisterVaultMigrations; // M2
  clock: Clock;
  /** Where "Programar", "Revisar" and the header name come from (M8, M9, M1). Optional. */
  navigation?: Partial<RecommendationsNavigation>;
}

/** Installs the module with M2's vault, after M10 (which installs itself from its index.ts). */
export function configureRecommendations(deps: RecommendationsDeps): void {
  deps.registerVaultMigrations('recommendations', recommendationsMigrations);
  navigationTargets = { ...defaultNavigation, ...deps.navigation };
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

/**
 * The module installs itself when the app loads it, like M7, M8, M9 and M10. "Programar" and
 * "Revisar" keep the default targets (Metas and Billetera) and the header shows "Invitado"
 * until M1 exports the profile name.
 */
configureRecommendations({
  getVaultDb: () => getVaultDb(),
  registerVaultMigrations,
  clock: { now: () => new Date() },
});
