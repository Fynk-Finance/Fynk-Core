// The vault gate's flow: the lock screen. It replaces the tabs with a fade and has no back gesture.
import { useEffect, useSyncExternalStore } from 'react';

import type { LockController } from '../application/lockController';
import { LockScreen } from './LockScreen';

export function createVaultFlow(controller: LockController) {
  return function VaultFlow() {
    const state = useSyncExternalStore(controller.subscribe, controller.getState);
    // The system prompt opens by itself once per lock when biometrics are enabled. After lock()
    // the button arrives a moment after `locked`, so this runs again when it does; the controller
    // makes sure it prompts only once.
    const canPrompt = state.status === 'locked' && state.biometric === true;
    useEffect(() => {
      if (canPrompt) void controller.autoPromptBiometric();
    }, [canPrompt]);
    return (
      <LockScreen
        state={state}
        onPassword={() => void controller.unlockWithPassword()}
        onBiometric={() => void controller.unlockWithBiometrics()}
        onRetry={() => void controller.unlock()}
      />
    );
  };
}
