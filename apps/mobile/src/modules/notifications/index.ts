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

export const routes: ModuleRoutes = {
  module: 'notifications',
  screens: [
    {
      name: 'notifications.Inbox',
      component: NotificationsScreen,
      path: 'notificaciones',
    },
  ],
};
