// Public API of the notifications module. Other modules import only from this file.
import { randomUUID } from 'expo-crypto';

import type { Clock } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';
import type { NotificationsPort } from '@shared/ports';

import { notificationsMigrations } from './adapters/vault/migrations';
import { getVaultDb, registerVaultMigrations } from './adapters/vault/vaultAccess';
import { createVaultInboxStore } from './adapters/vault/vaultInboxStore';
import { createNotificationService } from './application/notificationService';

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

// Placeholder route from M0 until feature/notifications-inbox-screen.
export const routes: ModuleRoutes = {
  module: 'notifications',
  screens: [
    {
      name: 'notifications.Inbox',
      component: createPlaceholderScreen({
        title: 'Notificaciones',
        owner: 'M12 · Notificaciones',
      }),
      path: 'notificaciones',
    },
  ],
};
