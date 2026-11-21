// Feeds the app's foreground and background changes to the lock controller.
import { AppState, type AppStateStatus } from 'react-native';

import type { LockController } from '../application/lockController';

/** Returns the unsubscribe. */
export function watchAppState(controller: LockController): () => void {
  const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') void controller.appForegrounded();
    else controller.appBackgrounded();
  });
  return () => subscription.remove();
}
