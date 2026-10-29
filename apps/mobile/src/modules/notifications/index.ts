// Public API of the notifications module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';
import type { NotificationsPort } from '@shared/ports';

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
});

// Reminders whose time passed while the app was closed show up as soon as the vault opens.
appEvents.on('vault.unlocked', () => {
  void service.deliverDue().catch(() => undefined);
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
