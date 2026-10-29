// DekStore with react-native-keychain: copy A of the DEK. iOS Keychain, Android Keystore.
// Copy B (biometric) lives under its own service and exists only while biometrics are enabled.
import * as Keychain from 'react-native-keychain';

import type { BiometricPrompt, BiometricRead, DekStore } from '../../application/ports';

export const DEK_KEYCHAIN_SERVICE = 'co.fynk.app.vault.key';
export const DEK_BIOMETRIC_KEYCHAIN_SERVICE = 'co.fynk.app.vault.key.biometric';
const ACCOUNT = 'dek';

// The DEK is 32 bytes: one character per byte is safe for btoa and atob.
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

const fromEntry = (password: string): Uint8Array | null => {
  let dek: Uint8Array;
  try {
    dek = fromBase64(password);
  } catch {
    return null;
  }
  // Corrupt entry: report no key rather than open the vault with a wrong one.
  return dek.length === 32 ? dek : null;
};

// Cancel: iOS errSecUserCanceled (-128); Android BiometricPrompt codes 5, 10 and 13 come in the
// message as "code: N". Invalidated: Android KeyPermanentlyInvalidatedException (by message) or
// iOS errSecItemNotFound (-25300), because the system deletes the item when the set changes.
// Only the code and message are read, and never logged.
function classify(error: unknown): 'cancelled' | 'invalidated' | 'failed' {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  const text = `${String(code ?? '')} ${String(message ?? '')}`.toLowerCase();
  if (/invalidat/.test(text) || String(code) === '-25300') return 'invalidated';
  if (String(code) === '-128' || /cancel|code: (5|10|13)/.test(text)) return 'cancelled';
  return 'failed';
}

// Readable only while the phone is unlocked, never copied to backups or another device.
const options: Keychain.SetOptions = {
  service: DEK_KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  cloudSync: false,
};

// Copy B: needs the current fingerprints or faces (iOS: invalidated when one is added or removed;
// Android: biometric-bound AES-GCM key, invalidated by a new enrollment). Needs a screen lock,
// never leaves this device. Built on use so loading the module needs no native constants.
const biometricSetOptions = (prompt: BiometricPrompt): Keychain.SetOptions => ({
  service: DEK_BIOMETRIC_KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
  storage: Keychain.STORAGE_TYPE.AES_GCM,
  cloudSync: false,
  authenticationPrompt: prompt,
});

export function createDekStore(): DekStore {
  const store: DekStore = {
    async read() {
      const entry = await Keychain.getGenericPassword({ service: DEK_KEYCHAIN_SERVICE });
      if (!entry) return null;
      return fromEntry(entry.password);
    },
    async write(dek) {
      const stored = await Keychain.setGenericPassword(ACCOUNT, toBase64(dek), options);
      if (!stored) throw new Error('keychain write failed');
    },
    async remove() {
      await Keychain.resetGenericPassword({ service: DEK_KEYCHAIN_SERVICE });
    },
    async removeAll() {
      // Copy B goes even when removing copy A fails.
      try {
        await store.remove();
      } finally {
        await store.removeBiometric();
      }
    },
    async biometricsAvailable() {
      try {
        return (await Keychain.getSupportedBiometryType()) !== null;
      } catch {
        return false;
      }
    },
    async hasBiometric() {
      try {
        // Does not show the prompt: iOS asks with "fail if UI is needed", Android only looks it up.
        return await Keychain.hasGenericPassword({ service: DEK_BIOMETRIC_KEYCHAIN_SERVICE });
      } catch {
        return false;
      }
    },
    async writeBiometric(dek, prompt) {
      try {
        const stored = await Keychain.setGenericPassword(
          ACCOUNT,
          toBase64(dek),
          biometricSetOptions(prompt),
        );
        if (!stored) throw new Error('keychain write failed');
      } catch (error) {
        if (classify(error) === 'cancelled') return 'cancelled';
        throw new Error('keychain write failed');
      }
      return 'ok';
    },
    async readBiometric(prompt): Promise<BiometricRead> {
      try {
        const entry = await Keychain.getGenericPassword({
          service: DEK_BIOMETRIC_KEYCHAIN_SERVICE,
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
          authenticationPrompt: prompt,
        });
        // Gone although it was there a moment ago: the system dropped it after an enrollment change.
        if (!entry) return { status: 'invalidated' };
        const dek = fromEntry(entry.password);
        return dek ? { status: 'ok', dek } : { status: 'invalidated' };
      } catch (error) {
        return { status: classify(error) };
      }
    },
    async removeBiometric() {
      await Keychain.resetGenericPassword({ service: DEK_BIOMETRIC_KEYCHAIN_SERVICE });
    },
  };
  return store;
}
