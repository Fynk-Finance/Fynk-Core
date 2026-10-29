// DekStore with react-native-keychain: copy A of the DEK. iOS Keychain, Android Keystore.
// Copy B (biometric) uses the reserved service below and arrives with the biometric unlock PR.
import * as Keychain from 'react-native-keychain';

import type { DekStore } from '../../application/ports';

export const DEK_KEYCHAIN_SERVICE = 'co.fynk.app.vault.key';
export const DEK_BIOMETRIC_KEYCHAIN_SERVICE = 'co.fynk.app.vault.key.biometric';
const ACCOUNT = 'dek';

// The DEK is 32 bytes: one character per byte is safe for btoa and atob.
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

// Readable only while the phone is unlocked, never copied to backups or another device.
const options: Keychain.SetOptions = {
  service: DEK_KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  cloudSync: false,
};

export function createDekStore(): DekStore {
  const store: DekStore = {
    async read() {
      const entry = await Keychain.getGenericPassword({ service: DEK_KEYCHAIN_SERVICE });
      if (!entry) return null;
      let dek: Uint8Array;
      try {
        dek = fromBase64(entry.password);
      } catch {
        return null;
      }
      // Corrupt entry: report no key rather than open the vault with a wrong one.
      return dek.length === 32 ? dek : null;
    },
    async write(dek) {
      const stored = await Keychain.setGenericPassword(ACCOUNT, toBase64(dek), options);
      if (!stored) throw new Error('keychain write failed');
    },
    async remove() {
      await Keychain.resetGenericPassword({ service: DEK_KEYCHAIN_SERVICE });
    },
    async removeAll() {
      await store.remove();
      await Keychain.resetGenericPassword({ service: DEK_BIOMETRIC_KEYCHAIN_SERVICE });
    },
  };
  return store;
}
