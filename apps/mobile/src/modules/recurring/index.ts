// Public API of the recurring module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock, MoneyMinor } from '@shared/domain/types';
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { recurringMigrations } from './adapters/vault/migrations';
import { createVaultRecurringStore } from './adapters/vault/vaultRecurringStore';
import { createRecurringService } from './application/recurringService';
import type { SubscriptionsSummary } from './domain/amounts';
import { createRecurringFormScreen, RECURRING_FORM_ROUTE } from './ui/RecurringFormScreen';

export type { SubscriptionsSummary };
export { RECURRING_FORM_ROUTE };

registerVaultMigrations('recurring', recurringMigrations);

const clock: Clock = { now: () => new Date() };

const service = createRecurringService({
  store: () => createVaultRecurringStore(getVaultDb()),
  clock,
  newId: randomUUID,
});

/** "Gastos fijos de este mes": every active item counted by its charges in the current month. */
export const getFixedExpensesThisMonth = (): Promise<MoneyMinor> =>
  service.fixedExpensesThisMonth();

/** Count, monthly total and low use saving of the active subscriptions (M10 snapshot, M11). */
export const getSubscriptionsSummary = (): Promise<SubscriptionsSummary> =>
  service.subscriptionsSummary();

// Placeholder tab from M0 until the Billetera sections of M9 land.
export const routes: ModuleRoutes = {
  module: 'recurring',
  tab: createPlaceholderScreen({
    title: 'Billetera',
    owner: 'M9 · Gastos recurrentes y suscripciones',
    withHeader: true,
  }),
  screens: [
    {
      // Add a fixed expense or subscription; with { id } it edits one.
      name: RECURRING_FORM_ROUTE,
      component: createRecurringFormScreen({ service }),
      path: 'billetera/recurrentes/nuevo',
    },
  ],
};
