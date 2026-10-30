// The vault gate's flow: the lock screen, or the recovery code on the first phone. It replaces the
// tabs with a fade and has no back gesture.
import { useEffect, useSyncExternalStore } from 'react';

import type { LockController } from '../application/lockController';
import { LockScreen } from './LockScreen';
import { RecoveryCodeScreen } from './RecoveryCodeScreen';

export interface VaultFlowDeps {
  /** Puts text on the clipboard (expo-clipboard in the app). */
  copyText: (text: string) => Promise<unknown>;
}

export function createVaultFlow(controller: LockController, { copyText }: VaultFlowDeps) {
  return function VaultFlow() {
    const state = useSyncExternalStore(controller.subscribe, controller.getState);
    // The system prompt opens by itself once per lock when biometrics are enabled. After lock()
    // the button arrives a moment after `locked`, so this runs again when it does; the controller
    // makes sure it prompts only once.
    const canPrompt = state.status === 'locked' && state.biometric === true;
    useEffect(() => {
      if (canPrompt) void controller.autoPromptBiometric();
    }, [canPrompt]);
    if (state.status === 'recoveryCode' && state.recovery) {
      return (
        <RecoveryCodeScreen
          groups={state.recovery.groups}
          onConfirm={(lastGroup) => controller.confirmRecoveryCode(lastGroup)}
          copyText={copyText}
        />
      );
    }
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
