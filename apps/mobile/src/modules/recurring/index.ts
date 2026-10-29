// Public API of the recurring module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock, MoneyMinor } from '@shared/domain/types';
import type { ModuleRoutes } from '@shared/navigation';

import { NOTIFICATIONS_ROUTE, useUnreadCount } from '@modules/notifications';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { recurringMigrations } from './adapters/vault/migrations';
import { createVaultRecurringStore } from './adapters/vault/vaultRecurringStore';
import { createRecurringService } from './application/recurringService';
import type { SubscriptionsSummary } from './domain/amounts';
import { createBilleteraScreen } from './ui/BilleteraScreen';
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

export const routes: ModuleRoutes = {
  module: 'recurring',
  // The Billetera tab (tabOwners in src/app/registry.ts).
  tab: createBilleteraScreen({
    service,
    clock,
    useUnreadCount,
    accountRoute: 'identity.Account',
    notificationsRoute: NOTIFICATIONS_ROUTE,
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
