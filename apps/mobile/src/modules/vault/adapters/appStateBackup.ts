// Tells the backup engine when the app goes to the background, to flush pending changes.
import { AppState, type AppStateStatus } from 'react-native';

/** Returns the unsubscribe. */
export function watchBackgrounded(onBackground: () => void): () => void {
  const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next !== 'active') onBackground();
  });
  return () => subscription.remove();
}
