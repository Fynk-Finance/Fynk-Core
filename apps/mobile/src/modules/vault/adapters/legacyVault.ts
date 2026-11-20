// The phone used to hold one vault: `fynk-vault.db` and Keychain services without a slot. Now
// each account has its own slot, so the single legacy vault is erased once (only team test
// phones had one; the recovery code restores the backup). Slotted entries are never touched.
import * as Keychain from 'react-native-keychain';

import {
  DEK_BIOMETRIC_KEYCHAIN_SERVICE,
  DEK_BIOMETRIC_OFFER_KEYCHAIN_SERVICE,
  DEK_KEYCHAIN_SERVICE,
  DEK_OWNER_KEYCHAIN_SERVICE,
} from './keychain/dekStore';
import { deleteLegacyVaultFile } from './sqlite/opSqliteDriver';

// A yes/no mark, not a secret: the legacy vault was already erased on this phone.
export const LEGACY_ERASED_KEYCHAIN_SERVICE = 'co.fynk.app.vault.legacyErased';

const LEGACY_SERVICES = [
  DEK_KEYCHAIN_SERVICE,
  DEK_BIOMETRIC_KEYCHAIN_SERVICE,
  DEK_OWNER_KEYCHAIN_SERVICE,
  DEK_BIOMETRIC_OFFER_KEYCHAIN_SERVICE,
];

/** Idempotent. Throws when a Keychain removal fails, and then does not mark itself done. */
export function createLegacyVaultEraser(
  load?: Parameters<typeof deleteLegacyVaultFile>[0],
): () => Promise<void> {
  return async () => {
    if (await Keychain.hasGenericPassword({ service: LEGACY_ERASED_KEYCHAIN_SERVICE })) return;
    // Each removal runs even when an earlier one fails; the first failure is reported.
    let failure: unknown;
    for (const service of LEGACY_SERVICES) {
      try {
        await Keychain.resetGenericPassword({ service });
      } catch (error) {
        failure ??= error;
      }
    }
    await deleteLegacyVaultFile(load);
    if (failure) throw failure;
    const stored = await Keychain.setGenericPassword('legacy', '1', {
      service: LEGACY_ERASED_KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      cloudSync: false,
    });
    if (!stored) throw new Error('keychain write failed');
  };
}
