// DeviceStorePort with react-native-keychain: the X25519 key pair of this install and the id
// the API gave this phone. iOS Keychain, Android Keystore. Never AsyncStorage.
import * as Keychain from 'react-native-keychain';

import type { DeviceStorePort } from '../../application/ports';
import { parseDeviceRecord } from '../../domain/device';

export const DEVICE_KEYCHAIN_SERVICE = 'co.fynk.app.identity.device';
const ACCOUNT = 'device';

// Readable only while the phone is unlocked, never copied to backups or another device.
const options: Keychain.SetOptions = {
  service: DEVICE_KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  cloudSync: false,
};

export function createDeviceKeyStore(): DeviceStorePort {
  return {
    async load() {
      const entry = await Keychain.getGenericPassword({ service: DEVICE_KEYCHAIN_SERVICE });
      if (!entry) return null;
      const record = parseDeviceRecord(entry.password);
      // Corrupt or from an older format: forget it, the next sync makes a new key pair.
      if (!record) await Keychain.resetGenericPassword({ service: DEVICE_KEYCHAIN_SERVICE });
      return record;
    },
    async save(record) {
      const stored = await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(record), options);
      if (!stored) throw new Error('keychain write failed');
    },
  };
}
