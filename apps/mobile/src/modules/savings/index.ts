// Public API of the savings module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock, MoneyMinor } from '@shared/domain/types';
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { savingsMigrations } from './adapters/vault/migrations';
import { createVaultGoalStore } from './adapters/vault/vaultGoalStore';
import { createGoalService } from './application/goalService';
import type { GoalSummary } from './domain/goal';
import { createGoalFormScreen, GOAL_FORM_ROUTE } from './ui/GoalFormScreen';

export type { GoalSummary };
/** Create a goal; with { id } it edits one. Onboarding step 4 (M3) and Metas push it. */
export { GOAL_FORM_ROUTE };

registerVaultMigrations('savings', savingsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createGoalService({
  store: () => createVaultGoalStore(getVaultDb()),
  clock,
  newId: randomUUID,
});

/** Goals with saved amount, percent and suggested monthly, nearest deadline first. */
export const getGoals = (): Promise<GoalSummary[]> => service.list();

/** "2 metas $840.000/mes": suggested monthly amounts of the goals not reached yet (M3). */
export const getGoalsMonthlyTotal = (): Promise<MoneyMinor> => service.monthlyTotal();

// The Metas route is M0's placeholder until the Metas screen lands (next pull request).
export const routes: ModuleRoutes = {
  module: 'savings',
  screens: [
    {
      name: 'savings.Goals',
      component: createPlaceholderScreen({
        title: 'Planes de ahorro',
        owner: 'M8 · Metas de ahorro',
      }),
      path: 'metas',
    },
    {
      name: GOAL_FORM_ROUTE,
      component: createGoalFormScreen({ service }),
      path: 'metas/nueva',
    },
  ],
};
