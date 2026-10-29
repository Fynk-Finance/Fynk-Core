// The vault gate's flow: the lock screen. It replaces the tabs with a fade and has no back gesture.
import { useSyncExternalStore } from 'react';

import type { LockController } from '../application/lockController';
import { LockScreen } from './LockScreen';

export function createVaultFlow(controller: LockController) {
  return function VaultFlow() {
    const state = useSyncExternalStore(controller.subscribe, controller.getState);
    return (
      <LockScreen
        state={state}
        onPassword={() => void controller.unlockWithPassword()}
        onRetry={() => void controller.unlock()}
      />
    );
  };
}
