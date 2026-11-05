// Public API of the savings module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock, MoneyMinor } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import type { GoalSummary as AnalyticsGoal, PaydayContribution } from '@modules/analytics';
import { notificationsPort } from '@modules/notifications';
import { getTransactionsBetween, setTransactionGoal } from '@modules/transactions';
import {
  getVaultDb,
  markDirty,
  registerBackupCollection,
  registerVaultMigrations,
} from '@modules/vault';

import { createSavingsBackup } from './adapters/backup/savingsBackup';
import { savingsMigrations } from './adapters/vault/migrations';
import { createVaultContributionStore } from './adapters/vault/vaultContributionStore';
import { createVaultGoalStore } from './adapters/vault/vaultGoalStore';
import { createContributionService } from './application/contributionService';
import { createGoalService } from './application/goalService';
import { createMilestoneNotifier } from './application/milestoneNotifier';
import { createVaultMilestoneStore } from './adapters/vault/vaultMilestoneStore';
import { createVaultPaydayStore } from './adapters/vault/vaultPaydayStore';
import { createPaydayService } from './application/paydayService';
import { goalForAnalytics, paydayContribution } from './domain/analytics';
import type { GoalSummary } from './domain/goal';
import { createGoalFormScreen, GOAL_FORM_ROUTE } from './ui/GoalFormScreen';
import { createGoalsCarousel, GoalCardCompact } from './ui/GoalsCarousel';
import { createLinkMovementScreen, LINK_MOVEMENT_ROUTE } from './ui/LinkMovementScreen';
import { createMetasScreen, METAS_ROUTE } from './ui/MetasScreen';

export type { GoalSummary };
/** Create a goal; with { id } it edits one. Onboarding step 4 (M3) and Metas push it. */
export { GOAL_FORM_ROUTE };
/** Metas de ahorro. The Dashboard's "Ver todos" opens it. */
export { METAS_ROUTE };

registerVaultMigrations('savings', savingsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createGoalService({
  store: () => createVaultGoalStore(getVaultDb(), markDirty),
  clock,
  newId: randomUUID,
  // Deleting a goal frees the movements linked to it and drops its payday reminder first.
  beforeRemove: async (goalId) => {
    await contributions.unlinkGoal(goalId);
    await payday.remove(goalId);
  },
});

// SCRUM-52: manual aportes, and movements of M7 linked as aportes ("Vincular un movimiento").
const contributions = createContributionService({
  store: () => createVaultContributionStore(getVaultDb(), markDirty),
  goals: () => createVaultGoalStore(getVaultDb(), markDirty),
  clock,
  newId: randomUUID,
  movements: { setTransactionGoal },
  listMovements: getTransactionsBetween,
  onChange: () => service.notifyChanged(),
});

// SCRUM-53: notices at 50 %, 75 % and 100 %, with the app open only: when the vault opens and
// after every change of the goals or their contributions.
const milestones = createMilestoneNotifier({
  goals: () => service.list(),
  store: () => createVaultMilestoneStore(getVaultDb()),
  notifications: notificationsPort,
  clock,
});
const checkMilestones = () => {
  void milestones.check().catch(() => undefined);
};
appEvents.on('vault.unlocked', checkMilestones);
service.subscribe(checkMilestones);

// HU-045: goals before contributions, which reference them.
const backup = createSavingsBackup({
  db: getVaultDb,
  markDirty,
  onImported: () => service.notifyChanged(),
});
registerBackupCollection(backup.goals);
registerBackupCollection(backup.contributions);
appEvents.on('vault.unlocked', () => {
  void backup.flushPending().catch(() => undefined);
});

/** Goals with saved amount, percent and suggested monthly, nearest deadline first. */
export const getGoals = (): Promise<GoalSummary[]> => service.list();

/** "2 metas $840.000/mes": suggested monthly amounts of the goals not reached yet (M3). */
export const getGoalsMonthlyTotal = (): Promise<MoneyMinor> => service.monthlyTotal();

/**
 * M10's `AnalyticsSources.getGoalSummaries`: the goals not reached yet, with the fields of the
 * snapshot (shared contracts 3.5). `name` is for the screen and never goes in the snapshot.
 */
export const getGoalsForSnapshot = async (): Promise<AnalyticsGoal[]> =>
  (await service.list()).filter((g) => !g.done).map(goalForAnalytics);

/**
 * M10's `AnalyticsSources.getPaydayContribution`: "Programa $300.000 para Viaje a Cartagena el
 * día de tu salario · Meta 2 meses antes" in Recomendaciones, or null when no goal gains from it.
 */
export const getPaydayContribution = async (): Promise<PaydayContribution | null> =>
  paydayContribution(await service.list());

// The payday reminder (M8 prompt, Recomendaciones "Programar"). M12 notifications fire once, so
// the next month is scheduled again whenever the vault opens. Its screen comes next.
const payday = createPaydayService({
  store: () => createVaultPaydayStore(getVaultDb()),
  goals: () => service.list(),
  notifications: notificationsPort,
  clock,
});
appEvents.on('vault.unlocked', () => {
  void payday.refresh().catch(() => undefined);
});

export const routes: ModuleRoutes = {
  module: 'savings',
  screens: [
    {
      name: METAS_ROUTE,
      // "23 % de tus ingresos" needs the monthly income of M10, not exported yet.
      component: createMetasScreen({
        service,
        monthlyIncome: async () => null,
        contributions,
        canLink: true,
      }),
      path: 'metas',
    },
    {
      name: GOAL_FORM_ROUTE,
      component: createGoalFormScreen({ service }),
      path: 'metas/nueva',
    },
    {
      name: LINK_MOVEMENT_ROUTE,
      component: createLinkMovementScreen({ goals: service, contributions }),
      path: 'metas/:goalId/vincular',
    },
  ],
};

/**
 * "Planes de ahorro" for the Dashboard (M6 places it): title, "Ver todos" (opens Metas) and the
 * carousel of goals not reached yet. Render `<GoalsCarousel />` inside a navigator.
 */
export const GoalsCarousel = createGoalsCarousel({ service });
export { GoalCardCompact };
