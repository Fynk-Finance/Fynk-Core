// Public API of the recurring module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock, MoneyMinor } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import { getAccounts } from '@modules/accounts';
import { STATISTICS_ROUTE } from '@modules/analytics';
import { syncNow } from '@modules/bank';
import {
  getPaymentReminderLeadDays,
  NOTIFICATIONS_ROUTE,
  notificationsPort,
  onNotificationSettingsChanged,
  useUnreadCount,
} from '@modules/notifications';
import { useDisplayName } from '@modules/onboarding';
import { getTransactionsBetween, TRANSACTION_DETAIL_ROUTE } from '@modules/transactions';
import {
  getVaultDb,
  markDirty,
  registerBackupCollection,
  registerVaultMigrations,
} from '@modules/vault';

import { createRecurringBackup } from './adapters/backup/recurringBackup';
import { recurringMigrations } from './adapters/vault/migrations';
import { createVaultPriceAlertStore } from './adapters/vault/vaultPriceAlertStore';
import { createVaultProposalStore } from './adapters/vault/vaultProposalStore';
import { createVaultRecurringStore } from './adapters/vault/vaultRecurringStore';
import { createCatalogApi } from './adapters/api/catalogApi';
import { createVaultCatalogCache } from './adapters/vault/vaultCatalogCache';
import { createCatalogService } from './application/catalogService';
import { createDetectionService } from './application/detectionService';
import { forDetection } from './domain/catalog';
import { createPriceAlertService } from './application/priceAlertService';
import { createRecurringService } from './application/recurringService';
import { createReminderScheduler } from './application/reminders';
import type { RecurringSummary, SubscriptionsSummary } from './domain/amounts';
import { bogotaToday, createBilleteraScreen } from './ui/BilleteraScreen';
import { createDetectedScreen, DETECTED_ROUTE } from './ui/DetectedScreen';
import { recurringStrings } from './ui/strings.es-CO';
import {
  createRecurringFormScreen,
  RECURRING_EDIT_ROUTE,
  RECURRING_FORM_ROUTE,
} from './ui/RecurringFormScreen';
import { createRecurringSetup } from './ui/RecurringSetup';
import {
  createSubscriptionDetailScreen,
  SUBSCRIPTION_DETAIL_ROUTE,
} from './ui/SubscriptionDetailScreen';

export type { RecurringSummary, SubscriptionsSummary };
export { RECURRING_FORM_ROUTE };

registerVaultMigrations('recurring', recurringMigrations);

const clock: Clock = { now: () => new Date() };

const service = createRecurringService({
  store: () => createVaultRecurringStore(getVaultDb(), markDirty),
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

// HU-045: fixed expenses and subscriptions, with their usage marks, in the encrypted backup.
const backup = createRecurringBackup({
  db: getVaultDb,
  markDirty,
  onImported: () => {
    service.notifyChanged();
    refreshReminders();
  },
});
registerBackupCollection(backup.items);
appEvents.on('vault.unlocked', () => {
  void backup.flushPending().catch(() => undefined);
});

// SCRUM-58: the shared merchant catalog. The vault copy is read when the vault opens, and a new
// one is asked at most once a day while the app is open (ETag). It holds no personal data.
const catalog = createCatalogService({
  cache: () => createVaultCatalogCache(getVaultDb()),
  api: createCatalogApi(),
  clock,
});
appEvents.on('vault.unlocked', () => {
  void catalog
    .load()
    .then(() => catalog.refresh())
    .catch(() => undefined);
});

/** The category the catalog gives a merchant, for M7's categorization. Null when unknown. */
export const getCatalogCategory = (merchantKey: string): string | null =>
  catalog.lookup(merchantKey)?.category ?? null;

// SCRUM-55: after every sync (the first full one included), detection runs over 12 months of
// M7's outflows, with the catalog's names and kinds. New proposals emit `recurring.detected`;
// the person confirms or dismisses each one.
const detectedStrings = recurringStrings.detected;
const detection = createDetectionService({
  proposals: () => createVaultProposalStore(getVaultDb()),
  items: () => createVaultRecurringStore(getVaultDb()).list(),
  listMovements: getTransactionsBetween,
  catalog: (merchantKey) => forDetection(catalog.lookup(merchantKey)),
  recurring: service,
  clock,
  onDetected: (count) => {
    if (count === 0) return;
    appEvents.emit({ type: 'recurring.detected', count });
    void notificationsPort
      .notify({
        kind: 'sync_result',
        title: detectedStrings.noticeTitle,
        body: detectedStrings.noticeBody(count),
        deepLink: 'fynk://billetera/detectados',
        dedupeKey: `recurring.detected:${clock.now().toISOString()}`,
      })
      .catch(() => undefined);
  },
  // Billetera reloads, so its banner shows how many are left.
  onChange: () => service.notifyChanged(),
});
appEvents.on('sync.completed', () => {
  void detection.run().catch(() => undefined);
});

// SCRUM-61: after every sync, the newest charge of each detected subscription against the one
// before it. Above max(5 %, $1.000): one alert per charge, an inbox notice and the red chip.
const priceAlerts = createPriceAlertService({
  store: () => createVaultPriceAlertStore(getVaultDb()),
  items: () => service.list(),
  listMovements: getTransactionsBetween,
  notifications: notificationsPort,
  clock,
  newId: randomUUID,
  onChange: () => service.notifyChanged(),
});
appEvents.on('sync.completed', () => {
  void priceAlerts.check().catch(() => undefined);
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
    // Read only when the screen renders: onboarding imports this module too.
    useDisplayName: () => useDisplayName(),
    accountRoute: 'identity.Account',
    notificationsRoute: NOTIFICATIONS_ROUTE,
    statisticsRoute: STATISTICS_ROUTE,
    recommendationsRoute: 'Recomendaciones',
    accounts: getAccounts,
    pendingProposals: async () => (await detection.pending()).length,
    detectedRoute: DETECTED_ROUTE,
    priceUpItems: async () => new Set((await priceAlerts.openByItem()).keys()),
    refresh: () => syncNow(),
  }),
  screens: [
    {
      // SCRUM-55: from the Billetera banner, or the inbox notice after a sync.
      name: DETECTED_ROUTE,
      component: createDetectedScreen({ detection, subscribe: service.subscribe }),
      path: 'billetera/detectados',
    },
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
    {
      // Detalle de suscripción, from a row of "Otros gastos" (SCRUM-58).
      name: SUBSCRIPTION_DETAIL_ROUTE,
      component: createSubscriptionDetailScreen({
        service,
        today: () => bogotaToday(clock.now()),
        accounts: getAccounts,
        listMovements: getTransactionsBetween,
        transactionRoute: TRANSACTION_DETAIL_ROUTE,
        priceAlerts,
        catalog: (merchantKey) => catalog.lookup(merchantKey),
      }),
      path: 'billetera/suscripciones/:id',
    },
  ],
};

/** Monthly total of the active fixed expenses and subscriptions (onboarding step 5 and Listo). */
export const getRecurringMonthlyTotal = (): Promise<MoneyMinor> => service.fixedExpensesThisMonth();

/** "4 pagos $1.453.900/mes" on onboarding's Listo (M3): count and month of the active items. */
export const getRecurringSummary = (): Promise<RecurringSummary> => service.recurringSummary();

/**
 * Onboarding step 5, "Gastos recurrentes" (design OnbGastos): the collapsible items with the form
 * fields, "Agregar gasto recurrente" and "Total mensual". M3 renders `<RecurringSetup />` inside
 * its step frame, above "Terminar configuración".
 */
export const RecurringSetup = createRecurringSetup({ service });
