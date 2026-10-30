// ConfirmOwner for HU-046: "approval needs biometrics or the password on the old phone". It asks
// every time, even when the vault is already open, so a phone left unlocked cannot approve alone.
import type { ConfirmOwner } from '../application/approveDevice';
import type { BiometricPrompt, DekStore } from '../application/ports';

export interface ConfirmOwnerDeps {
  dekStore: DekStore;
  /** A fresh Keycloak login of the same account. Identity is called lazily (import cycle). */
  reauthenticate: () => Promise<'ok' | 'cancelled' | 'failed'>;
  biometricPrompt: BiometricPrompt;
}

export function createConfirmOwner({
  dekStore,
  reauthenticate,
  biometricPrompt,
}: ConfirmOwnerDeps): ConfirmOwner {
  return async () => {
    if ((await dekStore.biometricsAvailable()) && (await dekStore.hasBiometric())) {
      const result = await dekStore.readBiometric(biometricPrompt);
      if (result.status === 'ok') return result.dek;
      if (result.status === 'cancelled') return null;
      // Invalidated or failed: the password still works. The lock screen deletes an invalidated
      // copy B the next time it is used; approving does not change the setting.
    }
    const login = await reauthenticate();
    if (login === 'cancelled') return null;
    if (login === 'failed') throw new Error('the password check failed');
    const dek = await dekStore.read();
    if (!dek) throw new Error('this phone has no key to share');
    return dek;
  };
}
