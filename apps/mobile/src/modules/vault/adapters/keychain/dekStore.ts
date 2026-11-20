// DekStore with react-native-keychain: copy A of the DEK. iOS Keychain, Android Keystore.
// Copy B (biometric) lives under its own service and exists only while biometrics are enabled.
import * as Keychain from 'react-native-keychain';

import type { BiometricPrompt, BiometricRead, DekStore } from '../../application/ports';

// These are the base names. Each account's entries add `.<slot>` (see createDekStore); the bare
// names are the legacy single vault, erased once by legacyVault.ts.
export const DEK_KEYCHAIN_SERVICE = 'co.fynk.app.vault.key';
export const DEK_BIOMETRIC_KEYCHAIN_SERVICE = 'co.fynk.app.vault.key.biometric';
// Which account the key belongs to, so another account on this phone never opens it.
export const DEK_OWNER_KEYCHAIN_SERVICE = 'co.fynk.app.vault.owner';
// A yes/no mark, not a secret: the one-time "use biometrics?" question was already spent.
export const DEK_BIOMETRIC_OFFER_KEYCHAIN_SERVICE = 'co.fynk.app.vault.biometricOffer';
const ACCOUNT = 'dek';
const OWNER_ACCOUNT = 'owner';
const OFFER_ACCOUNT = 'offer';

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
const optionsFor = (service: string): Keychain.SetOptions => ({
  service,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  cloudSync: false,
});

// Copy B: needs the current fingerprints or faces (iOS: invalidated when one is added or removed;
// Android: biometric-bound AES-GCM key, invalidated by a new enrollment). Needs a screen lock,
// never leaves this device. Built on use so loading the module needs no native constants.
const biometricSetOptions = (service: string, prompt: BiometricPrompt): Keychain.SetOptions => ({
  service,
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
  storage: Keychain.STORAGE_TYPE.AES_GCM,
  cloudSync: false,
  authenticationPrompt: prompt,
});

/**
 * One set of entries per account: every service name ends in `.<slot>`. `slot` is read on every
 * call. With no slot (nobody signed in) reads find nothing and writes throw, so a key can never
 * be stored or read without an account. Removals use `removalSlot` (default: the same slot), so a
 * wipe after sign out still erases the account's entries.
 */
export function createDekStore(
  slot: () => string | null,
  removalSlot: () => string | null = slot,
): DekStore {
  const noAccount = () => new Error('no signed in account');
  const name = (base: string): string | null => {
    const current = slot();
    return current === null ? null : `${base}.${current}`;
  };
  const need = (base: string): string => {
    const service = name(base);
    if (service === null) throw noAccount();
    return service;
  };
  const removeService = async (base: string) => {
    const current = removalSlot();
    const service = current === null ? null : `${base}.${current}`;
    if (service !== null) await Keychain.resetGenericPassword({ service });
  };
  const has = async (base: string) => {
    const service = name(base);
    return service !== null && Keychain.hasGenericPassword({ service });
  };

  const store: DekStore = {
    async read() {
      const service = name(DEK_KEYCHAIN_SERVICE);
      if (service === null) return null;
      const entry = await Keychain.getGenericPassword({ service });
      if (!entry) return null;
      return fromEntry(entry.password);
    },
    async write(dek) {
      const stored = await Keychain.setGenericPassword(
        ACCOUNT,
        toBase64(dek),
        optionsFor(need(DEK_KEYCHAIN_SERVICE)),
      );
      if (!stored) throw new Error('keychain write failed');
    },
    async remove() {
      await removeService(DEK_KEYCHAIN_SERVICE);
    },
    async readOwner() {
      const service = name(DEK_OWNER_KEYCHAIN_SERVICE);
      if (service === null) return null;
      const entry = await Keychain.getGenericPassword({ service });
      return entry ? entry.password : null;
    },
    async writeOwner(userId) {
      const stored = await Keychain.setGenericPassword(
        OWNER_ACCOUNT,
        userId,
        optionsFor(need(DEK_OWNER_KEYCHAIN_SERVICE)),
      );
      if (!stored) throw new Error('keychain write failed');
    },
    biometricOfferShown: () => has(DEK_BIOMETRIC_OFFER_KEYCHAIN_SERVICE),
    async markBiometricOfferShown() {
      const stored = await Keychain.setGenericPassword(
        OFFER_ACCOUNT,
        '1',
        optionsFor(need(DEK_BIOMETRIC_OFFER_KEYCHAIN_SERVICE)),
      );
      if (!stored) throw new Error('keychain write failed');
    },
    async removeAll() {
      // Only this account's slot. Each removal runs even when an earlier one fails.
      try {
        await store.remove();
      } finally {
        try {
          await store.removeBiometric();
        } finally {
          try {
            await removeService(DEK_OWNER_KEYCHAIN_SERVICE);
          } finally {
            await removeService(DEK_BIOMETRIC_OFFER_KEYCHAIN_SERVICE);
          }
        }
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
        return await has(DEK_BIOMETRIC_KEYCHAIN_SERVICE);
      } catch {
        return false;
      }
    },
    async writeBiometric(dek, prompt) {
      const service = need(DEK_BIOMETRIC_KEYCHAIN_SERVICE);
      try {
        const stored = await Keychain.setGenericPassword(
          ACCOUNT,
          toBase64(dek),
          biometricSetOptions(service, prompt),
        );
        if (!stored) throw new Error('keychain write failed');
      } catch (error) {
        if (classify(error) === 'cancelled') return 'cancelled';
        throw new Error('keychain write failed');
      }
      return 'ok';
    },
    async readBiometric(prompt): Promise<BiometricRead> {
      const service = name(DEK_BIOMETRIC_KEYCHAIN_SERVICE);
      if (service === null) return { status: 'invalidated' };
      try {
        const entry = await Keychain.getGenericPassword({
          service,
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
      await removeService(DEK_BIOMETRIC_KEYCHAIN_SERVICE);
    },
  };
  return store;
}
