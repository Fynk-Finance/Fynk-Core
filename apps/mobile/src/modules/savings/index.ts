// Public API of the savings module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock, MoneyMinor } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import { notificationsPort } from '@modules/notifications';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { savingsMigrations } from './adapters/vault/migrations';
import { createVaultContributionStore } from './adapters/vault/vaultContributionStore';
import { createVaultGoalStore } from './adapters/vault/vaultGoalStore';
import { createContributionService } from './application/contributionService';
import { createGoalService } from './application/goalService';
import { createMilestoneNotifier } from './application/milestoneNotifier';
import { createVaultMilestoneStore } from './adapters/vault/vaultMilestoneStore';
import type { GoalSummary } from './domain/goal';
import { createGoalFormScreen, GOAL_FORM_ROUTE } from './ui/GoalFormScreen';
import { createGoalsCarousel, GoalCardCompact } from './ui/GoalsCarousel';
import { createMetasScreen, METAS_ROUTE } from './ui/MetasScreen';

export type { GoalSummary };
/** Create a goal; with { id } it edits one. Onboarding step 4 (M3) and Metas push it. */
export { GOAL_FORM_ROUTE };
/** Metas de ahorro. The Dashboard's "Ver todos" opens it. */
export { METAS_ROUTE };

registerVaultMigrations('savings', savingsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createGoalService({
  store: () => createVaultGoalStore(getVaultDb()),
  clock,
  newId: randomUUID,
  // Deleting a goal frees the movements linked to it first.
  beforeRemove: (goalId) => contributions.unlinkGoal(goalId),
});

// SCRUM-52. Movements can be linked once M7 exports setTransactionGoal (`movements`).
const contributions = createContributionService({
  store: () => createVaultContributionStore(getVaultDb()),
  goals: () => createVaultGoalStore(getVaultDb()),
  clock,
  newId: randomUUID,
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

/** Goals with saved amount, percent and suggested monthly, nearest deadline first. */
export const getGoals = (): Promise<GoalSummary[]> => service.list();

/** "2 metas $840.000/mes": suggested monthly amounts of the goals not reached yet (M3). */
export const getGoalsMonthlyTotal = (): Promise<MoneyMinor> => service.monthlyTotal();

export const routes: ModuleRoutes = {
  module: 'savings',
  screens: [
    {
      name: METAS_ROUTE,
      // "23 % de tus ingresos" needs the monthly income of M10, not exported yet.
      component: createMetasScreen({ service, monthlyIncome: async () => null, contributions }),
      path: 'metas',
    },
    {
      name: GOAL_FORM_ROUTE,
      component: createGoalFormScreen({ service }),
      path: 'metas/nueva',
    },
  ],
};

/**
 * "Planes de ahorro" for the Dashboard (M6 places it): title, "Ver todos" (opens Metas) and the
 * carousel of goals not reached yet. Render `<GoalsCarousel />` inside a navigator.
 */
export const GoalsCarousel = createGoalsCarousel({ service });
export { GoalCardCompact };
