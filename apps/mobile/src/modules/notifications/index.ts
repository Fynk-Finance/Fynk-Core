// Public API of the notifications module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M12 replaces them with the real screens).
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
