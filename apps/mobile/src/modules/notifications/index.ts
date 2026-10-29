// Public API of the notifications module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';
import { Linking } from 'react-native';

import type { Clock } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';
import type { NotificationsPort } from '@shared/ports';

import {
  createExpoLocalNotifier,
  startLocalNotificationListeners,
} from './adapters/os/expoLocalNotifier';
import { notificationsMigrations } from './adapters/vault/migrations';
import { getVaultDb, registerVaultMigrations } from './adapters/vault/vaultAccess';
import { createVaultInboxStore } from './adapters/vault/vaultInboxStore';
import { createNotificationService } from './application/notificationService';
import type { PaymentLeadDays } from './domain/settings';
import { createNotificationSettingsScreen } from './ui/NotificationSettingsScreen';
import { createNotificationsScreen } from './ui/NotificationsScreen';
import { useUnreadCount as useUnreadCountOf } from './ui/useInbox';

registerVaultMigrations('notifications', notificationsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createNotificationService({
  store: () => createVaultInboxStore(getVaultDb()),
  clock,
  newId: randomUUID,
  notifier: createExpoLocalNotifier(),
});

const deliverDue = () => {
  void service.deliverDue().catch(() => undefined);
};

let listening = false;

// When the vault opens: reminders whose time passed while the app was closed go into the inbox,
// and from then on a reminder that fires with the app open goes in at once and a tap opens its
// link. Before the vault opens there is no inbox to fill and no screen to open.
appEvents.on('vault.unlocked', () => {
  deliverDue();
  if (listening) return;
  listening = true;
  startLocalNotificationListeners({
    onFired: deliverDue,
    onTapped: (link) => {
      void Linking.openURL(link).catch(() => undefined);
    },
  });
});

/** The shared NotificationsPort (contracts 3.4). Other modules notify and schedule through it. */
export const notificationsPort: NotificationsPort = service;

export const NotificationsScreen = createNotificationsScreen({ service, clock });

/** Number of unread notifications, for the bell: `<HeaderBlue hasUnread={useUnreadCount() > 0} />`. */
export const useUnreadCount = (): number => useUnreadCountOf(service);

/** Mi cuenta › Notificaciones. M1 links its "Notificaciones" row to this route. */
export const NOTIFICATION_SETTINGS_ROUTE = 'notifications.Settings' as const;
export const NotificationSettingsScreen = createNotificationSettingsScreen({ service });

/**
 * Days before a payment for its reminder, as the person chose in Ajustes de notificaciones
 * (0, 1 or 2; 2 by default). M9 reads it when it schedules a payment reminder.
 */
export const getPaymentReminderLeadDays = (): Promise<PaymentLeadDays> => service.paymentLeadDays();

export const routes: ModuleRoutes = {
  module: 'notifications',
  screens: [
    {
      name: 'notifications.Inbox',
      component: NotificationsScreen,
      path: 'notificaciones',
    },
    {
      name: NOTIFICATION_SETTINGS_ROUTE,
      component: NotificationSettingsScreen,
      path: 'notificaciones/ajustes',
    },
  ],
};
