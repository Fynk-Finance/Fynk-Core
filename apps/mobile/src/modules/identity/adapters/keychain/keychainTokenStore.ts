// TokenStorePort with react-native-keychain: iOS Keychain, Android Keystore. Never AsyncStorage.
import * as Keychain from 'react-native-keychain';

import type { TokenStorePort } from '../../application/ports';
import { parseTokenSet } from '../../domain/session';

export const KEYCHAIN_SERVICE = 'co.fynk.app.identity.session';
const ACCOUNT = 'keycloak';

// Readable only while the phone is unlocked, never copied to backups or another device.
const options: Keychain.SetOptions = {
  service: KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  cloudSync: false,
};

export function createKeychainTokenStore(): TokenStorePort {
  const clear = async () => {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  };
  return {
    async load() {
      const entry = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      if (!entry) return null;
      const tokens = parseTokenSet(entry.password);
      // Corrupt or from an older format: forget it, the user signs in again.
      if (!tokens) await clear();
      return tokens;
    },
    async save(tokens) {
      const stored = await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(tokens), options);
      if (!stored) throw new Error('keychain write failed');
    },
    clear,
  };
}
