// Test harness of the analytics module: the real service on an in-memory vault, with the
// design fixture as M7, M8 and M9. Test-only: never import this file from app code.
import type { Transaction } from '@shared/domain';
import {
  createFixedClock,
  createInMemoryBackupRegistry,
  createInMemoryNotifications,
  createInMemoryVault,
  type InMemoryVault,
} from '@shared/testing';

import { createVaultCapsStore } from '../adapters/vault/capsStore';
import { analyticsMigrations } from '../adapters/vault/migrations';
import { CAPS_BACKUP_COLLECTION, createAnalyticsService } from '../application/analyticsService';
import type { AnalyticsSources } from '../application/ports';
import { DESIGN_TODAY, designInputs } from './designFixture';

export async function setupAnalytics(
  transactions: readonly Transaction[] = designInputs().transactions,
) {
  const vault: InMemoryVault = await createInMemoryVault();
  vault.registerMigrations('analytics', analyticsMigrations);
  await vault.migrate();
  const clock = createFixedClock(`${DESIGN_TODAY}T17:00:00Z`);
  const notifications = createInMemoryNotifications(() => clock.now().toISOString());
  const backup = createInMemoryBackupRegistry();
  const txs = [...transactions];
  const fixture = designInputs();
  const sources: AnalyticsSources = {
    listTransactions: async (from, to) =>
      txs.filter((t) => {
        const d = t.bookedAt.slice(0, 10);
        return d >= from && d <= to;
      }),
    getSubscriptionSummary: async () => fixture.subscriptions,
    getFixedExpensesMonthly: async () => fixture.fixedExpensesMonthlyMinor,
    getGoalSummaries: async () => [...fixture.goals],
    getPaydayContribution: async () => fixture.payday,
  };
  const store = createVaultCapsStore(() => vault.db);
  let n = 0;
  const service = createAnalyticsService({
    sources,
    caps: store,
    notifications,
    clock,
    markDirty: backup.markDirty,
    newId: () => `cap-${++n}`,
  });
  backup.registerBackupCollection({
    module: 'analytics',
    collection: CAPS_BACKUP_COLLECTION,
    exportAll: () => store.exportAll(),
    importAll: (r) => store.importAll(r),
  });
  return { vault, clock, notifications, backup, service, txs, store };
}
