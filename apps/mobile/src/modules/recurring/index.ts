// Public API of the recurring module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock, MoneyMinor } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import {
  getPaymentReminderLeadDays,
  NOTIFICATIONS_ROUTE,
  notificationsPort,
  onNotificationSettingsChanged,
  useUnreadCount,
} from '@modules/notifications';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { recurringMigrations } from './adapters/vault/migrations';
import { createVaultRecurringStore } from './adapters/vault/vaultRecurringStore';
import { createRecurringService } from './application/recurringService';
import { createReminderScheduler } from './application/reminders';
import type { SubscriptionsSummary } from './domain/amounts';
import { createBilleteraScreen } from './ui/BilleteraScreen';
import {
  createRecurringFormScreen,
  RECURRING_EDIT_ROUTE,
  RECURRING_FORM_ROUTE,
} from './ui/RecurringFormScreen';

export type { SubscriptionsSummary };
export { RECURRING_FORM_ROUTE };

registerVaultMigrations('recurring', recurringMigrations);

const clock: Clock = { now: () => new Date() };

const service = createRecurringService({
  store: () => createVaultRecurringStore(getVaultDb()),
  clock,
  newId: randomUUID,
  reminders: createReminderScheduler({
    notifications: notificationsPort,
    leadDays: getPaymentReminderLeadDays,
    clock,
  }),
});

// Reminders only while the app is open: when the vault opens, after each sync and when the
// person changes Ajustes de notificaciones, every item gets its next reminder again.
const refreshReminders = () => {
  void service.refreshReminders().catch(() => undefined);
};
appEvents.on('vault.unlocked', refreshReminders);
appEvents.on('sync.completed', refreshReminders);
onNotificationSettingsChanged(refreshReminders);

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
    recommendationsRoute: 'Recomendaciones',
  }),
  screens: [
    {
      // Add a fixed expense or subscription; with { id } it edits one.
      name: RECURRING_FORM_ROUTE,
      component: createRecurringFormScreen({ service }),
      path: 'billetera/recurrentes/nuevo',
    },
    {
      // A reminder opens its item: fynk://billetera/recurrentes/<id>.
      name: RECURRING_EDIT_ROUTE,
      component: createRecurringFormScreen({ service }),
      path: 'billetera/recurrentes/:id',
    },
  ],
};
